-- Daily Brief schema. Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- All access goes through the Next.js server using the service-role key, so RLS is
-- enabled with no policies: the public anon key can't read or write anything.

create extension if not exists pgcrypto;

-- ─── Articles ────────────────────────────────────────────────────────────────
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  title         text not null,
  summary       text,
  source        text not null,
  category      text not null,
  image_url     text,          -- original image URL from the publisher
  image_path    text,          -- mirrored copy in the article-images bucket
  published_at  timestamptz not null,
  fetched_at    timestamptz not null default now(),
  score         integer not null default 0,
  is_breaking   boolean not null default false,
  notified_at   timestamptz
);

create index if not exists articles_category_published_idx
  on public.articles (category, published_at desc);
create index if not exists articles_breaking_published_idx
  on public.articles (published_at desc) where is_breaking;
create index if not exists articles_published_idx
  on public.articles (published_at desc);

alter table public.articles enable row level security;

-- ─── Push subscriptions ──────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint        text primary key,
  p256dh          text not null,
  auth            text not null,
  notify_breaking boolean not null default true,
  notify_digest   boolean not null default true,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);

alter table public.push_subscriptions enable row level security;

-- ─── Fetch run log ───────────────────────────────────────────────────────────
create table if not exists public.fetch_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  inserted      integer not null default 0,
  breaking      integer not null default 0,
  notifications integer not null default 0,
  errors        jsonb not null default '[]'::jsonb
);

alter table public.fetch_runs enable row level security;

-- ─── Image storage ───────────────────────────────────────────────────────────
-- Public bucket so <img> tags can load mirrored images directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-images', 'article-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;
