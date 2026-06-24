import { TAX_NEWS } from "./content";

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

const RSS_PROXY = "https://api.rss2json.com/v1/api.json";

/**
 * Fetches tax/accounting news from multiple RSS feeds, merges them,
 * and returns the most recent items sorted by date.
 *
 * Each feed is fetched independently — if one fails, the others still show.
 * Swap this function if you move to your own backend or API.
 */
export async function fetchTaxNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    TAX_NEWS.feeds.map((feed) => fetchSingleFeed(feed.url, feed.label))
  );

  const allItems = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  if (allItems.length === 0) {
    const anyFailed = results.some((r) => r.status === "rejected");
    if (anyFailed) throw new Error("All feeds failed to load");
  }

  allItems.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return allItems.slice(0, TAX_NEWS.maxItems);
}

async function fetchSingleFeed(
  feedUrl: string,
  sourceLabel: string
): Promise<NewsItem[]> {
  const url = `${RSS_PROXY}?rss_url=${encodeURIComponent(feedUrl)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error(`Feed "${sourceLabel}" returned non-ok status`);
  }

  return data.items.map(
    (item: { title: string; link: string; pubDate: string; description: string }) => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      description: stripHtml(item.description).slice(0, 180),
      source: sourceLabel,
    })
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
