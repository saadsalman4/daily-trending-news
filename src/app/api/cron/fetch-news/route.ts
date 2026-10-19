import { runIngest } from "@/lib/ingest/run";
import { isSupabaseConfigured } from "@/lib/supabase";

// Vercel Hobby allows up to 300s with Fluid Compute.
export const maxDuration = 300;

// Called by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
// Trigger it manually with:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/fetch-news
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return Response.json({ error: "Supabase env vars are missing" }, { status: 500 });
  }

  const notify = new URL(request.url).searchParams.get("notify") !== "0";
  const result = await runIngest({ budgetMs: (maxDuration - 30) * 1000, notify });
  return Response.json(result);
}
