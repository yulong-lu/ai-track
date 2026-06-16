import { fetchHackerNews } from './hackerNews';
import { fetchGitHubTrending } from './githubTrending';
import { fetchDevTo } from './devto';
import { fetchArXiv } from './arxiv';
import { fetchBlogs } from './blogs';
import type { RawItem } from './types';

const SOURCE_NAMES = ['HackerNews', 'GitHubTrending', 'DevTo', 'ArXiv', 'Blogs'] as const;

export async function aggregateAllSources(): Promise<RawItem[]> {
  const results = await Promise.allSettled([
    fetchHackerNews(),
    fetchGitHubTrending(),
    fetchDevTo(),
    fetchArXiv(),
    fetchBlogs(),
  ]);

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`Source ${SOURCE_NAMES[i]} failed:`, result.reason);
    return [];
  });
}
