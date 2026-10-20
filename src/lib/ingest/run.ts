import "server-only";
import { revalidateTag } from "next/cache";
import { ARTICLES_TAG } from "../articles";
import { getCategory } from "../categories";
import { isPushConfigured, sendPush } from "../push";
import { getSupabase, publicImageUrl } from "../supabase";
import { SUBSCRIPTION_COLUMNS, type ArticleRow, type PrefKey, type PushSubscriptionRow } from "../types";
import { fetchAllFeeds } from "./feeds";
import { deleteImages, processImages } from "./images";
import { SAME_STORY, scoreArticles, similarity, titleTokens } from "./scoring";
import { truncate } from "./util";

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 14);
const MAX_BREAKING_PUSHES = 4;

/** Sections with their own opt-in brief. They're left out of the main digest. */
const OPT_IN_SECTIONS: Record<string, { pref: PrefKey; emoji: string }> = {
  pakistan: { pref: "notify_pakistan", emoji: "🇵🇰" },
  entertainment: { pref: "notify_entertainment", emoji: "🎬" },
};
const HOUR = 60 * 60 * 1000;

export type IngestResult = {
  inserted: number;
  upgraded: number;
  breaking: number;
  notifications: number;
  deleted: number;
  errors: { feed?: string; step?: string; error: string }[];
  ms: number;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function imageFor(a: Pick<ArticleRow, "image_path" | "image_url">) {
  return a.image_path ? publicImageUrl(a.image_path) : a.image_url;
}

export async function runIngest({ budgetMs = 240_000, notify = true } = {}): Promise<IngestResult> {
  const started = Date.now();
  const deadline = started + budgetMs;
  const supabase = getSupabase();
  const result: IngestResult = { inserted: 0, upgraded: 0, breaking: 0, notifications: 0, deleted: 0, errors: [], ms: 0 };

  const { data: run } = await supabase.from("fetch_runs").insert({}).select("id").single();

  try {
    // 1. Pull every feed.
    const { candidates, errors } = await fetchAllFeeds();
    result.errors.push(...errors);

    // 2. Split into new vs. already stored.
    const stored = new Map<string, { score: number; is_breaking: boolean }>();
    for (const urls of chunk(candidates.map((c) => c.url), 100)) {
      const { data, error } = await supabase.from("articles").select("url, score, is_breaking").in("url", urls);
      if (error) throw error;
      for (const row of data) stored.set(row.url, row);
    }

    // 3. Score everything against the last ~36h of headlines, so a story that's now
    //    on five outlets gets upgraded even if we stored it last run.
    const { data: recent, error: recentError } = await supabase
      .from("articles")
      .select("title, source")
      .gte("published_at", new Date(Date.now() - 36 * HOUR).toISOString());
    if (recentError) throw recentError;
    const pool = [...recent, ...candidates.map((c) => ({ title: c.title, source: c.source }))];
    const scored = scoreArticles(candidates, pool);

    const fresh = scored.filter((s) => !stored.has(s.item.url));
    const upgrades = scored.filter((s) => {
      const prev = stored.get(s.item.url);
      return prev && (s.score > prev.score || (s.is_breaking && !prev.is_breaking));
    });

    // 4. Images (og:image fallback + mirror to Storage), leaving time for the rest.
    const withImages = await processImages(
      fresh.map((s) => ({ ...s.item, score: s.score, is_breaking: s.is_breaking })),
      deadline - 45_000,
    );

    for (const rows of chunk(withImages, 200)) {
      const { data, error } = await supabase
        .from("articles")
        .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
        .select("id");
      if (error) result.errors.push({ step: "insert", error: error.message });
      else result.inserted += data.length;
    }

    for (const s of upgrades) {
      const { error } = await supabase
        .from("articles")
        .update({ score: s.score, ...(s.is_breaking ? { is_breaking: true } : {}) })
        .eq("url", s.item.url);
      if (!error) result.upgraded++;
    }

    result.breaking = withImages.filter((a) => a.is_breaking).length;

    // 5. Notifications.
    if (notify && isPushConfigured()) {
      result.notifications = await sendNotifications(withImages.length);
    }

    // 6. Retention.
    result.deleted = await pruneOldArticles();
  } catch (e) {
    result.errors.push({ step: "run", error: e instanceof Error ? e.message : String(e) });
    console.error("ingest failed", e);
  } finally {
    // Fresh content should show immediately, not on the second visit.
    revalidateTag(ARTICLES_TAG, { expire: 0 });
    result.ms = Date.now() - started;
    if (run) {
      await supabase
        .from("fetch_runs")
        .update({
          finished_at: new Date().toISOString(),
          inserted: result.inserted,
          breaking: result.breaking,
          notifications: result.notifications,
          errors: result.errors,
        })
        .eq("id", run.id);
    }
  }
  return result;
}

async function sendNotifications(newCount: number): Promise<number> {
  const supabase = getSupabase();
  const { data, error: subsError } = await supabase.from("push_subscriptions").select(SUBSCRIPTION_COLUMNS);
  if (subsError) throw subsError;
  const subs = data as unknown as PushSubscriptionRow[];
  if (!subs.length) return 0;
  const breakingSubs = subs.filter((s) => s.notify_breaking);
  const digestSubs = subs.filter((s) => s.notify_digest);
  let sent = 0;

  // Breaking: one push per distinct story, skipping anything we already alerted on.
  const since24h = new Date(Date.now() - 24 * HOUR).toISOString();
  const [{ data: pending }, { data: alreadySent }] = await Promise.all([
    supabase
      .from("articles")
      .select("*")
      .eq("is_breaking", true)
      .is("notified_at", null)
      .gte("published_at", since24h)
      .order("score", { ascending: false })
      .limit(30),
    supabase
      .from("articles")
      .select("title")
      .not("notified_at", "is", null)
      .gte("notified_at", new Date(Date.now() - 48 * HOUR).toISOString()),
  ]);

  const seen = (alreadySent ?? []).map((a) => titleTokens(a.title));
  const toPush: ArticleRow[] = [];
  for (const a of (pending ?? []) as ArticleRow[]) {
    const tokens = titleTokens(a.title);
    if (seen.some((t) => similarity(tokens, t) >= SAME_STORY)) continue;
    seen.push(tokens);
    if (toPush.length < MAX_BREAKING_PUSHES) toPush.push(a);
  }

  for (const a of toPush) {
    const res = await sendPush(breakingSubs, {
      title: `🚨 ${getCategory(a.category)?.short ?? "Breaking"} · ${a.source}`,
      body: a.title,
      url: a.url,
      image: imageFor(a),
      tag: `breaking-${a.id}`,
    });
    sent += res.sent;
  }

  // Mark every pending breaking row (pushed, duplicate, or over the cap) so it never fires later.
  const pendingIds = (pending ?? []).map((a) => a.id);
  if (pendingIds.length) {
    await supabase.from("articles").update({ notified_at: new Date().toISOString() }).in("id", pendingIds);
  }

  if (newCount === 0) return sent;

  // Everything inserted by this run, best first (score, then newest).
  const { data: fresh } = await supabase
    .from("articles")
    .select("title, category, score")
    .gte("fetched_at", new Date(Date.now() - HOUR).toISOString())
    .order("score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(500);
  const freshRows = fresh ?? [];
  const bullets = (rows: { title: string }[]) => rows.slice(0, 3).map((a) => `• ${truncate(a.title, 90)}`).join("\n");

  // Digest: one summary push per run with top headlines from different hard-news sections.
  if (digestSubs.length) {
    const picked: { title: string }[] = [];
    const usedCats = new Set<string>();
    for (const a of freshRows) {
      if (a.category in OPT_IN_SECTIONS || usedCats.has(a.category)) continue;
      usedCats.add(a.category);
      picked.push(a);
    }
    if (picked.length) {
      const res = await sendPush(digestSubs, {
        title: `📰 Your news brief · ${newCount} new ${newCount === 1 ? "story" : "stories"}`,
        body: bullets(picked),
        url: "/",
        tag: "digest",
      });
      sent += res.sent;
    }
  }

  // Opt-in sections: one brief per run for each section the device turned on.
  for (const [category, { pref, emoji }] of Object.entries(OPT_IN_SECTIONS)) {
    const sectionSubs = subs.filter((s) => s[pref]);
    const rows = freshRows.filter((a) => a.category === category);
    if (!sectionSubs.length || !rows.length) continue;
    const res = await sendPush(sectionSubs, {
      title: `${emoji} ${getCategory(category)?.name} · ${rows.length} new ${rows.length === 1 ? "story" : "stories"}`,
      body: bullets(rows),
      url: `/category/${category}`,
      tag: `section-${category}`,
    });
    sent += res.sent;
  }

  return sent;
}

async function pruneOldArticles(): Promise<number> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * HOUR).toISOString();
  const { data: old, error } = await supabase
    .from("articles")
    .select("id, image_path")
    .lt("published_at", cutoff)
    .limit(1000);
  if (error || !old?.length) return 0;

  const paths = old.map((a) => a.image_path).filter((p): p is string => Boolean(p));
  if (paths.length) await deleteImages(paths);
  for (const ids of chunk(old.map((a) => a.id), 200)) {
    await supabase.from("articles").delete().in("id", ids);
  }
  await supabase.from("fetch_runs").delete().lt("started_at", new Date(Date.now() - 30 * 24 * HOUR).toISOString());
  return old.length;
}
