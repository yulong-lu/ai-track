import { after } from 'next/server';
import { getFeed } from '@/lib/feed/service';
import { refreshFeed } from '@/lib/feed/refresh';
import { GlobalNav } from '@/components/GlobalNav';
import { Feed } from '@/components/Feed';

// Never statically prerender — this page requires runtime env vars (Blob, DeepSeek)
export const dynamic = 'force-dynamic';

// Allow up to 60s for the cold-start blocking refresh (Vercel Hobby limit)
export const maxDuration = 60;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { feed, stale } = await getFeed();
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) || 1;

  if (stale) {
    // Serve current cache immediately; refresh runs after response is sent
    after(() => refreshFeed().catch(err => console.error('Background refresh failed:', err)));
  }

  return (
    <>
      <GlobalNav lastUpdated={feed.lastUpdated} />
      <Feed items={feed.items} page={page} />
    </>
  );
}
