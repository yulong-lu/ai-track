import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBlogs } from '@/lib/sources/blogs';

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>GPT-5 announcement</title>
      <link>https://openai.com/blog/gpt-5</link>
      <description>OpenAI announces GPT-5...</description>
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
    // 3 feeds × 1 item each = 3 items
    expect(items.length).toBe(3);
    expect(items.some(i => i.sourceLabel === 'OpenAI')).toBe(true);
  });

  it('normalizes to RawItem shape', async () => {
    const items = await fetchBlogs();
    const openai = items.find(i => i.sourceLabel === 'OpenAI')!;
    expect(openai).toMatchObject({
      source: 'blog',
      title: 'GPT-5 announcement',
      url: 'https://openai.com/blog/gpt-5',
    });
  });

  it('does not throw if one feed fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network'))  // first feed fails
      .mockResolvedValue({ ok: true, text: async () => MOCK_RSS } as Response);

    const items = await fetchBlogs();
    expect(items.length).toBe(2); // 2 remaining feeds succeeded
  });
});
