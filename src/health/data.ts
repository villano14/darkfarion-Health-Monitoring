import {useCallback, useEffect, useMemo, useState} from 'react';
import {api, ApiError, type Catalog, type Progress, type ReadingRow} from '../api/client';
import {
  DAILY, GROUPS, INDICATORS, TODAY, indicatorsOf, tierFor, worst,
  type GroupId, type IndicatorId, type Reading, type Status, type Tier,
} from './model';

/** Readings per mission day. */
export type Log = Record<number, Partial<Record<IndicatorId, Reading>>>;

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

// --- Data from the backend -----------------------------------------------------------

function toLog(rows: ReadingRow[]): Log {
  const log: Log = {};
  for (const r of rows) (log[r.day] ??= {})[r.indicator as IndicatorId] = r.value;
  return log;
}

/**
 * A crew member's mission history from the API. `subject` is a user id (crew medical officer and
 * flight surgeon can open someone else's); undefined means the signed-in user.
 * `solarToday` overlays the solar storm demo switch on today's live NASA DONKI reading.
 */
export function useHealthLog(subject: number | undefined, solarOverride: number | null = null) {
  const [rows, setRows] = useState<ReadingRow[] | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setError('');
    api.readings(subject)
      .then(r => { if (live) setRows(r.readings); })
      .catch(e => { if (live) setError(e instanceof ApiError ? e.code : 'network'); });
    return () => { live = false; };
  }, [subject, version]);

  const log = useMemo(() => {
    const merged = toLog(rows ?? []);
    if (solarOverride !== null) merged[TODAY] = {...merged[TODAY], solar: [solarOverride]};
    return merged;
  }, [rows, solarOverride]);

  /** Saves today's readings; the server answers with the updated history. */
  const record = useCallback(async (values: Partial<Record<IndicatorId, Reading>>, sources?: Partial<Record<IndicatorId, string>>) => {
    const r = await api.record(values as Record<string, number[]>, sources as Record<string, string>);
    setRows(r.readings);
  }, []);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  const today = useMemo(() => log[TODAY] ?? {}, [log]);
  const done = DAILY.filter(i => today[i.id]).length;
  return {log, record, reload, today, done, total: DAILY.length, loaded: rows !== null, error};
}

// --- Daily routine -------------------------------------------------------------

export interface Task {
  id: string;
  time: string;
  label: string;
  kind: 'measure' | 'exercise';
  points: number;
  indicators?: IndicatorId[];
}
/** Filled from the backend catalog. */
export const ROUTINE: Task[] = [];
export const ACHIEVEMENTS: Catalog['achievements'] = [];

export type TaskState = 'done' | 'overdue' | 'due' | 'upcoming';
const minutes = (hhmm: string) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

/** Today's routine with completion from the API; `refresh` re-reads it after new readings. */
export function useRoutine(subject: number | undefined, now: Date, refresh: unknown) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let live = true;
    api.routine(subject)
      .then(r => { if (live) setDone(Object.fromEntries(r.tasks.map(t => [t.id, t.done]))); })
      .catch(() => {});
    return () => { live = false; };
  }, [subject, refresh]);

  const clock = now.getHours() * 60 + now.getMinutes();
  const tasks = ROUTINE.map(task => {
    const late = clock - minutes(task.time);
    const state: TaskState = done[task.id] ? 'done' : late > 60 ? 'overdue' : late >= 0 ? 'due' : 'upcoming';
    return {...task, state};
  });
  const toggle = useCallback(async (id: string) => {
    const r = await api.toggleTask(id);
    setDone(Object.fromEntries(r.tasks.map(t => [t.id, t.done])));
  }, []);
  return {tasks, toggle, completed: tasks.filter(t => t.state === 'done').length};
}

/** Streak, points and achievements, computed by the server from real records. */
export function useProgress(subject: number | undefined, refresh: unknown) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    let live = true;
    api.progress(subject).then(p => { if (live) setProgress(p); }).catch(() => {});
    return () => { live = false; };
  }, [subject, refresh]);
  return progress;
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
