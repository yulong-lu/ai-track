import { ArticleCard } from './ArticleCard';
import { Pagination } from './Pagination';
import type { FeedItem } from '@/lib/analysis/types';

interface FeedProps {
  items: FeedItem[];
  page?: number;
}

const PAGE_SIZE = 10;

export function Feed({ items, page = 1 }: FeedProps) {
  if (items.length === 0) {
    return (
      <main className="feed-container">
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '48px' }}>
          Loading feed…
        </p>
      </main>
    );
  }

  const sorted = [...items].sort((a, b) => b.score - a.score);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  return (
    <main className="feed-container">
      <div className="feed">
        {pageItems.map(item => <ArticleCard key={item.id} item={item} />)}
      </div>
      {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} />}
    </main>
  );
}
