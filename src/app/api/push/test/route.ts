import { isPushConfigured, sendPush } from "@/lib/push";
import { getSupabase } from "@/lib/supabase";
import { SUBSCRIPTION_COLUMNS, type PushSubscriptionRow } from "@/lib/types";

/** Sends a test notification to the calling browser's own subscription only. */
export async function POST(request: Request) {
  if (!isPushConfigured()) return Response.json({ error: "VAPID keys are not configured" }, { status: 500 });

  let endpoint: unknown;
  try {
    ({ endpoint } = await request.json());
  } catch {}
  if (typeof endpoint !== "string") return Response.json({ error: "endpoint required" }, { status: 400 });

  const { data } = await getSupabase()
    .from("push_subscriptions")
    .select(SUBSCRIPTION_COLUMNS)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (!data) return Response.json({ error: "subscription not found" }, { status: 404 });

  const res = await sendPush([data as unknown as PushSubscriptionRow], {
    title: "✅ Notifications are working",
    body: "You'll get breaking news alerts and a brief twice a day.",
    url: "/",
    tag: "test",
  });
  return Response.json(res, { status: res.sent ? 200 : 502 });
}
