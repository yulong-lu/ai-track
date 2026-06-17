// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Feed } from '@/components/Feed';
import type { FeedItem } from '@/lib/analysis/types';

function makeItems(count: number): FeedItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    source: 'arxiv',
    sourceLabel: 'arXiv',
    title: `Item ${i}`,
    url: `https://example.com/${i}`,
    publishedAt: new Date().toISOString(),
    summary: 'Summary sentence one. Summary sentence two.',
    category: 'Research',
    score: i % 10, // varied scores, including below 5 and above 8
    tags: ['tag'],
  }));
}

describe('Feed', () => {
  it('shows a loading message when there are no items', () => {
    render(<Feed items={[]} />);
    expect(screen.getByText(/Loading feed/i)).toBeInTheDocument();
  });

  it('renders all items, including low-scoring ones, across pages', () => {
    const items = makeItems(25);
    render(<Feed items={items} page={1} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('renders the requested page of items', () => {
    const items = makeItems(25);
    render(<Feed items={items} page={2} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('renders the remainder on the last page', () => {
    const items = makeItems(25);
    render(<Feed items={items} page={3} />);
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it('clamps an out-of-range page to the last page', () => {
    const items = makeItems(25);
    render(<Feed items={items} page={99} />);
    expect(screen.getAllByRole('article')).toHaveLength(5);
  });

  it('does not render pagination when everything fits on one page', () => {
    const items = makeItems(5);
    render(<Feed items={items} page={1} />);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });

  it('renders pagination when there is more than one page', () => {
    const items = makeItems(25);
    render(<Feed items={items} page={1} />);
    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
  });
});
