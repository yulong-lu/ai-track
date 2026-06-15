# AI Track — AI News Aggregator Design

## Overview

AI Track is a single-feed AI news aggregator. It pulls items from five AI-focused
sources, uses DeepSeek (via the OpenAI SDK) to summarize/categorize/score/tag each
item, and renders one ranked feed. The whole thing deploys to Vercel with no
traditional backend or database — caching is handled via Vercel Blob, and the data
is refreshed at most once per hour, triggered by visitor traffic rather than a cron
job.

## Goals

- Aggregate AI content from: Hacker News, GitHub Trending, Dev.to, arXiv, and a
  hardcoded list of AI blog/newsletter RSS feeds.
- Use DeepSeek to produce, per item: a 2-sentence summary, a category, a 1-10
  importance score, and 2-3 tags.
- Render a single feed sorted by importance score, in the visual style of the
  approved prototype (Apple-flat-design cards, dark mode via CSS variables).
- Deploy entirely on Vercel: no MySQL/Postgres, no separate backend service.
- Never scrape/analyze on every page load — refresh at most once per hour.
- Keep `DEEPSEEK_API_KEY` server-side only — never in the client bundle, never
  committed to the repo.

## Data Model

```typescript
// lib/sources/types.ts
interface RawItem {
  id: string;            // stable hash of url, used for de-dup
  source: 'hn' | 'github' | 'devto' | 'arxiv' | 'blog';
  sourceLabel: string;    // "HN", "GitHub", "Dev.to", "arXiv", or blog name
  title: string;
  url: string;
  publishedAt: string;    // ISO timestamp
  excerpt?: string;       // raw text/description fed to the LLM for context
  nativeScore?: number;   // HN points / GitHub stars / Dev.to reactions, if available
}

// lib/analysis/types.ts
type Category = 'Research' | 'Product' | 'Tool' | 'Tutorial' | 'News';

interface FeedItem extends RawItem {
  summary: string;   // 2-sentence neutral summary
  category: Category;
  score: number;     // 1.0–10.0 importance score, drives sort order
  tags: string[];    // 2-3 lowercase keywords, stored but not shown in v1
}

// lib/cache/types.ts
interface CachedFeed {
  items: FeedItem[];   // sorted by score descending
  lastUpdated: number; // epoch ms
}
```

## Source Modules

Each source module lives under `lib/sources/` and exports `fetch(): Promise<RawItem[]>`:

- **`hackerNews.ts`** — `GET /v1/topstories.json` (Firebase HN API), fetch top 10
  item details.
- **`githubTrending.ts`** — scrape `github.com/trending?since=daily`, parse top 10
  repos (name, description, star count, language).
- **`devto.ts`** — `GET dev.to/api/articles?tag=ai&top=7`.
- **`arxiv.ts`** — parse `rss.arxiv.org/rss/cs.AI` (XML), take the 15 most recent
  entries.
- **`blogs.ts`** — parse a hardcoded list of RSS feeds: Anthropic news, OpenAI
  blog, Import AI, The Batch (DeepLearning.AI), Interconnects.ai — taking the 3
  most recent entries per feed (~15 items total). The list is a plain array, easy
  to extend later.

`lib/sources/index.ts` runs all five in parallel via `Promise.allSettled` and
flattens the results into one `RawItem[]`. A failing source is dropped (logged),
not fatal to the run.

HN top-10 and GitHub daily-trending aren't AI-filtered at the source — they're
"whatever's hot today." Off-topic items are naturally scored low by the analysis
step (see below) rather than hard-filtered here, so they sink to the bottom of the
feed instead of being excluded outright.

## Analysis Module (DeepSeek via OpenAI SDK)

```typescript
// lib/analysis/deepseekClient.ts
import OpenAI from 'openai';

export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});
```

`lib/analysis/analyze.ts` batches the ~50-65 raw items per refresh into groups of
~10, sends each batch as one DeepSeek call with
`response_format: { type: 'json_object' }`, requesting a JSON array of
`{ id, summary, category, score, tags }` in the same order as the input. Batches
run in parallel via `Promise.all`.

The system prompt (`lib/analysis/prompts.ts`) instructs DeepSeek to:
- Write a neutral 2-sentence summary (not a title restatement).
- Pick the best-fit `category` from the 5 options.
- Assign `score` (1.0-10.0) based on novelty/significance for an AI-focused
  audience, using `nativeScore` as a secondary signal where present. Off-topic or
  low-substance items should score low (1-3).
- Output 2-3 short lowercase `tags`.

**Error handling**: each batch gets one retry on failure. A batch that fails twice
has its items dropped from this refresh cycle (they'll resurface next hour, since
sources are re-fetched each time). If every batch fails (e.g. invalid API key), the
whole refresh aborts and the previous cache stays live.

## Caching & Refresh Strategy

Storage: **Vercel Blob**, holding one JSON blob for `CachedFeed` and one small
"lock" blob (a timestamp) used to prevent duplicate concurrent refreshes. The lock
is deleted when `refreshFeed()` finishes (success or failure, via `finally`). A
lock timestamp older than 5 minutes is treated as stale and ignored — a safety net
in case a previous run crashed without releasing it.

`app/page.tsx` (Server Component) calls `getFeedWithRefresh()`:

1. Read the cached `CachedFeed` from Blob.
2. **No cache yet** (first deploy): run the full pipeline synchronously, then
   render. Happens once.
3. **Cache fresh** (`now - lastUpdated < 1hr`): render as-is.
4. **Cache stale** (`now - lastUpdated >= 1hr`): render the (possibly stale) cached
   data immediately for a fast page load, and kick off a background refresh via
   Next.js `after()` so it runs after the response is sent. The next visitor gets
   the updated data.

`lib/feed/refresh.ts` (`refreshFeed()`):

1. Try to acquire the lock blob; if another refresh is already in flight
   (lock written < 5 min ago), skip and return the existing cache.
2. Run the source modules (parallel fetch).
3. Run the analysis module (batched DeepSeek calls).
4. Sort merged `FeedItem[]` by `score` descending.
5. Write `{ items, lastUpdated: now }` to Blob; release the lock.

## UI / Frontend

Adapted from the approved prototype (`AI Track`, single-column feed, max-width
700px, Apple-flat-design cards, dark mode via `prefers-color-scheme` + CSS
variables):

- **Global nav** (`components/GlobalNav.tsx`): "AI Track" (left), "Updated Xm/Xh
  ago" (right) — relative time computed from `CachedFeed.lastUpdated`.
- **Card** (`components/ArticleCard.tsx`):
  - Meta row: timestamp (left) — category badge + source badge as two muted pills
    (right), e.g. `[Research] [HN]`.
  - Title (15px, clickable link, hover → blue).
  - Summary (13px muted, 2 sentences).
  - Footer row: static score badge (arrow icon + `score.toFixed(1)`, e.g. "8.7",
    non-interactive) on the left, "Read ↗" link on the right.
- **Feed** (`components/Feed.tsx`): renders `FeedItem[]` (already sorted
  server-side) as a list of `ArticleCard`s.
- `lib/format/relativeTime.ts`: shared `"2h ago"` / `"38m ago"` formatter for both
  card timestamps and the nav's "Updated X ago".

No client-side interactivity is required — feed order and content come fully
server-rendered from the cache.

## Project Structure

```
/app
  layout.tsx, page.tsx, globals.css
/lib
  /sources/   types.ts, hackerNews.ts, githubTrending.ts, devto.ts, arxiv.ts, blogs.ts, index.ts
  /analysis/  types.ts, deepseekClient.ts, analyze.ts, prompts.ts
  /cache/     types.ts, blobStore.ts, constants.ts
  /feed/      service.ts, refresh.ts, types.ts
  /format/    relativeTime.ts
/components
  GlobalNav.tsx, Feed.tsx, ArticleCard.tsx
.env.local       (gitignored — DEEPSEEK_API_KEY, BLOB_READ_WRITE_TOKEN for local dev)
.env.example     (committed, placeholders only)
```

## Environment Variables & Deployment

Both env vars are server-only; Next.js excludes non-`NEXT_PUBLIC_` vars from the
client bundle.

- `DEEPSEEK_API_KEY` — set in Vercel project settings (encrypted env var).
- `BLOB_READ_WRITE_TOKEN` — auto-populated when a Vercel Blob store is connected to
  the project.

**Deployment steps**: push to GitHub → import to Vercel → create/connect a Blob
store (dashboard) → add `DEEPSEEK_API_KEY` env var → deploy. `app/page.tsx` sets
`export const maxDuration = 60` (Hobby plan limit) to give the cold-start and
background refresh enough headroom.

## Testing Strategy (Vitest)

- Source normalizers: mocked HTTP responses → `RawItem[]`.
- Analysis batch response parsing: mocked DeepSeek JSON → `FeedItem[]`.
- Cache staleness/lock logic.
- Relative-time formatting.
