import "server-only";
import webpush, { WebPushError } from "web-push";
import { getSupabase } from "./supabase";
import type { PushSubscriptionRow } from "./types";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  image?: string | null;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
};

let configured = false;

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  if (!isPushConfigured()) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

// Only accept endpoints on real browser push services, so the subscribe API can't be
// used to make this server POST to arbitrary URLs.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
];

export function isAllowedEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Sends to each subscription; prunes ones the push service says are gone. */
export async function sendPush(subs: PushSubscriptionRow[], payload: PushPayload) {
  if (!subs.length) return { sent: 0, failed: 0 };
  configure();
  const supabase = getSupabase();
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const ok: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          TTL: 12 * 60 * 60,
          urgency: payload.tag?.startsWith("breaking") ? "high" : "normal",
        });
        sent++;
        ok.push(s.endpoint);
      } catch (e) {
        failed++;
        if (e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
        else console.error("push failed", s.endpoint.slice(0, 60), e);
      }
    }),
  );

  if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
  if (ok.length) {
    await supabase.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).in("endpoint", ok);
  }
  return { sent, failed };
}
