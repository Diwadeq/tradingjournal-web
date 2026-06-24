"use client";

import { useEffect, useState, useCallback } from "react";
import { TAX_NEWS } from "@/lib/content";
import { fetchTaxNews, type NewsItem } from "@/lib/fetch-news";

type Status = "loading" | "success" | "error";

export function TaxNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const loadNews = useCallback(async () => {
    setStatus("loading");
    try {
      const news = await fetchTaxNews();
      setItems(news);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  return (
    <section id="tax-news" className="section bg-white">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="section-heading">{TAX_NEWS.heading}</h2>
        <p className="section-subheading">{TAX_NEWS.subheading}</p>

        {status === "loading" && <LoadingSkeleton />}
        {status === "error" && <ErrorState onRetry={loadNews} />}
        {status === "success" && items.length === 0 && <EmptyState />}
        {status === "success" && items.length > 0 && <NewsList items={items} />}
      </div>
    </section>
  );
}

function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div className="grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.link}
          className="flex flex-col rounded-xl border border-border bg-white p-6 transition-shadow hover:shadow-md"
        >
          <time className="mb-2 text-xs font-medium text-accent">
            {formatDate(item.pubDate)}
          </time>

          <h3 className="mb-3 line-clamp-2 text-base font-semibold text-text-heading">
            {item.title}
          </h3>

          <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-text-body">
            {item.description}
          </p>

          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {TAX_NEWS.readMoreLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        </article>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border p-6"
        >
          <div className="mb-3 h-3 w-24 rounded bg-gray-200" />
          <div className="mb-2 h-5 w-full rounded bg-gray-200" />
          <div className="mb-4 h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-100" />
          <div className="mt-2 h-4 w-2/3 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-8 py-12">
      <p className="mb-4 text-text-body">{TAX_NEWS.errorMessage}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
      >
        {TAX_NEWS.retryLabel}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border px-8 py-12">
      <p className="text-text-muted">{TAX_NEWS.emptyMessage}</p>
    </div>
  );
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
