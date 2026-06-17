// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArticleCard } from '@/components/ArticleCard';
import type { FeedItem } from '@/lib/analysis/types';

const ITEM: FeedItem = {
  id: 'https://arxiv.org/abs/1',
  source: 'arxiv',
  sourceLabel: 'arXiv',
  title: 'Scaling test-time compute',
  url: 'https://arxiv.org/abs/1',
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  summary: 'First sentence of summary. Second sentence here.',
  category: 'Research',
  score: 8.5,
  tags: ['compute', 'scaling'],
};

describe('ArticleCard', () => {
  it('renders the article title as a link', () => {
    render(<ArticleCard item={ITEM} />);
    const link = screen.getByRole('link', { name: /Scaling test-time compute/i });
    expect(link).toHaveAttribute('href', 'https://arxiv.org/abs/1');
  });

  it('renders the summary', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText(/First sentence of summary/i)).toBeInTheDocument();
  });

  it('renders source and category badges', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText('arXiv')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('renders the importance score', () => {
    render(<ArticleCard item={ITEM} />);
    expect(screen.getByText('8.5')).toBeInTheDocument();
  });

  it('renders a fallback instead of crashing when score is missing', () => {
    const badItem = { ...ITEM, score: undefined as unknown as number };
    render(<ArticleCard item={badItem} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a "Read" link pointing to the article url', () => {
    render(<ArticleCard item={ITEM} />);
    const readLink = screen.getByRole('link', { name: /Read/i });
    expect(readLink).toHaveAttribute('href', 'https://arxiv.org/abs/1');
  });
});
