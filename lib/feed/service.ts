import 'server-only';
import { readFeed } from '@/lib/cache/blobStore';
import { refreshFeed } from '@/lib/feed/refresh';
import { REFRESH_INTERVAL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

export interface FeedResult {
  feed: CachedFeed;
  stale: boolean;
}

export async function getFeed(): Promise<FeedResult> {
  const cached = await readFeed();

  if (!cached) {
    // Cold start: block until first refresh completes
    await refreshFeed();
    const fresh = await readFeed();
    return {
      feed: fresh ?? { items: [], lastUpdated: Date.now() },
      stale: false,
    };
  }

  const stale = Date.now() - cached.lastUpdated >= REFRESH_INTERVAL_MS;
  return { feed: cached, stale };
}
