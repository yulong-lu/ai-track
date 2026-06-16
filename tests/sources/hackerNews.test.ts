import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHackerNews } from '@/lib/sources/hackerNews';

const MOCK_TOP_STORIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const MOCK_ITEM = {
  id: 1,
  type: 'story',
  title: 'Claude Code is now public',
  url: 'https://anthropic.com/claude-code',
  score: 1284,
  time: 1700000000,
};

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockImplementation((url: RequestInfo | URL) => {
    const u = url.toString();
    if (u.includes('topstories')) {
      return Promise.resolve({ ok: true, json: async () => MOCK_TOP_STORIES } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => MOCK_ITEM } as Response);
  });
});

describe('fetchHackerNews', () => {
  it('returns at most 10 items', async () => {
    const items = await fetchHackerNews();
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it('normalizes to RawItem shape', async () => {
    const items = await fetchHackerNews();
    expect(items[0]).toMatchObject({
      source: 'hn',
      sourceLabel: 'HN',
      title: 'Claude Code is now public',
      url: 'https://anthropic.com/claude-code',
      nativeScore: 1284,
    });
  });

  it('id equals the item url', async () => {
    const items = await fetchHackerNews();
    expect(items[0].id).toBe(items[0].url);
  });
});
