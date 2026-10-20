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

export const PREF_KEYS = ["notify_breaking", "notify_digest", "notify_pakistan", "notify_entertainment"] as const;
export type PrefKey = (typeof PREF_KEYS)[number];
export type Prefs = Record<PrefKey, boolean>;

export const DEFAULT_PREFS: Prefs = {
  notify_breaking: true,
  notify_digest: true,
  notify_pakistan: false,
  notify_entertainment: false,
};

export type PushSubscriptionRow = Prefs & {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export const SUBSCRIPTION_COLUMNS = ["endpoint", "p256dh", "auth", ...PREF_KEYS].join(", ");
