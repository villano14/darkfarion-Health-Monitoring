import {useEffect, useState} from 'react';
import {api} from '../api/client';

/** Live space weather from NASA DONKI, fetched and cached in PostgreSQL by the Go backend. */
export interface SpaceWeather {
  status: 'loading' | 'ok' | 'error';
  fetchedAt?: string;
  sep: {id: string; time: string; link?: string; instrument?: string}[];
  flares: {id: string; time: string; classType?: string; link?: string}[];
}

const RECENT_DAYS = 3;

export function useSpaceWeather(): SpaceWeather & {recentSep: SpaceWeather['sep']} {
  const [data, setData] = useState<SpaceWeather>({status: 'loading', sep: [], flares: []});
  useEffect(() => {
    const abort = new AbortController();
    api.spaceWeather()
      .then(d => setData({status: 'ok', fetchedAt: d.fetchedAt, sep: d.sep ?? [], flares: d.flares ?? []}))
      .catch(e => { if (e.name !== 'AbortError') setData(d => ({...d, status: 'error'})); });
    return () => abort.abort();
  }, []);
  const cutoff = Date.now() - RECENT_DAYS * 86400000;
  const recentSep = data.sep.filter(e => Date.parse(e.time) >= cutoff);
  return {...data, recentSep};
}

/** Real crew blood panel: NASA OSDR OSD-575 (SpaceX Inspiration4, 2021), stored in the backend database. */
export interface CrewPanel {
  source: string;
  url: string;
  mission: string;
  labRanges: Record<string, {min: number; max: number; unit: string}>;
  samples: ({crew: string; timepoint: string} & Record<'glucose' | 'calcium' | 'creatinine', number | null>)[];
}
export type PanelAnalyte = 'glucose' | 'calcium' | 'creatinine';

let panelCache: Promise<CrewPanel> | null = null;
export function useCrewPanel(): CrewPanel | null {
  const [panel, setPanel] = useState<CrewPanel | null>(null);
  useEffect(() => {
    panelCache ??= api.osdrPanel() as Promise<CrewPanel>;
    let alive = true;
    panelCache.then(p => { if (alive) setPanel(p); }).catch(() => { panelCache = null; });
    return () => { alive = false; };
  }, []);
  return panel;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** Pre-flight vs. first day back (R+1) means, and the overall range, for one analyte. */
export function crewSummary(panel: CrewPanel, analyte: PanelAnalyte) {
  const values = (pred: (t: string) => boolean) =>
    panel.samples.filter(s => pred(s.timepoint)).map(s => s[analyte]).filter((v): v is number => v !== null);
  const all = values(() => true);
  return {
    preflight: mean(values(t => t.startsWith('L-'))),
    landing: mean(values(t => t === 'R+1')),
    min: Math.min(...all),
    max: Math.max(...all),
    range: panel.labRanges[analyte],
  };
}
