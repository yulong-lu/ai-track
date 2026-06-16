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
