"use client";

import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE);
  return () => clearInterval(id);
}
// Floored to the minute so the snapshot is stable between ticks.
const getMinute = () => Math.floor(Date.now() / MINUTE);
const getServerMinute = () => null;

export function formatAgo(iso: string, nowMinute: number) {
  const mins = Math.max(0, nowMinute - Math.floor(new Date(iso).getTime() / MINUTE));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Relative time rendered on the client only, so cached server HTML never shows a stale "5m ago". */
export function TimeAgo({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const now = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {now === null ? "" : `${prefix}${formatAgo(iso, now)}`}
    </time>
  );
}
