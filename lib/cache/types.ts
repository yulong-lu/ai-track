import type { FeedItem } from '@/lib/analysis/types';

export interface CachedFeed {
  items: FeedItem[];   // sorted by score desc
  lastUpdated: number; // epoch ms
}

export interface LockBlob {
  acquiredAt: number; // epoch ms
}
