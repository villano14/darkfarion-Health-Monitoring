/**
 * Qhalikay API client. Every piece of data the app shows comes from the Go backend.
 * VITE_API_URL points to it in production (Railway); in development Vite proxies /api.
 */
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'crewhealth.token';

export type Role = 'astronaut' | 'crew_medical_officer' | 'flight_surgeon' | 'admin';

let token: string | null = (() => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
})();
const listeners = new Set<() => void>();

export const getToken = () => token;
export function setToken(next: string | null) {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: the session lasts until reload */ }
  listeners.forEach(fn => fn());
}
/** Called when the token changes or the server rejects it. */
export function onAuthChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${BASE}${path}`, {...init, headers});
  if (res.status === 401 && token) setToken(null);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? String(res.status));
  }
  return res;
}

export const get = <T>(path: string, signal?: AbortSignal) => request(path, {signal}).then(r => r.json() as Promise<T>);
export const post = <T>(path: string, body?: unknown) =>
  request(path, {method: 'POST', body: body === undefined ? undefined : JSON.stringify(body)}).then(r => r.json() as Promise<T>);

// --- Shapes returned by the backend ------------------------------------------------

export interface ApiUser {id: number; email: string; name: string; initials: string; role: Role}
export interface ApiMission {id: number; name: string; environment: string; startDate: string; plannedDays: number; day: number}
export interface ApiMember extends ApiUser {title: string}
export interface Me {
  user: ApiUser;
  title: string;
  mission: {mission: ApiMission; crew: ApiMember[]} | null;
}

export interface Band {alertLow: number; watchLow: number; watchHigh: number; alertHigh: number}
export interface IndicatorText {
  label: string; unit?: string; how: string; device: string; why: string; space: string; source: string;
  steps: string[]; actions: Record<string, string[]>; risks: Record<string, string>;
}
type Lang = 'en' | 'es';
export interface Catalog {
  indicators: {
    id: string; group: string; unit: string; input: 'bp' | 'number' | 'scale' | 'scan'; min: number; max: number; step: number;
    range: string; normal: [number, number]; bands: Band[]; text: Record<Lang, IndicatorText>;
  }[];
  groups: {id: string; systems: string[]; context: string[]; hazards: string[]; text: Record<Lang, {name: string; role: string}>}[];
  environments: {id: string; gravity: string; delay: string; unloading: number; dose: number; autonomous: boolean; name: Record<Lang, string>}[];
  hazards: {id: string; name: Record<Lang, string>}[];
  tiers: {id: 'self' | 'crew' | 'surgeon'; text: Record<Lang, {label: string; rule: string}>}[];
  tasks: {id: string; time: string; kind: 'measure' | 'exercise'; indicators: string[]; points: number; label: Record<Lang, string>}[];
  achievements: {id: string; icon: string; points: number; text: Record<Lang, {name: string; description: string}>}[];
}

export interface ReadingRow {day: number; indicator: string; value: number[]; source: string}
export interface ReadingsResponse {userId: number; day: number; readings: ReadingRow[]}
export interface RoutineResponse {day: number; tasks: {id: string; done: boolean}[]}
export interface Progress {
  streak: number; bestStreak: number; points: number; level: number; todayDone: number; todayTotal: number;
  achievements: {id: string; earned: boolean; progress: number; goal: number}[];
}
export type ApiStatus = 'normal' | 'watch' | 'alert';
export type ApiTier = 'none' | 'self' | 'crew' | 'surgeon';
export interface CrewPerson extends ApiMember {
  groups: Record<string, {status: ApiStatus; tier: ApiTier}>;
  status: ApiStatus; tier: ApiTier; lastDay: number; todayDone: number; todayTotal: number; openAlerts: number;
}
export interface CrewMission {mission: ApiMission; crew: CrewPerson[]}
export interface Alert {
  id: number; userId: number; userName: string; indicator: string; day: number; status: 'watch' | 'alert';
  direction: 'low' | 'high' | null; tier: 'crew' | 'surgeon'; value: number[]; createdAt: string;
  ackedBy: string | null; ackedAt: string | null;
  notes: {id: number; author: string; role: Role; body: string; createdAt: string}[];
}
export interface DemoAccount {email: string; name: string; role: Role; password: string}
export interface AppConfig {demo: boolean; demoAccounts?: DemoAccount[]}

export const api = {
  config: () => get<AppConfig>('/api/config'),
  login: (email: string, password: string) => post<{token: string}>('/api/auth/login', {email, password}),
  me: () => get<Me>('/api/me'),
  catalog: () => get<Catalog>('/api/catalog'),
  readings: (user?: number) => get<ReadingsResponse>(`/api/readings${user ? `?user=${user}` : ''}`),
  record: (values: Record<string, number[]>, sources?: Record<string, string>) => post<ReadingsResponse>('/api/readings', {values, sources}),
  routine: (user?: number) => get<RoutineResponse>(`/api/routine${user ? `?user=${user}` : ''}`),
  toggleTask: (id: string) => post<RoutineResponse>(`/api/routine/${id}/toggle`),
  progress: (user?: number) => get<Progress>(`/api/progress${user ? `?user=${user}` : ''}`),
  report: (user: number, lang: string, environment: string) =>
    request(`/api/report?user=${user}&lang=${lang}&environment=${environment}`).then(r => r.text()),
  crew: () => get<CrewMission[]>('/api/crew'),
  alerts: (open = false) => get<Alert[]>(`/api/alerts${open ? '?status=open' : ''}`),
  ack: (id: number) => post<{ok: boolean}>(`/api/alerts/${id}/ack`),
  note: (id: number, body: string) => post<{ok: boolean}>(`/api/alerts/${id}/notes`, {body}),
  spaceWeather: () => get<{source: string; fetchedAt: string; stale?: boolean; sep: {id: string; time: string; link?: string; instrument?: string}[]; flares: {id: string; time: string; classType?: string; link?: string}[]}>('/api/space-weather'),
  osdrPanel: () => get<unknown>('/api/osdr/cmp'),
  admin: {
    users: () => get<(ApiUser & {mission: string; title: string})[]>('/api/admin/users'),
    createUser: (u: {email: string; name: string; password: string; role: Role; missionId?: number; title?: string}) => post<{id: number}>('/api/admin/users', u),
    missions: () => get<(ApiMission & {members: number})[]>('/api/admin/missions'),
    createMission: (m: {name: string; environment: string; startDate: string; plannedDays: number}) => post<{id: number}>('/api/admin/missions', m),
  },
};
