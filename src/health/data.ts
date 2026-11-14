import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  DAILY, GROUPS, INDICATORS, TODAY, indicatorsOf, tierFor, worst,
  type Environment, type GroupId, type IndicatorId, type Reading, type Status, type Tier,
} from './model';

/** Readings per mission day. */
export type Log = Record<number, Partial<Record<IndicatorId, Reading>>>;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

/**
 * Simulated mission history (demo data). Daily indicators run until yesterday so
 * today's check-in is still pending; onboard scans run until today.
 */
export function simulate(env: Environment): Log {
  const n = rng(42), log: Log = {};
  let dose = 0;
  for (let d = 1; d <= TODAY; d++) {
    const t = d / TODAY, day: Log[number] = {};
    if (d < TODAY) {
      day.bp = [116 + 22 * t ** 3 + n() * 6, 74 + 14 * t ** 3 + n() * 4];
      day.hr = [66 + 4 * Math.sin(d / 9) + n() * 6];
      day.glucose = [90 + 5 * t + n() * 10];
      day.temp = [36.8 + n() * 0.3];
      day.water = [Math.round((2.6 + n() * 0.9) * 10) / 10];
      day.sleep = [Math.round((7.1 - 0.8 * t + n() * 1.1) * 2) / 2];
      day.mood = [Math.max(1, Math.min(5, Math.round(4.4 - 0.6 * t + n() * 1.4)))];
    }
    dose += env.dose * (1 + n() * 0.3);
    day.radiation = [dose];
    day.bone = [-0.8 * env.unloading * (d / 30) + n() * 0.15]; // with resistance exercise countermeasures
    day.muscle = [-0.045 * env.unloading * d + n() * 0.4];
    // Weekly blood panel: calcium drifts up as bone unloads (reference ranges from NASA OSDR OSD-575).
    if (d % 7 === 3 || d === TODAY) {
      day.calcium = [Math.round((9.3 + 0.7 * t * env.unloading + n() * 0.3) * 10) / 10];
      day.creatinine = [Math.round((0.92 + 0.08 * t + n() * 0.1) * 100) / 100];
    }
    day.solar = [0];
    log[d] = day;
  }
  // Anchor the last two days so the demo opens with a clear story.
  log[TODAY - 2].bp = [141, 90];
  Object.assign(log[TODAY - 1], {bp: [142, 91], hr: [74], glucose: [94], temp: [36.9], water: [2.3], sleep: [6.5], mood: [4]});
  return log;
}

/** Latest reading at or before `day`. */
export function latest(log: Log, id: IndicatorId, day: number): {value?: Reading; day?: number} {
  for (let d = day; d >= 1; d--) {
    const v = log[d]?.[id];
    if (v) return {value: v, day: d};
  }
  return {};
}

export interface Point {day: number; value: Reading}
/** Readings over the last `days` days ending at `day`. */
export function series(log: Log, id: IndicatorId, day: number, days = 30): Point[] {
  const out: Point[] = [];
  for (let d = Math.max(1, day - days + 1); d <= day; d++) {
    const v = log[d]?.[id];
    if (v) out.push({day: d, value: v});
  }
  return out;
}

/** Consecutive alert readings ending at the latest reading. */
function alertStreak(log: Log, id: IndicatorId, day: number): number {
  const i = INDICATORS.find(x => x.id === id)!;
  let count = 0;
  for (let d = day; d >= 1; d--) {
    const v = log[d]?.[id];
    if (!v) { if (count === 0) continue; else break; }
    if (i.assess(v).status !== 'alert') break;
    count++;
  }
  return count;
}

export interface GroupState {status: Status; tier: Tier}
export function groupStates(log: Log, day: number): Record<GroupId, GroupState> {
  return Object.fromEntries(GROUPS.map(g => {
    let status: Status = 'normal', tier: Tier = 'none';
    const order: Tier[] = ['none', 'self', 'crew', 'surgeon'];
    for (const i of indicatorsOf(g.id)) {
      const {value} = latest(log, i.id, day);
      if (!value) continue;
      const a = i.assess(value);
      status = worst([{status}, a]).status;
      const t = tierFor(a.status, alertStreak(log, i.id, day));
      if (order.indexOf(t) > order.indexOf(tier)) tier = t;
    }
    return [g.id, {status, tier}];
  })) as Record<GroupId, GroupState>;
}

// --- Persistence ---------------------------------------------------------------

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Simulated history merged with the astronaut's own entries (kept in this browser). */
export function useHealthLog(env: Environment, solarToday = 0) {
  const [entries, setEntries] = usePersistent<Log>('crewhealth.entries.v1', {});
  const log = useMemo(() => {
    const merged = simulate(env);
    for (const [d, values] of Object.entries(entries)) merged[+d] = {...merged[+d], ...values};
    // Solar particle events come from the live NASA DONKI feed (or the demo switch).
    merged[TODAY] = {...merged[TODAY], solar: [solarToday]};
    return merged;
  }, [env, entries, solarToday]);

  const record = useCallback((values: Partial<Record<IndicatorId, Reading>>) => {
    setEntries(e => ({...e, [TODAY]: {...e[TODAY], ...values}}));
  }, [setEntries]);

  const today = useMemo(() => entries[TODAY] ?? {}, [entries]);
  const done = DAILY.filter(i => today[i.id]).length;
  return {log, record, today, done, total: DAILY.length};
}

// --- Daily routine -------------------------------------------------------------

export interface Task {
  id: string;
  time: string;
  label: string;
  kind: 'measure' | 'exercise';
  indicators?: IndicatorId[];
}
export const ROUTINE: Task[] = [
  {id: 'sleep', time: '07:00', label: 'Log sleep', kind: 'measure', indicators: ['sleep']},
  {id: 'vitals', time: '07:30', label: 'Blood pressure and pulse', kind: 'measure', indicators: ['bp', 'hr']},
  {id: 'glucose', time: '07:45', label: 'Fasting blood sugar', kind: 'measure', indicators: ['glucose']},
  {id: 'ared', time: '10:00', label: 'Resistance training, 60 min', kind: 'exercise'},
  {id: 'cycle', time: '15:00', label: 'Cycle ergometer, 30 min', kind: 'exercise'},
  {id: 'temp', time: '19:00', label: 'Body temperature', kind: 'measure', indicators: ['temp']},
  {id: 'water', time: '20:30', label: 'Log fluid intake', kind: 'measure', indicators: ['water']},
  {id: 'mood', time: '21:00', label: 'Mood check-in', kind: 'measure', indicators: ['mood']},
];
export type TaskState = 'done' | 'overdue' | 'due' | 'upcoming';
const minutes = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

export function useRoutine(today: Partial<Record<IndicatorId, Reading>>, now: Date) {
  const [exercise, setExercise] = usePersistent<Record<string, boolean>>(`crewhealth.exercise.${TODAY}`, {});
  const clock = now.getHours() * 60 + now.getMinutes();
  const tasks = ROUTINE.map(task => {
    const done = task.kind === 'exercise' ? !!exercise[task.id] : task.indicators!.every(id => today[id]);
    const late = clock - minutes(task.time);
    const state: TaskState = done ? 'done' : late > 60 ? 'overdue' : late >= 0 ? 'due' : 'upcoming';
    return {...task, state};
  });
  const toggle = useCallback((id: string) => setExercise(e => ({...e, [id]: !e[id]})), [setExercise]);
  return {tasks, toggle, completed: tasks.filter(t => t.state === 'done').length};
}

/** Re-renders every `ms` with the current time. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
