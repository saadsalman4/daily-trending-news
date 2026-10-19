"use client";

import { useEffect, useState } from "react";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";
type Prefs = { notify_breaking: boolean; notify_digest: boolean };

const DEFAULT_PREFS: Prefs = { notify_breaking: true, notify_digest: true };

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function api(method: string, path: string, body: unknown) {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function detectEnvironment(): Status | null {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIOS && !standalone ? "ios-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return null;
}

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      const env = detectEnvironment();
      if (env) {
        if (!cancelled) setStatus(env);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        if (!cancelled) setStatus("off");
        return;
      }
      try {
        const saved = await api("PUT", "/api/push/subscribe", { endpoint: sub.endpoint });
        if (!saved.subscribed) {
          // The browser still has a subscription but the server lost it: re-register it.
          await api("POST", "/api/push/subscribe", { subscription: sub.toJSON(), ...DEFAULT_PREFS });
        }
        if (cancelled) return;
        setPrefs(saved.subscribed ? { notify_breaking: saved.notify_breaking, notify_digest: saved.notify_digest } : DEFAULT_PREFS);
        setSubscription(sub);
        setStatus("on");
      } catch (e) {
        if (!cancelled) {
          setStatus("off");
          setMessage({ kind: "error", text: (e as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const enable = () =>
    run(async () => {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set on the server.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      await api("POST", "/api/push/subscribe", { subscription: sub.toJSON(), ...prefs });
      setSubscription(sub);
      setStatus("on");
      setMessage({ kind: "ok", text: "Notifications are on. Send a test to make sure they arrive." });
    });

  const disable = () =>
    run(async () => {
      if (!subscription) return;
      await api("DELETE", "/api/push/subscribe", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
      setStatus("off");
    });

  const togglePref = (key: keyof Prefs) =>
    run(async () => {
      if (!subscription) return;
      const next = { ...prefs, [key]: !prefs[key] };
      setPrefs(next);
      try {
        await api("PATCH", "/api/push/subscribe", { endpoint: subscription.endpoint, ...next });
      } catch (e) {
        setPrefs(prefs);
        throw e;
      }
    });

  const sendTest = () =>
    run(async () => {
      if (!subscription) return;
      await api("POST", "/api/push/test", { endpoint: subscription.endpoint });
      setMessage({ kind: "ok", text: "Test sent. It should appear in a few seconds." });
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        {status === "loading" && <p className="text-muted">Checking this device…</p>}

        {status === "ios-install" && <IosInstallSteps />}

        {status === "unsupported" && (
          <p className="text-muted">This browser doesn&apos;t support push notifications. Try Chrome, Edge, Firefox or Safari.</p>
        )}

        {status === "denied" && (
          <div className="space-y-2">
            <p className="font-semibold">Notifications are blocked for this site.</p>
            <p className="text-sm text-muted">
              Allow them in your browser or phone settings (Settings → Notifications → Daily Brief on iPhone; site settings in Chrome),
              then reload this page.
            </p>
          </div>
        )}

        {status === "off" && (
          <div className="flex flex-col items-start gap-4">
            <div>
              <p className="font-semibold">Notifications are off on this device</p>
              <p className="mt-1 text-sm text-muted">Get an alert when something major happens, plus a short brief twice a day.</p>
            </div>
            <button onClick={enable} disabled={busy} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60">
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          </div>
        )}

        {status === "on" && (
          <div className="flex flex-col gap-5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="size-2 rounded-full bg-green-500" aria-hidden /> Notifications are on for this device
            </p>
            <Toggle
              label="Breaking & major incidents"
              hint="Attacks, crashes, disasters and stories every outlet is covering. Up to 4 per run."
              checked={prefs.notify_breaking}
              disabled={busy}
              onChange={() => togglePref("notify_breaking")}
            />
            <Toggle
              label="Twice-daily brief"
              hint="A summary of the top headlines at about 8:00 and 20:00 (Pakistan time)."
              checked={prefs.notify_digest}
              disabled={busy}
              onChange={() => togglePref("notify_digest")}
            />
            <div className="flex flex-wrap gap-3">
              <button onClick={sendTest} disabled={busy} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-60">
                Send test notification
              </button>
              <button onClick={disable} disabled={busy} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-60">
                Turn off
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role="status" className={`mt-4 text-sm ${message.kind === "error" ? "text-accent" : "text-muted"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function Toggle(props: { label: string; hint: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-medium">{props.label}</span>
        <span className="block text-sm text-muted">{props.hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={props.checked} disabled={props.disabled} onChange={props.onChange} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-surface-2 ring-1 ring-line transition peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function IosInstallSteps() {
  return (
    <div className="space-y-3">
      <p className="font-semibold">On iPhone, add Daily Brief to your Home Screen first</p>
      <p className="text-sm text-muted">Apple only allows notifications for web apps opened from the Home Screen.</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>
          Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
        </li>
        <li>
          Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
        </li>
        <li>Open Daily Brief from your Home Screen and come back to this page.</li>
      </ol>
    </div>
  );
}
