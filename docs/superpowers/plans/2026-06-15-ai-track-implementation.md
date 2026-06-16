# AI Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vercel-deployed Next.js 15 AI news aggregator that scrapes five sources hourly, analyzes content with DeepSeek, and renders a single ranked feed.

**Architecture:** A Next.js 15 App Router project where `app/page.tsx` (Server Component) calls `lib/feed/service.ts::getFeed()` which reads from a Vercel Blob cache; if the cache is stale (>1hr) it schedules a background `refreshFeed()` via `after()` while serving the last-known-good data immediately. The refresh pipeline fetches all sources in parallel, batches them through DeepSeek for analysis, and overwrites the Blob cache.

**Tech Stack:** Next.js 15 (App Router), TypeScript 5, Vercel Blob (`@vercel/blob`), OpenAI SDK (`openai`) pointed at DeepSeek, `rss-parser` for RSS/XML, `node-html-parser` for GitHub Trending HTML, Vitest + @testing-library/react

---

## File Map

```
package.json
tsconfig.json
next.config.ts
vitest.config.ts
.env.example
lib/
  sources/
    types.ts           – RawItem, SourceType
    hackerNews.ts      – HN Firebase API → RawItem[]
    githubTrending.ts  – Scrape github.com/trending → RawItem[]
    devto.ts           – Dev.to API → RawItem[]
    arxiv.ts           – arXiv RSS → RawItem[]
    blogs.ts           – Hardcoded RSS list → RawItem[]
    index.ts           – aggregateAllSources() via Promise.allSettled
  analysis/
    types.ts           – Category, FeedItem (extends RawItem)
    deepseekClient.ts  – OpenAI SDK configured for DeepSeek
    prompts.ts         – SYSTEM_PROMPT, buildUserPrompt()
    analyze.ts         – analyzeItems(), batch/retry logic
  cache/
    types.ts           – CachedFeed, LockBlob
    constants.ts       – blob keys, REFRESH_INTERVAL_MS, LOCK_TTL_MS
    blobStore.ts       – readFeed(), writeFeed(), tryAcquireLock(), releaseLock()
  feed/
    refresh.ts         – refreshFeed() – full pipeline
    service.ts         – getFeed() – check cache, return {feed, stale}
  format/
    relativeTime.ts    – relativeTime(ms: number): string
components/
  GlobalNav.tsx        – sticky black nav with "AI Track" + "Updated Xm ago"
  ArticleCard.tsx      – single feed card
  Feed.tsx             – list of ArticleCards
app/
  globals.css          – CSS variables + component styles (from prototype)
  layout.tsx           – root layout
  page.tsx             – Server Component; calls getFeed(), schedules after()
tests/
  format/relativeTime.test.ts
  sources/hackerNews.test.ts
  sources/githubTrending.test.ts
  sources/devto.test.ts
  sources/arxiv.test.ts
  sources/blogs.test.ts
  sources/index.test.ts
  analysis/analyze.test.ts
  cache/blobStore.test.ts
  feed/service.test.ts
  components/ArticleCard.test.tsx
```

---

### Task 1: Project Bootstrap

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ai-track",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "openai": "^4.67.0",
    "@vercel/blob": "^0.27.0",
    "rss-parser": "^3.13.0",
    "node-html-parser": "^6.1.0",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 5: Create `.env.example`**

```
# DeepSeek API key — set in Vercel project settings (never commit the real value)
DEEPSEEK_API_KEY=

# Vercel Blob token — auto-set when a Blob store is connected in the Vercel dashboard
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json next.config.ts vitest.config.ts .env.example package-lock.json
git commit -m "chore: bootstrap Next.js 15 + TS + Vitest project"
```

---

### Task 2: Core Types

**Files:** `lib/sources/types.ts`, `lib/analysis/types.ts`, `lib/cache/types.ts`

- [ ] **Step 1: Create `lib/sources/types.ts`**

```typescript
export type SourceType = 'hn' | 'github' | 'devto' | 'arxiv' | 'blog';

export interface RawItem {
  id: string;           // URL used as stable unique id
  source: SourceType;
  sourceLabel: string;  // "HN", "GitHub", "Dev.to", "arXiv", or blog name
  title: string;
  url: string;
  publishedAt: string;  // ISO 8601
  excerpt?: string;     // fed to LLM for context
  nativeScore?: number; // HN points / GitHub stars / Dev.to reactions
}
```

- [ ] **Step 2: Create `lib/analysis/types.ts`**

```typescript
import type { RawItem } from '@/lib/sources/types';

export type Category = 'Research' | 'Product' | 'Tool' | 'Tutorial' | 'News';

export interface FeedItem extends RawItem {
  summary: string;
  category: Category;
  score: number;   // 1.0–10.0
  tags: string[];  // 2-3 lowercase keywords
}
```

- [ ] **Step 3: Create `lib/cache/types.ts`**

```typescript
import type { FeedItem } from '@/lib/analysis/types';

export interface CachedFeed {
  items: FeedItem[];   // sorted by score desc
  lastUpdated: number; // epoch ms
}

export interface LockBlob {
  acquiredAt: number; // epoch ms
}
```

- [ ] **Step 4: Verify types compile**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/
git commit -m "feat: add core type definitions"
```

---

### Task 3: `relativeTime` Utility

**Files:** `lib/format/relativeTime.ts`, `tests/format/relativeTime.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/format/relativeTime.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { relativeTime } from '@/lib/format/relativeTime';

describe('relativeTime', () => {
  const now = Date.now();

  it('returns minutes for short durations', () => {
    expect(relativeTime(now - 30 * 60 * 1000)).toBe('30m ago');
  });

  it('returns hours for longer durations', () => {
    expect(relativeTime(now - 3 * 60 * 60 * 1000)).toBe('3h ago');
  });

  it('returns "just now" for very recent timestamps', () => {
    expect(relativeTime(now - 30_000)).toBe('just now');
  });

  it('caps at 99h for very old timestamps', () => {
    expect(relativeTime(now - 100 * 60 * 60 * 1000)).toBe('99h ago');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/format/relativeTime.test.ts
```

Expected: `Error: Cannot find module '@/lib/format/relativeTime'`

- [ ] **Step 3: Implement `lib/format/relativeTime.ts`**

```typescript
export function relativeTime(epochMs: number): string {
  const diffMs = Date.now() - epochMs;
  const mins = Math.floor(diffMs / 60_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.min(Math.floor(mins / 60), 99);
  return `${hours}h ago`;
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/format/relativeTime.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/format/relativeTime.ts tests/format/relativeTime.test.ts
git commit -m "feat: add relativeTime formatter"
```

---

### Task 4: Hacker News Source

**Files:** `lib/sources/hackerNews.ts`, `tests/sources/hackerNews.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/hackerNews.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/hackerNews.test.ts
```

Expected: `Cannot find module '@/lib/sources/hackerNews'`

- [ ] **Step 3: Implement `lib/sources/hackerNews.ts`**

```typescript
import type { RawItem } from './types';

const HN_API = 'https://hacker-news.firebaseio.com/v0';
const LIMIT = 10;

interface HNItem {
  id: number;
  type: string;
  title?: string;
  url?: string;
  score?: number;
  time?: number;
  text?: string;
  deleted?: boolean;
  dead?: boolean;
}

export async function fetchHackerNews(): Promise<RawItem[]> {
  const res = await fetch(`${HN_API}/topstories.json`);
  if (!res.ok) throw new Error(`HN topstories failed: ${res.status}`);

  const ids: number[] = await res.json();
  const top = ids.slice(0, LIMIT);

  const items = await Promise.all(
    top.map(id =>
      fetch(`${HN_API}/item/${id}.json`).then(r => r.json() as Promise<HNItem>)
    )
  );

  return items
    .filter(item => item && !item.deleted && !item.dead && item.title)
    .map(item => {
      const url = item.url ?? `https://news.ycombinator.com/item?id=${item.id}`;
      return {
        id: url,
        source: 'hn' as const,
        sourceLabel: 'HN',
        title: item.title!,
        url,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
        excerpt: item.text ? item.text.replace(/<[^>]+>/g, '').slice(0, 500) : undefined,
        nativeScore: item.score,
      };
    });
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/hackerNews.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/hackerNews.ts tests/sources/hackerNews.test.ts
git commit -m "feat: add Hacker News source module"
```

---

### Task 5: GitHub Trending Source

**Files:** `lib/sources/githubTrending.ts`, `tests/sources/githubTrending.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/githubTrending.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/githubTrending.test.ts
```

Expected: `Cannot find module '@/lib/sources/githubTrending'`

- [ ] **Step 3: Implement `lib/sources/githubTrending.ts`**

```typescript
import { parse } from 'node-html-parser';
import type { RawItem } from './types';

const TRENDING_URL = 'https://github.com/trending?since=daily';
const LIMIT = 10;

export async function fetchGitHubTrending(): Promise<RawItem[]> {
  const res = await fetch(TRENDING_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) throw new Error(`GitHub trending failed: ${res.status}`);

  const html = await res.text();
  const root = parse(html);
  const articles = root.querySelectorAll('article.Box-row');
  const items: RawItem[] = [];

  for (const article of articles.slice(0, LIMIT)) {
    try {
      const linkEl = article.querySelector('h2 a');
      if (!linkEl) continue;

      const href = linkEl.getAttribute('href')?.replace(/^\//, '').trim();
      if (!href || !href.includes('/')) continue;

      // Normalize "owner / repo" display text to "owner/repo"
      const repoPath = href.split('/').slice(0, 2).join('/');
      const url = `https://github.com/${repoPath}`;
      const title = repoPath;
      const desc = article.querySelector('p')?.text.trim() ?? '';

      const starsMatch = article.text.match(/([\d,]+)\s+stars/);
      const nativeScore = starsMatch
        ? parseInt(starsMatch[1].replace(/,/g, ''), 10)
        : undefined;

      items.push({
        id: url,
        source: 'github' as const,
        sourceLabel: 'GitHub',
        title,
        url,
        publishedAt: new Date().toISOString(),
        excerpt: desc || undefined,
        nativeScore,
      });
    } catch (err) {
      console.error('Failed to parse GitHub trending item:', err);
    }
  }

  return items;
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/githubTrending.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/githubTrending.ts tests/sources/githubTrending.test.ts
git commit -m "feat: add GitHub Trending source module"
```

---

### Task 6: Dev.to Source

**Files:** `lib/sources/devto.ts`, `tests/sources/devto.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/devto.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/devto.test.ts
```

Expected: `Cannot find module '@/lib/sources/devto'`

- [ ] **Step 3: Implement `lib/sources/devto.ts`**

```typescript
import type { RawItem } from './types';

const DEVTO_URL = 'https://dev.to/api/articles?tag=ai&top=7&per_page=7';

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  published_at: string;
  description: string;
  positive_reactions_count: number;
}

export async function fetchDevTo(): Promise<RawItem[]> {
  const res = await fetch(DEVTO_URL);
  if (!res.ok) throw new Error(`Dev.to fetch failed: ${res.status}`);

  const articles: DevToArticle[] = await res.json();

  return articles.map(a => ({
    id: a.url,
    source: 'devto' as const,
    sourceLabel: 'Dev.to',
    title: a.title,
    url: a.url,
    publishedAt: a.published_at,
    excerpt: a.description || undefined,
    nativeScore: a.positive_reactions_count,
  }));
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/devto.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/devto.ts tests/sources/devto.test.ts
git commit -m "feat: add Dev.to source module"
```

---

### Task 7: arXiv Source

**Files:** `lib/sources/arxiv.ts`, `tests/sources/arxiv.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/arxiv.test.ts`:

```typescript
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
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/arxiv.test.ts
```

Expected: `Cannot find module '@/lib/sources/arxiv'`

- [ ] **Step 3: Implement `lib/sources/arxiv.ts`**

```typescript
import Parser from 'rss-parser';
import type { RawItem } from './types';

const ARXIV_RSS = 'https://rss.arxiv.org/rss/cs.AI';
const LIMIT = 15;

const parser = new Parser();

export async function fetchArXiv(): Promise<RawItem[]> {
  const res = await fetch(ARXIV_RSS);
  if (!res.ok) throw new Error(`arXiv RSS failed: ${res.status}`);

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).slice(0, LIMIT).map(item => {
    // Strip arXiv ID prefix: "[2506.12345] Title" → "Title"
    const title = (item.title ?? '').replace(/^\[\d+\.\d+\]\s*/, '').trim();
    const url = item.link ?? '';
    const excerpt = item.content
      ? item.content.replace(/<[^>]+>/g, '').slice(0, 500)
      : item.contentSnippet?.slice(0, 500);

    return {
      id: url,
      source: 'arxiv' as const,
      sourceLabel: 'arXiv',
      title,
      url,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      excerpt,
    };
  });
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/arxiv.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/arxiv.ts tests/sources/arxiv.test.ts
git commit -m "feat: add arXiv RSS source module"
```

---

### Task 8: Blogs RSS Source

**Files:** `lib/sources/blogs.ts`, `tests/sources/blogs.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/blogs.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/blogs.test.ts
```

Expected: `Cannot find module '@/lib/sources/blogs'`

- [ ] **Step 3: Implement `lib/sources/blogs.ts`**

```typescript
import Parser from 'rss-parser';
import type { RawItem } from './types';

const ITEMS_PER_FEED = 3;

const FEED_SOURCES = [
  { url: 'https://www.anthropic.com/news/rss.xml', label: 'Anthropic' },
  { url: 'https://openai.com/blog/rss.xml', label: 'OpenAI' },
  { url: 'https://newsletter.importai.net/feed', label: 'Import AI' },
  { url: 'https://www.deeplearning.ai/the-batch/rss', label: 'The Batch' },
  { url: 'https://interconnects.ai/feed', label: 'Interconnects' },
] as const;

const parser = new Parser();

async function fetchFeed(url: string, label: string): Promise<RawItem[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blog feed ${label} failed: ${res.status}`);

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? []).slice(0, ITEMS_PER_FEED).map(item => {
    const itemUrl = item.link ?? '';
    return {
      id: itemUrl,
      source: 'blog' as const,
      sourceLabel: label,
      title: item.title ?? '(untitled)',
      url: itemUrl,
      publishedAt: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
      excerpt: item.contentSnippet?.slice(0, 500) || item.content?.replace(/<[^>]+>/g, '').slice(0, 500),
    };
  });
}

export async function fetchBlogs(): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    FEED_SOURCES.map(s => fetchFeed(s.url, s.label))
  );

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`Blog feed "${FEED_SOURCES[i].label}" failed:`, result.reason);
    return [];
  });
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/blogs.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/blogs.ts tests/sources/blogs.test.ts
git commit -m "feat: add blogs RSS source module"
```

---

### Task 9: Sources Aggregator Index

**Files:** `lib/sources/index.ts`, `tests/sources/index.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/sources/index.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/sources/index.test.ts
```

Expected: `Cannot find module '@/lib/sources/index'`

- [ ] **Step 3: Implement `lib/sources/index.ts`**

```typescript
import { fetchHackerNews } from './hackerNews';
import { fetchGitHubTrending } from './githubTrending';
import { fetchDevTo } from './devto';
import { fetchArXiv } from './arxiv';
import { fetchBlogs } from './blogs';
import type { RawItem } from './types';

const SOURCE_NAMES = ['HackerNews', 'GitHubTrending', 'DevTo', 'ArXiv', 'Blogs'] as const;

export async function aggregateAllSources(): Promise<RawItem[]> {
  const results = await Promise.allSettled([
    fetchHackerNews(),
    fetchGitHubTrending(),
    fetchDevTo(),
    fetchArXiv(),
    fetchBlogs(),
  ]);

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.error(`Source ${SOURCE_NAMES[i]} failed:`, result.reason);
    return [];
  });
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/sources/index.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sources/index.ts tests/sources/index.test.ts
git commit -m "feat: add sources aggregator index"
```

---

### Task 10: DeepSeek Analysis Module

**Files:** `lib/analysis/deepseekClient.ts`, `lib/analysis/prompts.ts`, `lib/analysis/analyze.ts`, `tests/analysis/analyze.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/analysis/analyze.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analysis/deepseekClient', () => ({
  deepseek: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

import { analyzeItems } from '@/lib/analysis/analyze';
import { deepseek } from '@/lib/analysis/deepseekClient';
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
  vi.mocked(deepseek.chat.completions.create).mockResolvedValue(MOCK_RESPONSE as any);
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
    vi.mocked(deepseek.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ results: [] }) } }],
    } as any);
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(0);
  });

  it('retries once on failure then skips batch', async () => {
    vi.mocked(deepseek.chat.completions.create)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'));
    const items = await analyzeItems(RAW_ITEMS);
    expect(items).toHaveLength(0); // batch skipped after 2 failures
    expect(deepseek.chat.completions.create).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/analysis/analyze.test.ts
```

Expected: `Cannot find module '@/lib/analysis/analyze'`

- [ ] **Step 3: Create `lib/analysis/deepseekClient.ts`**

```typescript
import 'server-only';
import OpenAI from 'openai';

export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});
```

- [ ] **Step 4: Create `lib/analysis/prompts.ts`**

```typescript
export const SYSTEM_PROMPT = `You are an editor for "AI Track", a news aggregator for AI professionals.

For each item in the input JSON array, return a JSON object with this exact shape:
{ "results": [ { "id": "...", "summary": "...", "category": "...", "score": 0.0, "tags": [] }, ... ] }

Rules:
- id: copy the item's id unchanged
- summary: 2 neutral sentences explaining what is notable (not just a title restatement)
- category: exactly one of "Research", "Product", "Tool", "Tutorial", "News"
- score: float 1.0–10.0 for importance to an AI-focused audience. Use nativeScore as a secondary signal if present. Score off-topic or low-substance items 1.0–3.0.
- tags: array of 2–3 short lowercase keywords

Maintain the same order as the input. Return only the JSON object, no other text.`;

export function buildUserPrompt(
  items: Array<{
    id: string;
    title: string;
    sourceLabel: string;
    excerpt?: string;
    nativeScore?: number;
  }>
): string {
  return JSON.stringify(items);
}
```

- [ ] **Step 5: Create `lib/analysis/analyze.ts`**

```typescript
import 'server-only';
import { deepseek } from './deepseekClient';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { RawItem } from '@/lib/sources/types';
import type { FeedItem, Category } from './types';

const BATCH_SIZE = 10;

interface BatchResult {
  id: string;
  summary: string;
  category: Category;
  score: number;
  tags: string[];
}

export async function analyzeItems(items: RawItem[]): Promise<FeedItem[]> {
  const batches = chunk(items, BATCH_SIZE);
  const results = (await Promise.all(batches.map(analyzeBatch))).flat();

  const byId = new Map(results.map(r => [r.id, r]));
  return items
    .map(item => {
      const analysis = byId.get(item.id);
      if (!analysis) return null;
      return { ...item, ...analysis } satisfies FeedItem;
    })
    .filter((item): item is FeedItem => item !== null);
}

async function analyzeBatch(items: RawItem[], attempt = 0): Promise<BatchResult[]> {
  const input = items.map(item => ({
    id: item.id,
    title: item.title,
    sourceLabel: item.sourceLabel,
    excerpt: item.excerpt,
    nativeScore: item.nativeScore,
  }));

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { results?: BatchResult[] };
    return parsed.results ?? [];
  } catch (err) {
    if (attempt < 1) return analyzeBatch(items, attempt + 1);
    console.error('analyzeBatch failed after retry:', err);
    return [];
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
```

- [ ] **Step 6: Run test — expect pass**

```bash
npm test -- tests/analysis/analyze.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/analysis/ tests/analysis/
git commit -m "feat: add DeepSeek analysis module"
```

---

### Task 11: Vercel Blob Cache Store

**Files:** `lib/cache/constants.ts`, `lib/cache/blobStore.ts`, `tests/cache/blobStore.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/cache/blobStore.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

import { list, put, del } from '@vercel/blob';
import { readFeed, writeFeed, tryAcquireLock, releaseLock } from '@/lib/cache/blobStore';
import { LOCK_TTL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

const MOCK_FEED: CachedFeed = {
  items: [],
  lastUpdated: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readFeed', () => {
  it('returns null when no blobs exist', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false } as any);
    expect(await readFeed()).toBeNull();
  });

  it('fetches and parses the blob content', async () => {
    const mockUrl = 'https://blob.vercel.com/ai-track/feed.json';
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: mockUrl }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => MOCK_FEED,
    } as Response);

    const result = await readFeed();
    expect(result).toMatchObject({ lastUpdated: expect.any(Number) });
  });
});

describe('tryAcquireLock', () => {
  it('acquires lock when none exists', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [], cursor: undefined, hasMore: false } as any);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob/lock' } as any);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(true);
    expect(put).toHaveBeenCalled();
  });

  it('returns false when fresh lock exists', async () => {
    const freshLock = { acquiredAt: Date.now() - 60_000 }; // 1 min old — within TTL
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: 'https://blob/lock' }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => freshLock,
    } as Response);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(false);
  });

  it('acquires lock when existing lock is stale', async () => {
    const staleLock = { acquiredAt: Date.now() - LOCK_TTL_MS - 1000 };
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: 'https://blob/lock' }], cursor: undefined, hasMore: false } as any);
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => staleLock,
    } as Response);
    vi.mocked(del).mockResolvedValue(undefined as any);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob/lock' } as any);

    const acquired = await tryAcquireLock();
    expect(acquired).toBe(true);
    expect(del).toHaveBeenCalled(); // stale lock was cleaned up
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/cache/blobStore.test.ts
```

Expected: `Cannot find module '@/lib/cache/blobStore'`

- [ ] **Step 3: Create `lib/cache/constants.ts`**

```typescript
export const FEED_BLOB_KEY = 'ai-track/feed.json';
export const LOCK_BLOB_KEY = 'ai-track/lock.json';
export const REFRESH_INTERVAL_MS = 60 * 60 * 1000;  // 1 hour
export const LOCK_TTL_MS = 5 * 60 * 1000;            // 5 minutes
```

- [ ] **Step 4: Create `lib/cache/blobStore.ts`**

```typescript
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
```

- [ ] **Step 5: Run test — expect pass**

```bash
npm test -- tests/cache/blobStore.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/cache/ tests/cache/
git commit -m "feat: add Vercel Blob cache store"
```

---

### Task 12: Feed Refresh Pipeline

**Files:** `lib/feed/refresh.ts`, `tests/feed/refresh.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/feed/refresh.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/sources/index', () => ({
  aggregateAllSources: vi.fn(),
}));
vi.mock('@/lib/analysis/analyze', () => ({
  analyzeItems: vi.fn(),
}));
vi.mock('@/lib/cache/blobStore', () => ({
  tryAcquireLock: vi.fn(),
  releaseLock: vi.fn(),
  writeFeed: vi.fn(),
}));

import { refreshFeed } from '@/lib/feed/refresh';
import { aggregateAllSources } from '@/lib/sources/index';
import { analyzeItems } from '@/lib/analysis/analyze';
import { tryAcquireLock, releaseLock, writeFeed } from '@/lib/cache/blobStore';
import type { FeedItem } from '@/lib/analysis/types';

const MOCK_FEED_ITEM: FeedItem = {
  id: 'https://arxiv.org/abs/1',
  source: 'arxiv',
  sourceLabel: 'arXiv',
  title: 'Test paper',
  url: 'https://arxiv.org/abs/1',
  publishedAt: new Date().toISOString(),
  summary: 'Two sentence summary.',
  category: 'Research',
  score: 8.5,
  tags: ['llm'],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(aggregateAllSources).mockResolvedValue([]);
  vi.mocked(analyzeItems).mockResolvedValue([MOCK_FEED_ITEM]);
  vi.mocked(tryAcquireLock).mockResolvedValue(true);
  vi.mocked(releaseLock).mockResolvedValue(undefined);
  vi.mocked(writeFeed).mockResolvedValue(undefined);
});

describe('refreshFeed', () => {
  it('skips refresh when lock cannot be acquired', async () => {
    vi.mocked(tryAcquireLock).mockResolvedValue(false);
    await refreshFeed();
    expect(aggregateAllSources).not.toHaveBeenCalled();
  });

  it('fetches, analyzes, sorts, and writes feed', async () => {
    await refreshFeed();
    expect(aggregateAllSources).toHaveBeenCalled();
    expect(analyzeItems).toHaveBeenCalled();
    expect(writeFeed).toHaveBeenCalledWith(
      expect.objectContaining({ items: [MOCK_FEED_ITEM], lastUpdated: expect.any(Number) })
    );
  });

  it('releases lock even if pipeline throws', async () => {
    vi.mocked(aggregateAllSources).mockRejectedValue(new Error('boom'));
    await expect(refreshFeed()).rejects.toThrow('boom');
    expect(releaseLock).toHaveBeenCalled();
  });

  it('sorts items by score descending', async () => {
    const low: FeedItem = { ...MOCK_FEED_ITEM, id: 'low', score: 3.0 };
    const high: FeedItem = { ...MOCK_FEED_ITEM, id: 'high', score: 9.0 };
    vi.mocked(analyzeItems).mockResolvedValue([low, high]);

    await refreshFeed();

    const written: { items: FeedItem[] } = vi.mocked(writeFeed).mock.calls[0][0];
    expect(written.items[0].score).toBe(9.0);
    expect(written.items[1].score).toBe(3.0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/feed/refresh.test.ts
```

Expected: `Cannot find module '@/lib/feed/refresh'`

- [ ] **Step 3: Implement `lib/feed/refresh.ts`**

```typescript
import 'server-only';
import { aggregateAllSources } from '@/lib/sources/index';
import { analyzeItems } from '@/lib/analysis/analyze';
import { tryAcquireLock, releaseLock, writeFeed } from '@/lib/cache/blobStore';

export async function refreshFeed(): Promise<void> {
  const acquired = await tryAcquireLock();
  if (!acquired) {
    console.log('refreshFeed: lock held by another instance, skipping');
    return;
  }

  try {
    const rawItems = await aggregateAllSources();
    const feedItems = await analyzeItems(rawItems);
    const sorted = [...feedItems].sort((a, b) => b.score - a.score);
    await writeFeed({ items: sorted, lastUpdated: Date.now() });
    console.log(`refreshFeed: wrote ${sorted.length} items`);
  } finally {
    await releaseLock();
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/feed/refresh.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/feed/refresh.ts tests/feed/refresh.test.ts
git commit -m "feat: add feed refresh pipeline"
```

---

### Task 13: Feed Service

**Files:** `lib/feed/service.ts`, `tests/feed/service.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/feed/service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/cache/blobStore', () => ({
  readFeed: vi.fn(),
}));
vi.mock('@/lib/feed/refresh', () => ({
  refreshFeed: vi.fn(),
}));

import { getFeed } from '@/lib/feed/service';
import { readFeed } from '@/lib/cache/blobStore';
import { refreshFeed } from '@/lib/feed/refresh';
import { REFRESH_INTERVAL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

const FRESH_FEED: CachedFeed = { items: [], lastUpdated: Date.now() - 30 * 60_000 };
const STALE_FEED: CachedFeed = { items: [], lastUpdated: Date.now() - REFRESH_INTERVAL_MS - 1000 };
const MOCK_REFRESHED: CachedFeed = { items: [], lastUpdated: Date.now() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshFeed).mockResolvedValue(undefined);
});

describe('getFeed', () => {
  it('returns fresh cache without setting stale flag', async () => {
    vi.mocked(readFeed).mockResolvedValue(FRESH_FEED);
    const result = await getFeed();
    expect(result.feed).toBe(FRESH_FEED);
    expect(result.stale).toBe(false);
  });

  it('returns stale cache and sets stale flag', async () => {
    vi.mocked(readFeed).mockResolvedValue(STALE_FEED);
    const result = await getFeed();
    expect(result.feed).toBe(STALE_FEED);
    expect(result.stale).toBe(true);
  });

  it('runs refreshFeed synchronously on cold start (no cache)', async () => {
    vi.mocked(readFeed).mockResolvedValue(null);
    vi.mocked(refreshFeed).mockImplementation(async () => {
      // Simulate refresh writing to blob — readFeed called again returns feed
      vi.mocked(readFeed).mockResolvedValue(MOCK_REFRESHED);
    });

    const result = await getFeed();
    expect(refreshFeed).toHaveBeenCalled();
    expect(result.stale).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/feed/service.test.ts
```

Expected: `Cannot find module '@/lib/feed/service'`

- [ ] **Step 3: Implement `lib/feed/service.ts`**

```typescript
import 'server-only';
import { readFeed } from '@/lib/cache/blobStore';
import { refreshFeed } from '@/lib/feed/refresh';
import { REFRESH_INTERVAL_MS } from '@/lib/cache/constants';
import type { CachedFeed } from '@/lib/cache/types';

export interface FeedResult {
  feed: CachedFeed;
  stale: boolean;
}

export async function getFeed(): Promise<FeedResult> {
  const cached = await readFeed();

  if (!cached) {
    // Cold start: block until first refresh completes
    await refreshFeed();
    const fresh = await readFeed();
    return {
      feed: fresh ?? { items: [], lastUpdated: Date.now() },
      stale: false,
    };
  }

  const stale = Date.now() - cached.lastUpdated >= REFRESH_INTERVAL_MS;
  return { feed: cached, stale };
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
npm test -- tests/feed/service.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/feed/service.ts tests/feed/service.test.ts
git commit -m "feat: add feed service with stale-while-revalidate logic"
```

---

### Task 14: Global Nav + CSS Variables

**Files:** `app/globals.css`, `components/GlobalNav.tsx`

- [ ] **Step 1: Create `app/globals.css`**

This is the CSS from the approved prototype, adapted for Next.js globals:

```css
/* ── Apple design tokens ────────────────────────── */
:root {
  --blue:        #0066cc;
  --blue-dark:   #2997ff;
  --ink:         #1d1d1f;
  --ink-80:      #333333;
  --ink-48:      #7a7a7a;
  --canvas:      #ffffff;
  --parchment:   #f5f5f7;
  --pearl:       #fafafc;
  --hairline:    #e0e0e0;
  --divider:     #f0f0f0;

  --page-bg:           var(--parchment);
  --card-bg:           var(--canvas);
  --card-border:       rgba(0,0,0,0.09);
  --card-border-hover: rgba(0,0,0,0.26);
  --text-primary:      var(--ink);
  --text-secondary:    var(--ink-48);
  --text-tertiary:     #adadb0;
  --badge-bg:          var(--parchment);
  --badge-border:      var(--hairline);
  --link:              var(--blue);
}

@media (prefers-color-scheme: dark) {
  :root {
    --page-bg:           #111112;
    --card-bg:           #1d1d1f;
    --card-border:       rgba(255,255,255,0.07);
    --card-border-hover: rgba(255,255,255,0.18);
    --text-primary:      #f5f5f7;
    --text-secondary:    #86868b;
    --text-tertiary:     #48484a;
    --badge-bg:          #2a2a2c;
    --badge-border:      rgba(255,255,255,0.09);
    --link:              var(--blue-dark);
  }
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: "SF Pro Text", system-ui, -apple-system, BlinkMacSystemFont,
               "Helvetica Neue", sans-serif;
  background: var(--page-bg);
  color: var(--text-primary);
  min-height: 100vh;
}

/* ── Global Nav ─────────────────────────────────── */
.global-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #000000;
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.global-nav-inner {
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.site-name {
  font-family: "SF Pro Display", system-ui, -apple-system, sans-serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.22px;
  color: #ffffff;
}

.update-status {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: -0.12px;
  color: #86868b;
}

/* ── Feed ────────────────────────────────────────── */
.feed-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 18px 16px 72px;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Card ────────────────────────────────────────── */
.card {
  background: var(--card-bg);
  border: 0.5px solid var(--card-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  transition: border-color 0.13s ease;
}

.card:hover {
  border-color: var(--card-border-hover);
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.timestamp {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: -0.12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.badge {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: -0.08px;
  color: var(--text-secondary);
  background: var(--badge-bg);
  border: 0.5px solid var(--badge-border);
  border-radius: 9999px;
  padding: 2px 9px;
  line-height: 1.6;
  white-space: nowrap;
}

.badge-category {
  color: var(--link);
  border-color: var(--link);
  background: transparent;
}

.badge-group {
  display: flex;
  gap: 5px;
  align-items: center;
}

.card-title {
  display: block;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.22px;
  line-height: 1.4;
  color: var(--text-primary);
  text-decoration: none;
  margin-bottom: 6px;
  text-wrap: pretty;
  transition: color 0.1s ease;
}

.card-title:hover {
  color: var(--link);
}

.card-summary {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: -0.1px;
  line-height: 1.56;
  color: var(--text-secondary);
  margin-bottom: 13px;
  text-wrap: pretty;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 13px;
  letter-spacing: -0.1px;
}

.score-display .arrow {
  display: block;
  width: 11px;
  height: 9px;
  flex-shrink: 0;
}

.read-link {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: -0.1px;
  color: var(--link);
  text-decoration: none;
  transition: opacity 0.11s ease;
}

.read-link:hover {
  opacity: 0.68;
}

/* ── Responsive ─────────────────────────────────── */
@media (max-width: 640px) {
  .feed-container { padding: 14px 12px 56px; }
  .global-nav { padding: 0 16px; }
}
```

- [ ] **Step 2: Create `components/GlobalNav.tsx`**

```tsx
import { relativeTime } from '@/lib/format/relativeTime';

interface GlobalNavProps {
  lastUpdated: number; // epoch ms
}

export function GlobalNav({ lastUpdated }: GlobalNavProps) {
  return (
    <nav className="global-nav">
      <div className="global-nav-inner">
        <span className="site-name">AI Track</span>
        <span className="update-status">Updated {relativeTime(lastUpdated)}</span>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify types compile**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/GlobalNav.tsx
git commit -m "feat: add GlobalNav component and CSS design system"
```

---

### Task 15: ArticleCard + Feed Components

**Files:** `components/ArticleCard.tsx`, `components/Feed.tsx`, `tests/components/ArticleCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/ArticleCard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArticleCard } from '@/components/ArticleCard';
import type { FeedItem } from '@/lib/analysis/types';

const ITEM: FeedItem = {
  id: 'https://arxiv.org/abs/1',
  source: 'arxiv',
  sourceLabel: 'arXiv',
  title: 'Scaling test-time compute',
  url: 'https://arxiv.org/abs/1',
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  summary: 'First sentence of summary. Second sentence here.',
  category: 'Research',
  score: 8.5,
  tags: ['compute', 'scaling'],
};

describe('ArticleCard', () => {
  it('renders the article title as a link', () => {
    render(<ArticleCard item={ITEM} />);
    const link = screen.getByRole('link', { name: /Scaling test-time compute/i });
    expect(link).toHaveAttribute('href', 'https://arxiv.org/abs/1');
  });

  it('renders the summary', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText(/First sentence of summary/i)).toBeInTheDocument();
  });

  it('renders source and category badges', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText('arXiv')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders the importance score', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('renders a "Read" link pointing to the article url', () => {
    render(<ArticleCard item={ITEM} />);
    const readLink = screen.getByRole('link', { name: /Read/i });
    expect(readLink).toHaveAttribute('href', 'https://arxiv.org/abs/1');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test -- tests/components/ArticleCard.test.tsx
```

Expected: `Cannot find module '@/components/ArticleCard'`

- [ ] **Step 3: Create `components/ArticleCard.tsx`**

```tsx
import { relativeTime } from '@/lib/format/relativeTime';
import type { FeedItem } from '@/lib/analysis/types';

interface ArticleCardProps {
  item: FeedItem;
}

const ARROW_SVG = (
  <svg className="arrow" viewBox="0 0 11 9" fill="none" aria-hidden="true">
    <path d="M5.5 0.5L10.5 8.5H0.5L5.5 0.5Z" fill="currentColor" />
  </svg>
);

export function ArticleCard({ item }: ArticleCardProps) {
  return (
    <article className="card">
      <div className="card-meta">
        <span className="timestamp">{relativeTime(new Date(item.publishedAt).getTime())}</span>
        <div className="badge-group">
          <span className="badge badge-category">{item.category}</span>
          <span className="badge">{item.sourceLabel}</span>
        </div>
      </div>

      <a className="card-title" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.title}
      </a>

      <p className="card-summary">{item.summary}</p>

      <div className="card-footer">
        <span className="score-display">
          {ARROW_SVG}
          <span>{item.score.toFixed(1)}</span>
        </span>
        <a
          className="read-link"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read ↗
        </a>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Create `components/Feed.tsx`**

```tsx
import { ArticleCard } from './ArticleCard';
import type { FeedItem } from '@/lib/analysis/types';

interface FeedProps {
  items: FeedItem[];
}

export function Feed({ items }: FeedProps) {
  if (items.length === 0) {
    return (
      <main className="feed-container">
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '48px' }}>
          Loading feed…
        </p>
      </main>
    );
  }

  return (
    <main className="feed-container">
      <div className="feed">
        {items.map(item => (
          <ArticleCard key={item.id} item={item} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run test — expect pass**

```bash
npm test -- tests/components/ArticleCard.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/ArticleCard.tsx components/Feed.tsx tests/components/
git commit -m "feat: add ArticleCard and Feed components"
```

---

### Task 16: App Pages — Wire Everything Together

**Files:** `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Create `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Track',
  description: 'A ranked feed of today\'s most important AI news, updated hourly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create `app/page.tsx`**

```tsx
import { after } from 'next/server';
import { getFeed } from '@/lib/feed/service';
import { refreshFeed } from '@/lib/feed/refresh';
import { GlobalNav } from '@/components/GlobalNav';
import { Feed } from '@/components/Feed';

// Allow up to 60s for the cold-start blocking refresh (Vercel Hobby limit)
export const maxDuration = 60;

export default async function Page() {
  const { feed, stale } = await getFeed();

  if (stale) {
    // Serve current cache immediately; refresh runs after response is sent
    after(() => refreshFeed().catch(err => console.error('Background refresh failed:', err)));
  }

  return (
    <>
      <GlobalNav lastUpdated={feed.lastUpdated} />
      <Feed items={feed.items} />
    </>
  );
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass (green).

- [ ] **Step 4: Run TypeScript check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: build completes with no errors. Ignore warnings about missing `DEEPSEEK_API_KEY` and `BLOB_READ_WRITE_TOKEN` at build time — these are runtime env vars.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: wire app pages — AI Track is complete"
```

---

## Post-Implementation Checklist

- [ ] Create a Vercel Blob store in the Vercel dashboard and connect it to the project (this auto-sets `BLOB_READ_WRITE_TOKEN`).
- [ ] Add `DEEPSEEK_API_KEY` as an encrypted environment variable in Vercel project settings.
- [ ] Verify blog RSS URLs in `lib/sources/blogs.ts` are reachable before first deploy (some may need updating).
- [ ] Push to GitHub, import to Vercel, deploy. First page load triggers the cold-start refresh — expect ~15–20s on the first visit.
