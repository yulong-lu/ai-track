import type { RawItem } from '@/lib/sources/types';

export type Category = 'Research' | 'Product' | 'Tool' | 'Tutorial' | 'News';

export interface FeedItem extends RawItem {
  summary: string;
  category: Category;
  score: number;   // 1.0–10.0
  tags: string[];  // 2-3 lowercase keywords
}
