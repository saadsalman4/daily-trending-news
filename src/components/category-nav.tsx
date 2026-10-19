"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

const ITEMS = [{ href: "/", label: "Top" }, ...CATEGORIES.map((c) => ({ href: `/category/${c.slug}`, label: c.short }))];

export function CategoryNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2.5 sm:px-6" aria-label="Sections">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        const breaking = item.href.endsWith("/breaking");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition ${
              active
                ? breaking
                  ? "bg-accent text-white"
                  : "bg-ink text-bg"
                : breaking
                  ? "text-accent hover:bg-accent-soft"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
