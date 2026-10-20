import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArticleCard, ArticleRowItem, EmptyState } from "@/components/article-card";
import { getCategoryArticles } from "@/lib/articles";
import { CATEGORIES, getCategory } from "@/lib/categories";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return { title: category?.name ?? "Not found" };
}

// Params are read inside Suspense so navigating between sections shows the skeleton instantly.
export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

function CategorySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden>
      <div className="border-b-2 border-ink pb-3">
        <div className="h-10 w-48 rounded bg-surface-2" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-surface-2" />
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[16/10] rounded-lg bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

async function CategoryContent({ params }: Pick<PageProps<"/category/[slug]">, "params">) {
  const category = getCategory((await params).slug);
  if (!category) notFound();

  const { configured, articles } = await getCategoryArticles(category.slug);
  const isBreaking = category.slug === "breaking";
  const top = articles.slice(0, 3);
  const rest = articles.slice(3);

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b-2 border-ink pb-3">
        <h1 className={`font-serif text-4xl font-bold ${isBreaking ? "text-accent" : ""}`}>{category.name}</h1>
        <p className="mt-1 text-muted">{category.description}</p>
      </header>

      {articles.length === 0 ? (
        <EmptyState configured={configured} />
      ) : (
        <>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((a) => (
              <ArticleCard key={a.id} article={a} showCategory={isBreaking} />
            ))}
          </div>
          {rest.length > 0 && (
            <div className="grid md:grid-cols-2 md:gap-x-10">
              {rest.map((a) => (
                <ArticleRowItem key={a.id} article={a} showCategory={isBreaking} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
