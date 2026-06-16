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
