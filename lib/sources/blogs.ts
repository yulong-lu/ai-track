import Parser from 'rss-parser';
import type { RawItem } from './types';

const ITEMS_PER_FEED = 3;

const FEED_SOURCES = [
  { url: 'https://www.anthropic.com/news/rss.xml', label: 'Anthropic' },
  { url: 'https://openai.com/blog/rss.xml', label: 'OpenAI' },
  { url: 'https://newsletter.importai.net/feed', label: 'Import AI' },
  { url: 'https://www.deeplearning.ai/the-batch/rss', label: 'The Batch' },
  { url: 'https://interconnects.ai/feed', label: 'Interconnects' },
] as const;

const parser = new Parser();

async function fetchFeed(url: string, label: string): Promise<RawItem[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blog feed ${label} failed: ${res.status}`);

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).slice(0, ITEMS_PER_FEED).map(item => {
    const itemUrl = item.link ?? '';
    return {
      id: itemUrl,
      source: 'blog' as const,
      sourceLabel: label,
      title: item.title ?? '(untitled)',
      url: itemUrl,
      publishedAt: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
      excerpt: item.contentSnippet?.slice(0, 500) || item.content?.replace(/<[^>]+>/g, '').slice(0, 500),
    };
  });
}

export async function fetchBlogs(): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(s => fetchFeed(s.url, s.label))
  );

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`Blog feed "${FEED_SOURCES[i].label}" failed:`, result.reason);
    return [];
  });
}
