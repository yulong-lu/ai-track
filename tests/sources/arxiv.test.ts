import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchArXiv } from '@/lib/sources/arxiv';

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>[2506.12345] Scaling test-time compute beats pre-training</title>
      <link>https://arxiv.org/abs/2506.12345</link>
      <description>We show that allocating additional compute at inference time...</description>
      <pubDate>Mon, 15 Jun 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>[2506.12346] Another AI paper title here</title>
      <link>https://arxiv.org/abs/2506.12346</link>
      <description>Abstract of another paper...</description>
      <pubDate>Mon, 15 Jun 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => MOCK_RSS,
  } as Response);
});

describe('fetchArXiv', () => {
  it('strips the arXiv ID prefix from title', async () => {
    const items = await fetchArXiv();
    expect(items[0].title).toBe('Scaling test-time compute beats pre-training');
  });

  it('normalizes to RawItem shape', async () => {
    const items = await fetchArXiv();
    expect(items[0]).toMatchObject({
      source: 'arxiv',
      sourceLabel: 'arXiv',
      url: 'https://arxiv.org/abs/2506.12345',
    });
  });

  it('returns at most 15 items', async () => {
    const items = await fetchArXiv();
    expect(items.length).toBeLessThanOrEqual(15);
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    await expect(fetchArXiv()).rejects.toThrow('arXiv RSS failed: 503');
  });
});
