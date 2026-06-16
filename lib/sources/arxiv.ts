import Parser from 'rss-parser';
import type { RawItem } from './types';

const ARXIV_RSS = 'https://rss.arxiv.org/rss/cs.AI';
const LIMIT = 15;

const parser = new Parser();

export async function fetchArXiv(): Promise<RawItem[]> {
  const res = await fetch(ARXIV_RSS);
  if (!res.ok) throw new Error(`arXiv RSS failed: ${res.status}`);

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).slice(0, LIMIT).map(item => {
    // Strip arXiv ID prefix: "[2506.12345] Title" → "Title"
    const title = (item.title ?? '').replace(/^\[\d+\.\d+\]\s*/, '').trim();
    const url = item.link ?? '';
    const excerpt = item.content
      ? item.content.replace(/<[^>]+>/g, '').slice(0, 500)
      : item.contentSnippet?.slice(0, 500);

    return {
      id: url,
      source: 'arxiv' as const,
      sourceLabel: 'arXiv',
      title,
      url,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      excerpt,
    };
  });
}
