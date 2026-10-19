import Parser from "rss-parser";
import { FEEDS, type Feed } from "../categories";
import { fetchWithTimeout, mapLimit, normalizeUrl, stripHtml, truncate } from "./util";

export type Candidate = {
  url: string;
  title: string;
  summary: string | null;
  source: string;
  category: Feed["category"];
  image_url: string | null;
  published_at: string;
};

type MediaAttrs = { url?: string; width?: string; height?: string; medium?: string; type?: string };
type MediaNode = { $?: MediaAttrs } | MediaAttrs;
type Item = Parser.Item & {
  mediaContent?: MediaNode[];
  mediaThumbnail?: MediaNode | MediaNode[];
  contentEncoded?: string;
  description?: string;
};

const parser: Parser<object, Item> = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
      "description",
    ],
  },
});

/** Only keep stories this recent. Older items in a feed are already in the DB or stale. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const MAX_ITEMS_PER_FEED = 20;

function attrs(node: MediaNode): MediaAttrs {
  return ("$" in node && node.$ ? node.$ : node) as MediaAttrs;
}

function looksLikeImage(a: MediaAttrs) {
  if (a.medium) return a.medium === "image";
  if (a.type) return a.type.startsWith("image/");
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(a.url ?? "") || Boolean(a.width);
}

/** BBC serves 240px thumbnails in RSS; the same path works at larger sizes. */
function upscale(url: string) {
  return url.replace(/(ichef\.bbci\.co\.uk\/(?:ace\/)?(?:standard|news))\/\d+\//, "$1/976/");
}

function pickImage(item: Item): string | null {
  const media = (item.mediaContent ?? []).map(attrs).filter((a) => a.url && looksLikeImage(a));
  if (media.length) {
    media.sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0));
    return upscale(media[0].url!);
  }
  const thumbs = item.mediaThumbnail ? [item.mediaThumbnail].flat().map(attrs) : [];
  if (thumbs[0]?.url) return upscale(thumbs[0].url);
  if (item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith("image/"))) {
    return item.enclosure.url;
  }
  const html = item.contentEncoded ?? item.content ?? item.description ?? "";
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img ? img[1] : null;
}

function toCandidate(item: Item, feed: Feed, now: number): Candidate | null {
  const url = item.link ? normalizeUrl(item.link) : null;
  const title = item.title ? stripHtml(item.title) : "";
  if (!url || title.length < 8) return null;

  const published = new Date(item.isoDate ?? item.pubDate ?? "");
  // Some feeds omit dates; treat those as "just seen" rather than dropping them.
  const publishedMs = Number.isNaN(published.getTime()) ? now : Math.min(published.getTime(), now);
  if (now - publishedMs > MAX_AGE_MS) return null;

  const rawSummary = item.contentSnippet || stripHtml(item.description ?? item.content ?? "");
  const summary = rawSummary ? truncate(stripHtml(rawSummary), 320) : null;
  const image = pickImage(item);

  return {
    url,
    title: truncate(title, 300),
    summary: summary && summary !== title ? summary : null,
    source: feed.source,
    category: feed.category,
    image_url: image ? normalizeUrl(image) : null,
    published_at: new Date(publishedMs).toISOString(),
  };
}

export type FeedError = { feed: string; error: string };

export async function fetchAllFeeds(): Promise<{ candidates: Candidate[]; errors: FeedError[] }> {
  const now = Date.now();
  const errors: FeedError[] = [];

  const perFeed = await mapLimit(FEEDS, 8, async (feed) => {
    try {
      const res = await fetchWithTimeout(feed.url, 15_000, {
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = await parser.parseString(await res.text());
      return parsed.items
        .slice(0, MAX_ITEMS_PER_FEED)
        .map((item) => toCandidate(item, feed, now))
        .filter((c): c is Candidate => c !== null);
    } catch (e) {
      errors.push({ feed: `${feed.source} (${feed.category})`, error: e instanceof Error ? e.message : String(e) });
      return [];
    }
  });

  // Dedupe by URL and by exact title (syndicated copies). FEEDS order decides which
  // category wins, so specific sections beat generic ones.
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of perFeed.flat()) {
    const titleKey = c.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seenUrls.has(c.url) || seenTitles.has(titleKey)) continue;
    seenUrls.add(c.url);
    seenTitles.add(titleKey);
    candidates.push(c);
  }
  return { candidates, errors };
}
