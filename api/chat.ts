/** Vercel serverless function: POST /api/chat (Orbi, streamed). Set GROQ_API_KEY in the Vercel project. */
import {handleChat} from '../server/chat.js';

// Streaming answers can take a while; allow up to a minute.
export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return handleChat(request);
}
