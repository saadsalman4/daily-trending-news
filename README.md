# Daily Brief

**Stay on top of world news without social media.**

If you're not on social media, you hear about big events (a bombing, a plane incident, a war escalating) days later, from a friend. Daily Brief fixes that. Twice a day it reads about 45 trusted news feeds, works out which stories really matter, and pushes them to your phone.

## Features

- 📰 **One clean feed** from BBC, The Guardian, Al Jazeera, Dawn, Geo News, Express Tribune, The National, Gulf News, NPR, CNBC, Politico, The Verge, Ars Technica, Simple Flying, FlightGlobal, STAT, Space.com, TMZ, E! News, Variety and more
- 🚨 **Breaking-news detection.** Attacks, crashes, disasters, and stories that several outlets are covering at once are flagged automatically.
- 🔔 **Push notifications** to iPhone and Android with no app store involved. You get an alert for each major incident plus a short brief at 8 AM and 8 PM (PKT). Pakistan and Celebrity briefs are optional extras you can switch on separately.
- 🗂️ **12 sections:** Breaking & Major Incidents · World · Middle East & Gulf · Pakistan · Politics · Business & Economy · Aviation & Travel · Technology · AI · Science & Space · Health · Celebrity & Entertainment
- 🖼️ **Articles and images are stored** in your own database, so the feed loads fast and doesn't depend on publishers' image links.
- 📱 **Installable** as a home-screen app (PWA), with light and dark mode.
- 💸 **Runs free** on the Vercel Hobby and Supabase Free plans.

## Tech stack

| Layer | Tech |
| --- | --- |
| App | [Next.js 16](https://nextjs.org) (App Router, Cache Components), React 19, Tailwind CSS 4 |
| Hosting & scheduling | [Vercel](https://vercel.com) + Vercel Cron |
| Database & image storage | [Supabase](https://supabase.com) (Postgres + Storage) |
| Notifications | Web Push (VAPID) via [`web-push`](https://github.com/web-push-libs/web-push) and a service worker |
| News sources | Public RSS feeds via [`rss-parser`](https://github.com/rbren/rss-parser) |

## Project structure

```
src/
  app/
    page.tsx                    home: lead story, breaking strip, one row per section
    category/[slug]/page.tsx    full section pages
    settings/page.tsx           notification settings ("Alerts")
    api/cron/fetch-news/        the twice-daily ingest job
    api/push/                   subscribe / preferences / test notification
  components/                   article cards, nav, notification settings UI
  lib/
    categories.ts               sections + RSS feed list
    ingest/                     feed parsing, breaking-news scoring, image mirroring, run orchestration
    push.ts                     web push sending
    articles.ts                 cached database queries for the pages
public/sw.js                    service worker (shows notifications, opens stories)
supabase/schema.sql             tables + storage bucket
vercel.json                     cron schedule
```

## How it works

```
Vercel Cron (08:00 + 20:00 PKT)
   └─► GET /api/cron/fetch-news
         1. fetch every feed in src/lib/categories.ts
         2. skip URLs already stored
         3. score each headline (severity keywords + how many outlets cover it)
         4. find missing images (og:image) and copy them into Supabase Storage
         5. insert into Postgres, refresh the site cache
         6. push: one alert per breaking story (max 4), then a short brief
         7. delete articles/images older than RETENTION_DAYS
```

- **Breaking detection** (`src/lib/ingest/scoring.ts`): a headline scores points for words like *killed, explosion, missile, crash, emergency landing, earthquake, airspace closed*, and more points when several outlets run the same story. Hard-news sections (World, Middle East, Aviation) get a boost, while Tech, AI and Science get a penalty. A score of 7 or more marks it as breaking.
- **Push** uses the standard Web Push API (VAPID). There's no app-store app: it works in Chrome/Edge/Firefox, on Android, and on **iPhone (iOS 16.4+) once the site is added to the Home Screen**.

## Setup (about 15 minutes)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables and the public `article-images` storage bucket.
3. From **Project Settings → API**, copy the Project URL and the `service_role` key.

### 2. Keys
```bash
npx web-push generate-vapid-keys
```
Also make up a long random `CRON_SECRET` (for example, the output of `openssl rand -hex 32`).

### 3. Deploy to Vercel
1. Push this repo to GitHub and import it in [Vercel](https://vercel.com/new).
2. Add the env vars from [`.env.example`](.env.example) (Production + Preview).
3. Deploy. The cron jobs in [`vercel.json`](vercel.json) register automatically.

### 4. Fill it and turn on alerts
Run the first fetch right away instead of waiting for the cron:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/fetch-news
```
Then on your phone:
- **iPhone:** open the site in Safari → Share → **Add to Home Screen** → open it from the Home Screen → **Alerts** → *Turn on notifications* → *Send test notification*.
- **Android:** open in Chrome → **Alerts** → *Turn on notifications*. Installing it via "Add to Home screen" is optional but recommended.

## Local development
```bash
cp .env.example .env.local   # fill in values
npm run dev
```
Push notifications need HTTPS. Use `npx next dev --experimental-https` to test them locally.

## Customizing
- **Feeds / sections:** `src/lib/categories.ts`
- **What counts as breaking:** `src/lib/ingest/scoring.ts` (`SEVERE` keywords, `BREAKING_THRESHOLD`)
- **Schedule:** `vercel.json`. Times are UTC: `0 3` = 08:00 PKT and `0 15` = 20:00 PKT (UTC+5). On the Hobby plan each cron job runs at most once a day and may fire any time within that hour, which is why there are two jobs instead of one `*/12` job.
- **Max breaking alerts per run:** `MAX_BREAKING_PUSHES` in `src/lib/ingest/run.ts`

## Storage budget
Each run stores roughly 100–250 new articles with images. The default 14-day retention keeps image storage at a few hundred MB, well within Supabase's free 1 GB.
