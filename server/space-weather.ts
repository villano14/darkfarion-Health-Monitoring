/**
 * Space weather from NASA DONKI. Shared by the local Bun server and the Vercel function (api/space-weather.ts).
 * Results are cached in memory and, on Vercel, at the CDN edge for 30 minutes.
 */

const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const DONKI = 'https://api.nasa.gov/DONKI';
const CACHE_MS = 30 * 60 * 1000;
let weatherCache: {at: number; body: object} | null = null;

interface DonkiEvent {sepID?: string; flrID?: string; eventTime?: string; peakTime?: string; classType?: string; link?: string; instruments?: {displayName: string}[]}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** DONKI answers 404 or an empty body when a window has no events: treat both as "none". */
async function donki(kind: 'SEP' | 'FLR', days: number): Promise<DonkiEvent[]> {
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const url = `${DONKI}/${kind}?startDate=${ymd(start)}&endDate=${ymd(end)}&api_key=${NASA_KEY}`;
  const res = await fetch(url, {signal: AbortSignal.timeout(12000)});
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`DONKI ${kind} ${res.status}`);
  const text = await res.text();
  return text.trim() ? (JSON.parse(text) as DonkiEvent[]) : [];
}

const CACHE_HEADERS = {'Cache-Control': 's-maxage=1800, stale-while-revalidate=600'};

export async function handleSpaceWeather(): Promise<Response> {
  if (weatherCache && Date.now() - weatherCache.at < CACHE_MS) return Response.json(weatherCache.body, {headers: CACHE_HEADERS});
  try {
    // DONKI limits each query to 60 days.
    const [sep, flr] = await Promise.all([donki('SEP', 59), donki('FLR', 14)]);
    const body = {
      source: 'NASA DONKI (CCMC)',
      fetchedAt: new Date().toISOString(),
      sep: sep.map(e => ({id: e.sepID, time: e.eventTime, link: e.link, instrument: e.instruments?.[0]?.displayName})).sort((a, b) => String(b.time).localeCompare(String(a.time))),
      flares: flr.map(e => ({id: e.flrID, time: e.peakTime, classType: e.classType, link: e.link})).sort((a, b) => String(b.time).localeCompare(String(a.time))),
    };
    weatherCache = {at: Date.now(), body};
    return Response.json(body, {headers: CACHE_HEADERS});
  } catch (e) {
    console.error('[donki]', e instanceof Error ? e.message : e);
    // Rate limited or down: serve the last good answer if this instance has one.
    if (weatherCache) return Response.json({...weatherCache.body, stale: true}, {headers: CACHE_HEADERS});
    return Response.json({error: 'unavailable'}, {status: 502});
  }
}
