import type { RawItem } from './types';

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const LIMIT = 10;

interface HNItem {
  id: number;
  type: string;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  text?: string;
  deleted?: boolean;
  dead?: boolean;
}

export async function fetchHackerNews(): Promise<RawItem[]> {
  const res = await fetch(`${HN_API}/topstories.json`);
  if (!res.ok) throw new Error(`HN topstories failed: ${res.status}`);

  const ids: number[] = await res.json();
  const top = ids.slice(0, LIMIT);

  const items = await Promise.all(
    top.map(id =>
      fetch(`${HN_API}/item/${id}.json`).then(r => r.json() as Promise<HNItem>)
    )
  );

  return items
    .filter(item => item && !item.deleted && !item.dead && item.title)
    .map(item => {
      const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
      return {
        id: url,
        source: 'hn' as const,
        sourceLabel: 'HN',
        title: item.title!,
        url,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
        excerpt: item.text ? item.text.replace(/<[^>]+>/g, '').slice(0, 500) : undefined,
        nativeScore: item.score,
      };
    });
}
