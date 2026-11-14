/**
 * Orbi chat (Groq). Shared by the local Bun server (server/index.ts) and the Vercel function (api/chat.ts).
 * The API key stays on the server; the browser only talks to /api/chat.
 *
 * Response: newline-delimited JSON events
 *   {"type":"text","text":"..."}   streamed answer fragments
 *   {"type":"error","code":"..."}  something failed (auth, rate limit, connection, ...)
 *   {"type":"done"}
 */
import Groq, {APIConnectionError, APIError, AuthenticationError, BadRequestError, RateLimitError} from 'groq-sdk';

export const MODEL = 'openai/gpt-oss-120b';
const MAX_TURNS = 20;
const MAX_CHARS = 4000;

// Created lazily so the server starts (and reports a clear error) even without GROQ_API_KEY.
let client: Groq | null = null;
const groq = () => (client ??= new Groq());

// Stable system prompt. Per-request health data goes in the user turn, never here.
const SYSTEM = `You are Orbi, the friendly health companion inside CrewHealth, an app that helps astronauts on long-duration missions monitor their own health.

What you do:
- Explain the crew member's current readings and risks in plain words, using the <crew_health_context> they send.
- Give practical, step-by-step self-care and prevention advice that works in space: exercise countermeasures (resistance device, cycle ergometer, treadmill), hydration, sleep hygiene under artificial light cycles, nutrition, stress and isolation coping.
- Explain how spaceflight hazards (radiation, isolation and confinement, distance from Earth, altered gravity, closed environment) affect the body.
- Medications: you may explain, in general terms, which kinds of medicines are commonly carried in a spaceflight medical kit for a symptom (for example an antipyretic for fever, or an antiemetic for space motion sickness), what they are for, and common cautions. Do not give personalised doses or tell the person to start, stop, or change a prescription. Say that medication decisions go through the flight surgeon and the onboard medical checklist.

Safety:
- You are not a doctor and this is not a diagnosis. Keep that short; do not repeat it in every message.
- If readings or symptoms suggest an emergency (chest pain, fainting, severe breathing trouble, very high or very low blood pressure, confusion, temperature of 39 °C or more), tell them to stop, alert a crewmate now, and contact the flight surgeon, before anything else. On Mars-like delays, tell them to follow the emergency checklist first.
- Never invent readings. If the context does not contain something, say so and suggest measuring it.

Style:
- Reply in the language named in <language>.
- Be warm, calm and brief: two to five short sentences or a short numbered list. No headings, no tables.
- Use the crew member's actual numbers when relevant.`;

type Turn = {role: 'user' | 'assistant'; content: string};

function parseBody(raw: unknown): {messages: Turn[]; lang: 'en' | 'es'; context: string} | null {
  if (!raw || typeof raw !== 'object') return null;
  const {messages, lang, context} = raw as Record<string, unknown>;
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_TURNS) return null;
  const turns: Turn[] = [];
  for (const m of messages) {
    const role = (m as Turn)?.role, content = (m as Turn)?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return null;
    turns.push({role, content: content.slice(0, MAX_CHARS)});
  }
  if (turns[0].role !== 'user' || turns[turns.length - 1].role !== 'user') return null;
  return {
    messages: turns,
    lang: lang === 'es' ? 'es' : 'en',
    context: typeof context === 'string' ? context.slice(0, 8000) : '',
  };
}

function errorCode(e: unknown): string {
  if (e instanceof AuthenticationError) return 'auth';
  if (e instanceof RateLimitError) return 'rate_limit';
  if (e instanceof BadRequestError) return 'bad_request';
  if (e instanceof APIConnectionError) return 'connection';
  if (e instanceof APIError) return 'api';
  // No credentials configured at all.
  if (e instanceof Error && /api[_ ]?key/i.test(e.message)) return 'auth';
  return 'unknown';
}

export async function handleChat(req: Request): Promise<Response> {
  const body = parseBody(await req.json().catch(() => null));
  if (!body) return Response.json({error: 'invalid request'}, {status: 400});

  // Health context and language ride on the latest user turn; the system prompt stays fixed.
  const turns: Groq.Chat.ChatCompletionMessageParam[] = body.messages.map((m, i) => {
    if (i !== body.messages.length - 1) return {role: m.role, content: m.content};
    return {
      role: 'user',
      content: `<language>${body.lang === 'es' ? 'Spanish' : 'English'}</language>\n<crew_health_context>\n${body.context}\n</crew_health_context>\n\n${m.content}`,
    };
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        const completion = await groq().chat.completions.create({
          model: MODEL,
          messages: [{role: 'system', content: SYSTEM}, ...turns],
          temperature: 1,
          top_p: 1,
          max_completion_tokens: 2048,
          reasoning_effort: 'medium',
          stream: true,
          stop: null,
        });
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) send({type: 'text', text});
        }
        send({type: 'done'});
      } catch (e) {
        console.error('[orbi]', e instanceof Error ? e.message : e);
        send({type: 'error', code: errorCode(e)});
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {headers: {'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store'}});
}
