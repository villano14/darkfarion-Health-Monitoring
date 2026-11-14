/**
 * Local API server for development: bun run api  (reads GROQ_API_KEY and NASA_API_KEY from .env).
 * On Vercel the same handlers run as serverless functions from api/.
 */
import {MODEL, handleChat} from './chat.js';
import {handleSpaceWeather} from './space-weather.js';

const PORT = Number(process.env.API_PORT ?? 8787);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const {pathname} = new URL(req.url);
    if (pathname === '/api/chat' && req.method === 'POST') return handleChat(req);
    if (pathname === '/api/space-weather') return handleSpaceWeather();
    if (pathname === '/api/health') return Response.json({ok: true, model: MODEL});
    return new Response('Not found', {status: 404});
  },
});

console.log(`[orbi] API on http://localhost:${PORT}`);
