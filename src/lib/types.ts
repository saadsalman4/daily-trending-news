import type { CategorySlug } from "./categories";

export type ArticleRow = {
  id: string;
  url: string;
  title: string;
  summary: string | null;
  source: string;
  category: Exclude<CategorySlug, "breaking">;
  image_url: string | null;
  image_path: string | null;
  published_at: string;
  fetched_at: string;
  score: number;
  is_breaking: boolean;
  notified_at: string | null;
};

/** What the UI renders: the row plus a resolved image URL. */
export type Article = Pick<
  ArticleRow,
  "id" | "url" | "title" | "summary" | "source" | "category" | "published_at" | "is_breaking" | "score"
> & { image: string | null };

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  notify_breaking: boolean;
  notify_digest: boolean;
};
