import {useCallback, useEffect, useMemo, useState} from 'react';
import {DAILY, INDICATORS, TODAY, type Environment, type IndicatorId, type Reading} from './model';

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
 * today's check-in is still pending; weekly scans run until today.
 */
export function simulate(env: Environment): Log {
  const n = rng(42), log: Log = {};
  for (let d = 1; d <= TODAY; d++) {
    const t = d / TODAY, day: Log[number] = {};
    if (d < TODAY) {
      day.bp = [116 + 22 * t ** 3 + n() * 6, 74 + 14 * t ** 3 + n() * 4];
      day.hr = [66 + 4 * Math.sin(d / 9) + n() * 6];
      day.glucose = [90 + 5 * t + n() * 10];
      day.temp = [36.8 + n() * 0.3];
      day.sleep = [Math.round((7.1 - 0.8 * t + n() * 1.1) * 2) / 2];
      day.mood = [Math.max(1, Math.min(5, Math.round(4.4 - 0.6 * t + n() * 1.4)))];
    }
    day.bone = [-1.2 * env.unloading * (d / 30) + n() * 0.15];
    day.muscle = [-0.045 * env.unloading * d + n() * 0.4];
    log[d] = day;
  }
  // Anchor yesterday so the demo opens with a clear story.
  Object.assign(log[TODAY - 1], {bp: [142, 91], hr: [74], glucose: [94], temp: [36.9], sleep: [6.5], mood: [4]});
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

/** Last `days` readings ending at `day` (first value of each reading). */
export function series(log: Log, id: IndicatorId, day: number, days = 30): number[] {
  const out: number[] = [];
  for (let d = Math.max(1, day - days + 1); d <= day; d++) {
    const v = log[d]?.[id];
    if (v) out.push(v[0]);
  }
  return out;
}

const KEY = 'crewhealth.entries.v1';
function load(): Log {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Log;
  } catch {
    return {};
  }
}

/** Simulated history merged with the astronaut's own entries (kept in this browser). */
export function useHealthLog(env: Environment) {
  const [entries, setEntries] = useState<Log>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* storage unavailable */ }
  }, [entries]);

  const log = useMemo(() => {
    const merged = simulate(env);
    for (const [d, values] of Object.entries(entries)) merged[+d] = {...merged[+d], ...values};
    return merged;
  }, [env, entries]);

  const record = useCallback((values: Partial<Record<IndicatorId, Reading>>) => {
    setEntries(e => ({...e, [TODAY]: {...e[TODAY], ...values}}));
  }, []);

  const done = DAILY.filter(i => entries[TODAY]?.[i.id]).length;
  return {log, record, today: entries[TODAY] ?? {}, done, total: DAILY.length};
}

export const SCANS = INDICATORS.filter(i => i.input === 'scan');
