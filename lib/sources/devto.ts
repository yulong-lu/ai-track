import type { RawItem } from './types';

const DEVTO_URL = 'https://dev.to/api/articles?tag=ai&top=7&per_page=7';

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  published_at: string;
  description: string;
  positive_reactions_count: number;
}

export async function fetchDevTo(): Promise<RawItem[]> {
  const res = await fetch(DEVTO_URL);
  if (!res.ok) throw new Error(`Dev.to fetch failed: ${res.status}`);

  const articles: DevToArticle[] = await res.json();

  return articles.map(a => ({
    id: a.url,
    source: 'devto' as const,
    sourceLabel: 'Dev.to',
    title: a.title,
    url: a.url,
    publishedAt: a.published_at,
    excerpt: a.description || undefined,
    nativeScore: a.positive_reactions_count,
  }));
}
