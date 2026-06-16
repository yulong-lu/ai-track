import 'server-only';
import { list, put, del } from '@vercel/blob';
import type { CachedFeed, LockBlob } from './types';
import { FEED_BLOB_KEY, LOCK_BLOB_KEY, LOCK_TTL_MS } from './constants';

export async function readFeed(): Promise<CachedFeed | null> {
  try {
    const { blobs } = await list({ prefix: FEED_BLOB_KEY });
    if (blobs.length === 0) return null;
    const res = await fetch(blobs[0].url);
    return (await res.json()) as CachedFeed;
  } catch {
    return null;
  }
}

export async function writeFeed(feed: CachedFeed): Promise<void> {
  // Delete existing blob before writing to avoid accumulation
  const { blobs } = await list({ prefix: FEED_BLOB_KEY });
  if (blobs.length > 0) await del(blobs.map(b => b.url));

  await put(FEED_BLOB_KEY, JSON.stringify(feed), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export async function tryAcquireLock(): Promise<boolean> {
  const { blobs } = await list({ prefix: LOCK_BLOB_KEY });

  if (blobs.length > 0) {
    const res = await fetch(blobs[0].url);
    const lock = (await res.json()) as LockBlob;
    if (Date.now() - lock.acquiredAt < LOCK_TTL_MS) return false;
    // Stale lock — clean up before re-acquiring
    await del(blobs[0].url);
  }

  await put(LOCK_BLOB_KEY, JSON.stringify({ acquiredAt: Date.now() } satisfies LockBlob), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
  return true;
}

export async function releaseLock(): Promise<void> {
  const { blobs } = await list({ prefix: LOCK_BLOB_KEY });
  if (blobs.length > 0) await del(blobs.map(b => b.url));
}
