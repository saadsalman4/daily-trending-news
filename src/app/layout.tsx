import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import Link from "next/link";
import { CategoryNav } from "@/components/category-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "Daily Brief", template: "%s · Daily Brief" },
  description: "World news twice a day, with alerts for the stories you can't miss.",
  appleWebApp: { capable: true, title: "Daily Brief", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${newsreader.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight">Daily Brief</span>
              <span className="live-dot mt-1 size-2 rounded-full bg-accent" aria-hidden />
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              <BellIcon />
              <span className="hidden sm:inline">Alerts</span>
            </Link>
          </div>
          <CategoryNav />
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-6 sm:px-6">{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
