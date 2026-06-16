import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBlogs } from '@/lib/sources/blogs';

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Claude 4 announcement</title>
      <link>https://www.anthropic.com/news/claude-4</link>
      <description>Anthropic announces Claude 4...</description>
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

describe('fetchBlogs', () => {
  it('returns items with correct sourceLabel', async () => {
    const items = await fetchBlogs();
    // 5 feeds × 1 item each = 5 items
    expect(items.length).toBe(5);
    expect(items.some(i => i.sourceLabel === 'Anthropic')).toBe(true);
  });

  it('normalizes to RawItem shape', async () => {
    const items = await fetchBlogs();
    const anthropic = items.find(i => i.sourceLabel === 'Anthropic')!;
    expect(anthropic).toMatchObject({
      source: 'blog',
      title: 'Claude 4 announcement',
      url: 'https://www.anthropic.com/news/claude-4',
    });
  });

  it('does not throw if one feed fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network'))  // first feed fails
      .mockResolvedValue({ ok: true, text: async () => MOCK_RSS } as Response);

    const items = await fetchBlogs();
    expect(items.length).toBe(4); // 4 remaining feeds succeeded
  });
});
