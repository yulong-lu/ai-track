import 'server-only';
import { getDeepseekClient } from './deepseekClient';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { RawItem } from '@/lib/sources/types';
import type { FeedItem, Category } from './types';

const BATCH_SIZE = 10;

interface BatchResult {
  id: string;
  summary: string;
  category: Category;
  score: number;
  tags: string[];
}

export async function analyzeItems(items: RawItem[]): Promise<FeedItem[]> {
  const batches = chunk(items, BATCH_SIZE);
  const results = (await Promise.all(batches.map(analyzeBatch))).flat();

  const byId = new Map(results.map(r => [r.id, r]));
  return items
    .map(item => {
      const analysis = byId.get(item.id);
      if (!analysis) return null;
      return { ...item, ...analysis } satisfies FeedItem;
    })
    .filter((item): item is FeedItem => item !== null);
}

async function analyzeBatch(items: RawItem[], attempt = 0): Promise<BatchResult[]> {
  const input = items.map(item => ({
    id: item.id,
    title: item.title,
    sourceLabel: item.sourceLabel,
    excerpt: item.excerpt,
    nativeScore: item.nativeScore,
  }));

  try {
    const response = await getDeepseekClient().chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { results?: BatchResult[] };
    return parsed.results ?? [];
  } catch (err) {
    if (attempt < 1) return analyzeBatch(items, attempt + 1);
    console.error('analyzeBatch failed after retry:', err);
    return [];
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
