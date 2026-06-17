// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Pagination } from '@/components/Pagination';

describe('Pagination', () => {
  it('renders a link for every page', () => {
    render(<Pagination currentPage={1} totalPages={3} />);
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '/?page=2');
    expect(screen.getByRole('link', { name: '3' })).toHaveAttribute('href', '/?page=3');
  });

  it('marks the current page without making it a link', () => {
    render(<Pagination currentPage={2} totalPages={3} />);
    expect(screen.queryByRole('link', { name: '2' })).not.toBeInTheDocument();
    expect(screen.getByText('2')).toHaveAttribute('aria-current', 'page');
  });

  it('omits Prev on the first page', () => {
    render(<Pagination currentPage={1} totalPages={3} />);
    expect(screen.queryByRole('link', { name: /Prev/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Next/i })).toHaveAttribute('href', '/?page=2');
  });

  it('omits Next on the last page', () => {
    render(<Pagination currentPage={3} totalPages={3} />);
    expect(screen.queryByRole('link', { name: /Next/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Prev/i })).toHaveAttribute('href', '/?page=2');
  });
});
