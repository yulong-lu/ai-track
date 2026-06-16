import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/sources/hackerNews', () => ({
  fetchHackerNews: vi.fn().mockResolvedValue([
    { id: 'https://example.com/1', source: 'hn', sourceLabel: 'HN', title: 'HN item', url: 'https://example.com/1', publishedAt: new Date().toISOString() },
  ]),
}));
vi.mock('@/lib/sources/githubTrending', () => ({
  fetchGitHubTrending: vi.fn().mockResolvedValue([
    { id: 'https://github.com/x/y', source: 'github', sourceLabel: 'GitHub', title: 'x/y', url: 'https://github.com/x/y', publishedAt: new Date().toISOString() },
  ]),
}));
vi.mock('@/lib/sources/devto', () => ({
  fetchDevTo: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/sources/arxiv', () => ({
  fetchArXiv: vi.fn().mockRejectedValue(new Error('arXiv down')),
}));
vi.mock('@/lib/sources/blogs', () => ({
  fetchBlogs: vi.fn().mockResolvedValue([]),
}));

import { aggregateAllSources } from '@/lib/sources/index';

describe('aggregateAllSources', () => {
  it('merges results from all sources', async () => {
    const items = await aggregateAllSources();
    expect(items.length).toBe(2); // HN(1) + GitHub(1), arXiv failed, devto+blogs empty
  });

  it('does not throw when one source fails', async () => {
    await expect(aggregateAllSources()).resolves.toBeDefined();
  });
});
