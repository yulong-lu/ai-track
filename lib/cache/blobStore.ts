import 'server-only';
import { list, put, del } from '@vercel/blob';
import type { CachedFeed, LockBlob } from './types';
import { FEED_BLOB_KEY, LOCK_BLOB_KEY, LOCK_TTL_MS } from './constants';

// Cache the feed URL within a warm serverless instance to avoid repeated list() calls
let _feedUrl: string | null = null;

function fetchBlob(url: string): Promise<Response> {
  return fetch(url, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ''}` },
  });
}

export async function readFeed(): Promise<CachedFeed | null> {
  try {
    if (!_feedUrl) {
      const { blobs } = await list({ prefix: FEED_BLOB_KEY });
      if (blobs.length === 0) return null;
      _feedUrl = blobs[0].url;
    }
    const res = await fetchBlob(_feedUrl);
    if (!res.ok) { _feedUrl = null; return null; }
    return (await res.json()) as CachedFeed;
  } catch {
    _feedUrl = null;
    return null;
  }
}

export async function writeFeed(feed: CachedFeed): Promise<void> {
  // put() with addRandomSuffix: false overwrites the existing blob — no list/del needed
  const result = await put(FEED_BLOB_KEY, JSON.stringify(feed), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  _feedUrl = result.url;
}

export async function tryAcquireLock(): Promise<boolean> {
  const { blobs } = await list({ prefix: LOCK_BLOB_KEY });

  if (blobs.length > 0) {
    const res = await fetchBlob(blobs[0].url);
    const lock = (await res.json()) as LockBlob;
    if (Date.now() - lock.acquiredAt < LOCK_TTL_MS) return false;
    // Stale lock — clean up before re-acquiring
    await del(blobs[0].url);
  }

  await put(LOCK_BLOB_KEY, JSON.stringify({ acquiredAt: Date.now() } satisfies LockBlob), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return true;
}

export async function releaseLock(): Promise<void> {
  const { blobs } = await list({ prefix: LOCK_BLOB_KEY });
  if (blobs.length > 0) await del(blobs.map(b => b.url));
}
