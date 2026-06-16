import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sources/index', () => ({
  aggregateAllSources: vi.fn(),
}));
vi.mock('@/lib/analysis/analyze', () => ({
  analyzeItems: vi.fn(),
}));
vi.mock('@/lib/cache/blobStore', () => ({
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
  writeFeed: vi.fn(),
}));

import { refreshFeed } from '@/lib/feed/refresh';
import { aggregateAllSources } from '@/lib/sources/index';
import { analyzeItems } from '@/lib/analysis/analyze';
import { tryAcquireLock, releaseLock, writeFeed } from '@/lib/cache/blobStore';
import type { FeedItem } from '@/lib/analysis/types';

const MOCK_FEED_ITEM: FeedItem = {
  id: 'https://arxiv.org/abs/1',
  source: 'arxiv',
  sourceLabel: 'arXiv',
  title: 'Test paper',
  url: 'https://arxiv.org/abs/1',
  publishedAt: new Date().toISOString(),
  summary: 'Two sentence summary.',
  category: 'Research',
  score: 8.5,
  tags: ['llm'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aggregateAllSources).mockResolvedValue([]);
  vi.mocked(analyzeItems).mockResolvedValue([MOCK_FEED_ITEM]);
  vi.mocked(tryAcquireLock).mockResolvedValue(true);
  vi.mocked(releaseLock).mockResolvedValue(undefined);
  vi.mocked(writeFeed).mockResolvedValue(undefined);
});

describe('refreshFeed', () => {
  it('skips refresh when lock cannot be acquired', async () => {
    vi.mocked(tryAcquireLock).mockResolvedValue(false);
    await refreshFeed();
    expect(aggregateAllSources).not.toHaveBeenCalled();
  });

  it('fetches, analyzes, sorts, and writes feed', async () => {
    await refreshFeed();
    expect(aggregateAllSources).toHaveBeenCalled();
    expect(analyzeItems).toHaveBeenCalled();
    expect(writeFeed).toHaveBeenCalledWith(
      expect.objectContaining({ items: [MOCK_FEED_ITEM], lastUpdated: expect.any(Number) })
    );
  });

  it('releases lock even if pipeline throws', async () => {
    vi.mocked(aggregateAllSources).mockRejectedValue(new Error('boom'));
    await expect(refreshFeed()).rejects.toThrow('boom');
    expect(releaseLock).toHaveBeenCalled();
  });

  it('sorts items by score descending', async () => {
    const low: FeedItem = { ...MOCK_FEED_ITEM, id: 'low', score: 3.0 };
    const high: FeedItem = { ...MOCK_FEED_ITEM, id: 'high', score: 9.0 };
    vi.mocked(analyzeItems).mockResolvedValue([low, high]);

    await refreshFeed();

    const written: { items: FeedItem[] } = vi.mocked(writeFeed).mock.calls[0][0];
    expect(written.items[0].score).toBe(9.0);
    expect(written.items[1].score).toBe(3.0);
  });
});
