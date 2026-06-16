export type SourceType = 'hn' | 'github' | 'devto' | 'arxiv' | 'blog';

export interface RawItem {
  id: string;           // URL used as stable unique id
  source: SourceType;
  sourceLabel: string;  // "HN", "GitHub", "Dev.to", "arXiv", or blog name
  title: string;
  url: string;
  publishedAt: string;  // ISO 8601
  excerpt?: string;     // fed to LLM for context
  nativeScore?: number; // HN points / GitHub stars / Dev.to reactions
}
