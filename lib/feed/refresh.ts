import 'server-only';
import { aggregateAllSources } from '@/lib/sources/index';
import { analyzeItems } from '@/lib/analysis/analyze';
import { tryAcquireLock, releaseLock, writeFeed } from '@/lib/cache/blobStore';

export async function refreshFeed(): Promise<void> {
  const acquired = await tryAcquireLock();
  if (!acquired) {
    console.log('refreshFeed: lock held by another instance, skipping');
    return;
  }

  try {
    const rawItems = await aggregateAllSources();
    const feedItems = await analyzeItems(rawItems);
    const sorted = [...feedItems].sort((a, b) => b.score - a.score);
    await writeFeed({ items: sorted, lastUpdated: Date.now() });
    console.log(`refreshFeed: wrote ${sorted.length} items`);
  } finally {
    await releaseLock();
  }
}
