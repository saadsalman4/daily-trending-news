/* eslint-disable @next/next/no-img-element -- publisher/Storage images vary in host and size; plain <img> avoids image-optimization quota */
import { getCategory } from "@/lib/categories";
import type { Article } from "@/lib/types";
import { TimeAgo } from "./time-ago";

function Meta({ article, showCategory }: { article: Article; showCategory?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {article.is_breaking && (
        <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Breaking</span>
      )}
      {showCategory && <span className="font-semibold uppercase tracking-wider text-ink/80">{getCategory(article.category)?.short}</span>}
      <span>{article.source}</span>
      <span aria-hidden>·</span>
      <TimeAgo iso={article.published_at} />
    </div>
  );
}

function Thumb({ src, className }: { src: string | null; className: string }) {
  if (!src) return <div className={`${className} bg-surface-2`} aria-hidden />;
  return <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className={`${className} bg-surface-2 object-cover`} />;
}

const linkProps = { target: "_blank", rel: "noopener noreferrer" } as const;

export function LeadStory({ article }: { article: Article }) {
  return (
    <a href={article.url} {...linkProps} className="group grid gap-4 md:grid-cols-[1.4fr_1fr] md:gap-6">
      <Thumb src={article.image} className="aspect-[16/9] w-full rounded-xl" />
      <div className="flex flex-col justify-center gap-3">
        <Meta article={article} showCategory />
        <h2 className="font-serif text-3xl font-semibold leading-tight text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 md:text-4xl">
          {article.title}
        </h2>
        {article.summary && <p className="line-clamp-4 text-base leading-relaxed text-muted">{article.summary}</p>}
      </div>
    </a>
  );
}

export function ArticleCard({ article, showCategory }: { article: Article; showCategory?: boolean }) {
  return (
    <a href={article.url} {...linkProps} className="group flex flex-col gap-3">
      <Thumb src={article.image} className="aspect-[16/10] w-full rounded-lg" />
      <Meta article={article} showCategory={showCategory} />
      <h3 className="font-serif text-lg font-semibold leading-snug text-pretty group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
        {article.title}
      </h3>
      {article.summary && <p className="line-clamp-2 text-sm leading-relaxed text-muted">{article.summary}</p>}
    </a>
  );
}

export function ArticleRowItem({ article, showCategory }: { article: Article; showCategory?: boolean }) {
  return (
    <a href={article.url} {...linkProps} className="group flex gap-4 border-t border-line py-4 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Meta article={article} showCategory={showCategory} />
        <h3 className="font-serif text-base font-semibold leading-snug text-pretty group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-lg">
          {article.title}
        </h3>
        {article.summary && <p className="line-clamp-2 hidden text-sm text-muted sm:block">{article.summary}</p>}
      </div>
      <Thumb src={article.image} className="aspect-square w-20 shrink-0 rounded-md sm:aspect-[4/3] sm:w-32" />
    </a>
  );
}

export function EmptyState({ configured }: { configured: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
      {configured ? (
        <>
          <p className="font-serif text-xl font-semibold">No stories yet</p>
          <p className="mt-2 text-sm text-muted">News is fetched at 8:00 and 20:00 (Pakistan time). Trigger a fetch manually to fill it now.</p>
        </>
      ) : (
        <>
          <p className="font-serif text-xl font-semibold">Database not connected</p>
          <p className="mt-2 text-sm text-muted">
            Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>, then follow the README setup steps.
          </p>
        </>
      )}
    </div>
  );
}
