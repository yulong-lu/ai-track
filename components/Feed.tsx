import { ArticleCard } from './ArticleCard';
import type { FeedItem } from '@/lib/analysis/types';

interface FeedProps {
  items: FeedItem[];
}

const TOP_SCORE = 8.0;
const MIN_SCORE = 5.0;
const MAX_TOP = 8;
const MAX_NOTABLE = 12;

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

  const top = items.filter(i => i.score >= TOP_SCORE).slice(0, MAX_TOP);
  const notable = items
    .filter(i => i.score >= MIN_SCORE && i.score < TOP_SCORE)
    .slice(0, MAX_NOTABLE);

  return (
    <main className="feed-container">
      {top.length > 0 && (
        <section className="feed-section">
          <p className="feed-section-label">Top Stories</p>
          <div className="feed">
            {top.map(item => <ArticleCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
      {notable.length > 0 && (
        <section className="feed-section">
          <p className="feed-section-label">Also Notable</p>
          <div className="feed">
            {notable.map(item => <ArticleCard key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </main>
  );
}
