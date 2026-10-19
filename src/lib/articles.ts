import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { FEED_CATEGORIES, type CategorySlug } from "./categories";
import { getSupabase, isSupabaseConfigured, publicImageUrl } from "./supabase";
import type { Article, ArticleRow } from "./types";

/** Every article query is tagged with this; the cron job revalidates it after each run. */
export const ARTICLES_TAG = "articles";

const COLUMNS = "id, url, title, summary, source, category, published_at, is_breaking, score, image_url, image_path";
const HOUR = 60 * 60 * 1000;

type Row = Pick<ArticleRow, "id" | "url" | "title" | "summary" | "source" | "category" | "published_at" | "is_breaking" | "score" | "image_url" | "image_path">;

function toArticle({ image_url, image_path, ...rest }: Row): Article {
  return { ...rest, image: image_path ? publicImageUrl(image_path) : image_url };
}

export type HomeData = {
  configured: boolean;
  lead: Article | null;
  breaking: Article[];
  sections: { slug: CategorySlug; articles: Article[] }[];
  updatedAt: string | null;
};

export async function getHomeData(): Promise<HomeData> {
  "use cache";
  cacheLife("hours");
  cacheTag(ARTICLES_TAG);

  if (!isSupabaseConfigured()) return { configured: false, lead: null, breaking: [], sections: [], updatedAt: null };

  const supabase = getSupabase();
  const since = new Date(Date.now() - 48 * HOUR).toISOString();
  const [{ data: rows }, { data: run }] = await Promise.all([
    supabase.from("articles").select(COLUMNS).gte("published_at", since).order("published_at", { ascending: false }).limit(800),
    supabase
      .from("fetch_runs")
      .select("finished_at")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const articles = (rows ?? []).map(toArticle);
  const dayAgo = Date.now() - 24 * HOUR;
  const lastDay = articles.filter((a) => new Date(a.published_at).getTime() > dayAgo);

  // Lead: the highest-scoring story with a picture from the last day.
  const lead = [...lastDay].sort((a, b) => b.score - a.score).find((a) => a.image) ?? articles[0] ?? null;
  const breaking = lastDay.filter((a) => a.is_breaking && a.id !== lead?.id).slice(0, 8);
  const shown = new Set([lead?.id, ...breaking.map((a) => a.id)]);

  const sections = FEED_CATEGORIES.map((c) => ({
    slug: c.slug,
    articles: articles.filter((a) => a.category === c.slug && !shown.has(a.id)).slice(0, 5),
  })).filter((s) => s.articles.length > 0);

  return { configured: true, lead, breaking, sections, updatedAt: run?.finished_at ?? null };
}

export async function getCategoryArticles(slug: CategorySlug): Promise<{ configured: boolean; articles: Article[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag(ARTICLES_TAG);

  if (!isSupabaseConfigured()) return { configured: false, articles: [] };

  let query = getSupabase().from("articles").select(COLUMNS).order("published_at", { ascending: false }).limit(60);
  query = slug === "breaking" ? query.eq("is_breaking", true) : query.eq("category", slug);
  const { data } = await query;
  return { configured: true, articles: (data ?? []).map(toArticle) };
}
