import 'server-only';
import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getDeepseekClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _client;
}
