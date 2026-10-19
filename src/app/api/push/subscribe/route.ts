import { isAllowedEndpoint } from "@/lib/push";
import { getSupabase } from "@/lib/supabase";

type Body = {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  endpoint?: unknown;
  notify_breaking?: unknown;
  notify_digest?: unknown;
};

function str(v: unknown, max = 600): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    return (await request.json()) as Body;
  } catch {
    return null;
  }
}

function prefs(body: Body) {
  return {
    ...(typeof body.notify_breaking === "boolean" ? { notify_breaking: body.notify_breaking } : {}),
    ...(typeof body.notify_digest === "boolean" ? { notify_digest: body.notify_digest } : {}),
  };
}

/** Save (or refresh) a browser's push subscription. */
export async function POST(request: Request) {
  const body = await readBody(request);
  const sub = body?.subscription;
  if (!body || !sub || !str(sub.endpoint, 1000) || !str(sub.keys?.p256dh, 200) || !str(sub.keys?.auth, 100)) {
    return Response.json({ error: "invalid subscription" }, { status: 400 });
  }
  if (!isAllowedEndpoint(sub.endpoint)) {
    return Response.json({ error: "unsupported push service" }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: sub.endpoint,
        p256dh: sub.keys!.p256dh,
        auth: sub.keys!.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        ...prefs(body),
      },
      { onConflict: "endpoint" },
    );
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

/** Read this browser's notification preferences. */
export async function PUT(request: Request) {
  const body = await readBody(request);
  if (!body || !str(body.endpoint, 1000)) return Response.json({ error: "endpoint required" }, { status: 400 });
  const { data, error } = await getSupabase()
    .from("push_subscriptions")
    .select("notify_breaking, notify_digest")
    .eq("endpoint", body.endpoint)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ subscribed: Boolean(data), ...data });
}

/** Update preferences for an existing subscription. */
export async function PATCH(request: Request) {
  const body = await readBody(request);
  if (!body || !str(body.endpoint, 1000)) return Response.json({ error: "endpoint required" }, { status: 400 });
  const { error } = await getSupabase().from("push_subscriptions").update(prefs(body)).eq("endpoint", body.endpoint);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await readBody(request);
  if (!body || !str(body.endpoint, 1000)) return Response.json({ error: "endpoint required" }, { status: 400 });
  await getSupabase().from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return Response.json({ ok: true });
}
