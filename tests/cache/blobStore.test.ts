import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { list, put, del } from '@vercel/blob';
import { readFeed, writeFeed, tryAcquireLock, releaseLock } from '@/lib/cache/blobStore';
import { LOCK_TTL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

const MOCK_FEED: CachedFeed = {
  items: [],
  lastUpdated: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readFeed', () => {
  it('returns null when no blobs exist', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false } as any);
    expect(await readFeed()).toBeNull();
  });

  it('fetches and parses the blob content', async () => {
    const mockUrl = 'https://blob.vercel.com/ai-track/feed.json';
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: mockUrl }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => MOCK_FEED,
    } as Response);

    const result = await readFeed();
    expect(result).toMatchObject({ lastUpdated: expect.any(Number) });
  });
});

describe('tryAcquireLock', () => {
  it('acquires lock when none exists', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false } as any);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob/lock' } as any);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(true);
    expect(put).toHaveBeenCalled();
  });

  it('returns false when fresh lock exists', async () => {
    const freshLock = { acquiredAt: Date.now() - 60_000 }; // 1 min old — within TTL
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: 'https://blob/lock' }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => freshLock,
    } as Response);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(false);
  });

  it('acquires lock when existing lock is stale', async () => {
    const staleLock = { acquiredAt: Date.now() - LOCK_TTL_MS - 1000 };
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: 'https://blob/lock' }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => staleLock,
    } as Response);
    vi.mocked(del).mockResolvedValue(undefined as any);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob/lock' } as any);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(true);
    expect(del).toHaveBeenCalled(); // stale lock was cleaned up
  });
});

describe('writeFeed', () => {
  it('writes feed blob with correct options (overwrites in place)', async () => {
    const feedUrl = 'https://blob.vercel.com/ai-track/feed.json';
    vi.mocked(put).mockResolvedValue({ url: feedUrl } as any);

    await writeFeed(MOCK_FEED);

    expect(list).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith(
      expect.stringContaining('feed'),
      expect.any(String),
      expect.objectContaining({ addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' })
    );
  });
});

describe('releaseLock', () => {
  it('deletes the lock blob', async () => {
    const lockUrl = 'https://blob.vercel.com/ai-track/lock.json';
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: lockUrl }], cursor: undefined, hasMore: false } as any);
    vi.mocked(del).mockResolvedValue(undefined as any);

    await releaseLock();

    expect(del).toHaveBeenCalled();
  });
});
