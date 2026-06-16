import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cache/blobStore', () => ({
  readFeed: vi.fn(),
}));
vi.mock('@/lib/feed/refresh', () => ({
  refreshFeed: vi.fn(),
}));

import { getFeed } from '@/lib/feed/service';
import { readFeed } from '@/lib/cache/blobStore';
import { refreshFeed } from '@/lib/feed/refresh';
import { REFRESH_INTERVAL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

const FRESH_FEED: CachedFeed = { items: [], lastUpdated: Date.now() - 30 * 60_000 };
const STALE_FEED: CachedFeed = { items: [], lastUpdated: Date.now() - REFRESH_INTERVAL_MS - 1000 };
const MOCK_REFRESHED: CachedFeed = { items: [], lastUpdated: Date.now() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshFeed).mockResolvedValue(undefined);
});

describe('getFeed', () => {
  it('returns fresh cache without setting stale flag', async () => {
    vi.mocked(readFeed).mockResolvedValue(FRESH_FEED);
    const result = await getFeed();
    expect(result.feed).toBe(FRESH_FEED);
    expect(result.stale).toBe(false);
  });

  it('returns stale cache and sets stale flag', async () => {
    vi.mocked(readFeed).mockResolvedValue(STALE_FEED);
    const result = await getFeed();
    expect(result.feed).toBe(STALE_FEED);
    expect(result.stale).toBe(true);
  });

  it('runs refreshFeed synchronously on cold start (no cache)', async () => {
    vi.mocked(readFeed).mockResolvedValue(null);
    vi.mocked(refreshFeed).mockImplementation(async () => {
      // Simulate refresh writing to blob — readFeed called again returns feed
      vi.mocked(readFeed).mockResolvedValue(MOCK_REFRESHED);
    });

    const result = await getFeed();
    expect(refreshFeed).toHaveBeenCalled();
    expect(result.stale).toBe(false);
  });
});
