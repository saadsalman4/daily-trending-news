import Link from "next/link";
import { ArticleCard, ArticleRowItem, EmptyState, LeadStory } from "@/components/article-card";
import { TimeAgo } from "@/components/time-ago";
import { getHomeData } from "@/lib/articles";
import { getCategory } from "@/lib/categories";

export default async function HomePage() {
  const { configured, lead, breaking, sections, updatedAt } = await getHomeData();

  if (!lead) return <EmptyState configured={configured} />;

  return (
    <div className="flex flex-col gap-12">
      {updatedAt && (
        <p className="-mb-8 text-xs text-muted">
          <TimeAgo iso={updatedAt} prefix="Updated " />
        </p>
      )}

      <LeadStory article={lead} />

      {breaking.length > 0 && (
        <section aria-labelledby="breaking-heading" className="rounded-xl border border-accent/30 bg-accent-soft/40 p-4 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="breaking-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent sm:text-sm">
              <span className="live-dot size-2 shrink-0 rounded-full bg-accent" aria-hidden />
              Breaking & major incidents
            </h2>
            <Link href="/category/breaking" className="shrink-0 text-sm text-muted hover:text-ink">
              All →
            </Link>
          </div>
          <div className="grid md:grid-cols-2 md:gap-x-8">
            {breaking.map((a) => (
              <ArticleRowItem key={a.id} article={a} showCategory />
            ))}
          </div>
        </section>
      )}

      {sections.map(({ slug, articles }) => {
        const category = getCategory(slug)!;
        const [first, ...rest] = articles;
        return (
          <section key={slug} aria-labelledby={`${slug}-heading`}>
            <div className="mb-4 flex items-baseline justify-between border-b-2 border-ink pb-2">
              <h2 id={`${slug}-heading`} className="font-serif text-2xl font-bold">
                {category.name}
              </h2>
              <Link href={`/category/${slug}`} className="text-sm text-muted hover:text-ink">
                More →
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:gap-8">
              <ArticleCard article={first} />
              <div>
                {rest.map((a) => (
                  <ArticleRowItem key={a.id} article={a} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
