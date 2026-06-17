# AI Track

A news aggregator that reads the AI internet so you don't have to.

AI Track pulls fresh stories from Hacker News, GitHub Trending, Dev.to, arXiv, and a curated set of blogs, then asks an LLM to score, summarize, and tag every item — so the feed surfaces what's actually worth a click, not just what's loudest.

We deploy it on Vercel, eliminating the need for a separate cloud server, and it runs forever.
<img width="600" height="718" alt="image" src="https://github.com/user-attachments/assets/f2106a2c-f1a2-461c-b13b-6e362296066b" />

## How it works

1. **Aggregate** — fetch the latest items from each source in parallel ([`lib/sources`](lib/sources)).
2. **Analyze** — send each item to DeepSeek with a single scoring question: *if 100 AI professionals saw only the headline and summary, how many would click?* That click-through rate becomes the score ([`lib/analysis`](lib/analysis)).
3. **Cache** — store the ranked feed in Vercel Blob and serve it instantly; a stale feed refreshes in the background after the response ships, so no one waits on a cold start ([`lib/cache`](lib/cache), [`lib/feed`](lib/feed)).
4. **Read** — browse a clean, numbered-pagination feed with each item's category, tags, and 2-sentence summary ([`components`](components)).

Built for ML engineers, AI researchers, and product managers at AI companies who want signal over noise.

## Stack

Next.js 15 · React 19 · TypeScript · Vercel Blob · DeepSeek

## Getting started

```bash
npm install
cp .env.example .env.local   # add DEEPSEEK_API_KEY and BLOB_READ_WRITE_TOKEN
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm test` | Run the test suite (Vitest) |
| `npm run typecheck` | Type-check the project |

Deploying on Vercel is extremely easy — you only need to set your environment variables on the Vercel dashboard.

