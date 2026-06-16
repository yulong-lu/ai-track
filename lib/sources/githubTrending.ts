import { parse } from 'node-html-parser';
import type { RawItem } from './types';

const TRENDING_URL = 'https://github.com/trending?since=daily';
const LIMIT = 10;

export async function fetchGitHubTrending(): Promise<RawItem[]> {
  const res = await fetch(TRENDING_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`GitHub trending failed: ${res.status}`);

  const html = await res.text();
  const root = parse(html);
  const articles = root.querySelectorAll('article.Box-row');
  const items: RawItem[] = [];

  for (const article of articles.slice(0, LIMIT)) {
    try {
      const linkEl = article.querySelector('h2 a');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href')?.replace(/^\//, '').trim();
      if (!href || !href.includes('/')) continue;

      // Normalize "owner / repo" display text to "owner/repo"
      const repoPath = href.split('/').slice(0, 2).join('/');
      const url = `https://github.com/${repoPath}`;
      const title = repoPath;
      const desc = article.querySelector('p')?.text.trim() ?? '';

      const starsMatch = article.text.match(/([\d,]+)\s+stars/);
      const nativeScore = starsMatch
        ? parseInt(starsMatch[1].replace(/,/g, ''), 10)
        : undefined;

      items.push({
        id: url,
        source: 'github' as const,
        sourceLabel: 'GitHub',
        title,
        url,
        publishedAt: new Date().toISOString(),
        excerpt: desc || undefined,
        nativeScore,
      });
    } catch (err) {
      console.error('Failed to parse GitHub trending item:', err);
    }
  }

  return items;
}
