import { after } from 'next/server';
import { getFeed } from '@/lib/feed/service';
import { refreshFeed } from '@/lib/feed/refresh';
import { GlobalNav } from '@/components/GlobalNav';
import { Feed } from '@/components/Feed';

// Never statically prerender — this page requires runtime env vars (Blob, DeepSeek)
export const dynamic = 'force-dynamic';

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
