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
