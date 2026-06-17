import Link from 'next/link';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="pagination" aria-label="Pagination">
      {currentPage > 1 && (
        <Link className="pagination-link" href={`/?page=${currentPage - 1}`}>
          ← Prev
        </Link>
      )}
      {pages.map(page =>
        page === currentPage ? (
          <span key={page} className="pagination-current" aria-current="page">
            {page}
          </span>
        ) : (
          <Link key={page} className="pagination-link" href={`/?page=${page}`}>
            {page}
          </Link>
        )
      )}
      {currentPage < totalPages && (
        <Link className="pagination-link" href={`/?page=${currentPage + 1}`}>
          Next →
        </Link>
      )}
    </nav>
  );
}
