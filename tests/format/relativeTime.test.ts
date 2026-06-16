import { describe, it, expect } from 'vitest';
import { relativeTime } from '@/lib/format/relativeTime';

describe('relativeTime', () => {
  const now = Date.now();

  it('returns minutes for short durations', () => {
    expect(relativeTime(now - 30 * 60 * 1000)).toBe('30m ago');
  });

  it('returns hours for longer durations', () => {
    expect(relativeTime(now - 3 * 60 * 60 * 1000)).toBe('3h ago');
  });

  it('returns "just now" for very recent timestamps', () => {
    expect(relativeTime(now - 30_000)).toBe('just now');
  });

  it('caps at 99h for very old timestamps', () => {
    expect(relativeTime(now - 100 * 60 * 60 * 1000)).toBe('99h ago');
  });
});
