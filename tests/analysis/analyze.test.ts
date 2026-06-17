import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@/lib/analysis/deepseekClient', () => ({
  getDeepseekClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

import { analyzeItems } from '@/lib/analysis/analyze';
import type { RawItem } from '@/lib/sources/types';

const RAW_ITEMS: RawItem[] = [
  {
    id: 'https://arxiv.org/abs/2506.00001',
    source: 'arxiv',
    sourceLabel: 'arXiv',
    title: 'Scaling test-time compute beats pre-training',
    url: 'https://arxiv.org/abs/2506.00001',
    publishedAt: new Date().toISOString(),
    excerpt: 'We show that inference-time compute consistently outperforms...',
  },
];

const MOCK_RESPONSE = {
  choices: [{
    message: {
      content: JSON.stringify({
        results: [{
          id: 'https://arxiv.org/abs/2506.00001',
          summary: 'Allocating more inference-time compute outperforms pre-training on 14x data. The finding reframes the training-vs-inference compute tradeoff.',
          category: 'Research',
          score: 9.1,
          tags: ['compute', 'scaling', 'inference'],
        }],
      }),
    },
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue(MOCK_RESPONSE as any);
});

describe('analyzeItems', () => {
  it('merges analysis into FeedItems', async () => {
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'https://arxiv.org/abs/2506.00001',
      source: 'arxiv',
      summary: expect.stringContaining('inference-time compute'),
      category: 'Research',
      score: 9.1,
      tags: ['compute', 'scaling', 'inference'],
    });
  });

  it('drops items where analysis id is missing from response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ results: [] }) } }],
    } as any);
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(0);
  });

  it('drops items where score is missing or not a number', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            results: [{
              id: 'https://arxiv.org/abs/2506.00001',
              summary: 'Allocating more inference-time compute outperforms pre-training.',
              category: 'Research',
              tags: ['compute'],
              // score omitted, as DeepSeek occasionally does
            }],
          }),
        },
      }],
    } as any);
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(0);
  });

  it('retries once on failure then skips batch', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(0); // batch skipped after 2 failures
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
