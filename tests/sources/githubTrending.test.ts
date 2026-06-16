import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGitHubTrending } from '@/lib/sources/githubTrending';

const MOCK_HTML = `
<html><body>
  <article class="Box-row">
    <h2 class="h3 lh-condensed"><a href="/microsoft/phi-4">microsoft / phi-4</a></h2>
    <p class="col-9 color-fg-muted my-1">Small model matching 5x larger ones</p>
    <div>3,420 stars today</div>
  </article>
  <article class="Box-row">
    <h2 class="h3 lh-condensed"><a href="/openai/gpt-5">openai / gpt-5</a></h2>
    <p class="col-9 color-fg-muted my-1">Next gen reasoning model</p>
    <div>5,100 stars today</div>
  </article>
</body></html>
`;

beforeEach(() => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => MOCK_HTML,
  } as Response);
});

describe('fetchGitHubTrending', () => {
  it('parses repos from HTML', async () => {
    const items = await fetchGitHubTrending();
    expect(items.length).toBe(2);
  });

  it('normalizes to RawItem shape', async () => {
    const items = await fetchGitHubTrending();
    expect(items[0]).toMatchObject({
      source: 'github',
      sourceLabel: 'GitHub',
      title: 'microsoft/phi-4',
      url: 'https://github.com/microsoft/phi-4',
      nativeScore: 3420,
    });
  });

  it('returns empty array when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));
    await expect(fetchGitHubTrending()).rejects.toThrow('network error');
  });
});
