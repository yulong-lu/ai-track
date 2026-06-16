import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDevTo } from '@/lib/sources/devto';

const MOCK_ARTICLES = [
  {
    id: 101,
    title: 'Building a RAG pipeline with pgvector',
    url: 'https://dev.to/user/article-slug',
    published_at: '2026-06-15T10:00:00Z',
    description: 'A detailed walkthrough for setting up RAG.',
    positive_reactions_count: 892,
  },
];

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => MOCK_ARTICLES,
  } as Response);
});

describe('fetchDevTo', () => {
  it('returns normalized RawItems', async () => {
    const items = await fetchDevTo();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'https://dev.to/user/article-slug',
      source: 'devto',
      sourceLabel: 'Dev.to',
      title: 'Building a RAG pipeline with pgvector',
      nativeScore: 892,
    });
  });

  it('fetches with correct tag and top params', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await fetchDevTo();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('tag=ai'),
    );
  });
});
