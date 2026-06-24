import { TAX_NEWS } from "./content";

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

/**
 * Fetches tax news from an RSS feed via rss2json proxy.
 * Swap this function body if you move to your own backend.
 */
export async function fetchTaxNews(): Promise<NewsItem[]> {
  const proxyUrl = "https://api.rss2json.com/v1/api.json";
  const url = `${proxyUrl}?rss_url=${encodeURIComponent(TAX_NEWS.feedUrl)}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error("RSS feed returned a non-ok status");
  }

  return data.items.slice(0, TAX_NEWS.maxItems).map((item: NewsItem) => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    description: stripHtml(item.description).slice(0, 160),
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
