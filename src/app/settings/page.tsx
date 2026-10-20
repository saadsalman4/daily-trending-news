import type { Metadata } from "next";
import { NotificationSettings } from "@/components/notification-settings";

export const metadata: Metadata = { title: "Alerts" };

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="border-b-2 border-ink pb-3">
        <h1 className="font-serif text-4xl font-bold">Alerts</h1>
        <p className="mt-1 text-muted">Push notifications for this device. Turn them on separately on each phone or computer you use.</p>
      </header>
      <NotificationSettings />
      <section className="text-sm text-muted">
        <h2 className="mb-1 font-semibold text-ink">How it works</h2>
        <p>
          News is collected from BBC, The Guardian, Al Jazeera, Dawn, Geo News, The National, Gulf News, NPR, CNBC, Politico, The Verge, TMZ and others
          twice a day. Stories with severe keywords or covered by several outlets at once are flagged as breaking, and those trigger an alert.
        </p>
      </section>
    </div>
  );
}
