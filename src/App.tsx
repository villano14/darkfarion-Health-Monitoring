import {useCallback, useEffect, useMemo, useState} from 'react';
import AnatomyScene from './atlas/scene';
import type {Atlas, Part, SystemId} from './atlas/anatomy';
import {latest, useHealthLog} from './health/data';
import {
  ENVIRONMENTS, GROUP, GROUPS, INDICATORS, TODAY, groupOfSystem, worst,
  type EnvironmentId, type GroupId, type Status,
} from './health/model';
import TopBar from './components/TopBar';
import SystemList from './components/SystemList';
import DetailPanel from './components/DetailPanel';
import CheckInDialog from './components/CheckInDialog';
import Timeline from './components/Timeline';

/** 3D tints per status — lighter than the UI tokens so they read well under lighting. */
const TINT: Record<Status, string> = {normal: '#8fd1b1', watch: '#f6c453', alert: '#fd5b43'};
const CONTEXT = '#dfe4ea';
const OVERVIEW: SystemId[] = ['skeletal', 'cardiac', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine', 'sensory', 'reproductive'];
const STREAK_BEFORE_TODAY = 14; // demo history

export default function App() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [envId, setEnvId] = useState<EnvironmentId>('iss');
  const [day, setDay] = useState(TODAY);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<GroupId | null>(null);
  const [checkIn, setCheckIn] = useState(false);

  const env = ENVIRONMENTS.find(e => e.id === envId)!;
  const {log, record, today, done, total} = useHealthLog(env);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/models/atlas.json', {signal: abort.signal})
      .then(r => { if (!r.ok) throw new Error('The body model could not be loaded.'); return r.json(); })
      .then(data => setAtlas(data as Atlas))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, []);

  const statuses = useMemo(() => Object.fromEntries(GROUPS.map(g => {
    const list = INDICATORS.filter(i => i.group === g.id).flatMap(i => {
      const {value} = latest(log, i.id, day);
      return value ? [i.assess(value)] : [];
    });
    return [g.id, worst(list).status];
  })) as Record<GroupId, Status>, [log, day]);

  // Scene inputs: memoized so the scene only reacts to real changes.
  const visible = useMemo<SystemId[]>(
    () => (selected ? [...new Set<SystemId>([...GROUP[selected].systems, 'skeletal'])] : OVERVIEW),
    [selected],
  );
  const colors = useMemo(() => {
    const out: Partial<Record<SystemId, string>> = {};
    for (const g of GROUPS) {
      const tint = !selected || selected === g.id ? TINT[statuses[g.id]] : CONTEXT;
      for (const s of g.systems) out[s] = tint;
    }
    return out;
  }, [statuses, selected]);
  const pulse = useMemo(
    () => GROUPS.filter(g => statuses[g.id] === 'alert' && (!selected || selected === g.id)).flatMap(g => g.systems),
    [statuses, selected],
  );
  const focus = useMemo(() => {
    const test = selected ? GROUP[selected].focus : undefined;
    return atlas && test ? atlas.parts.filter(test).map(p => p.id) : null;
  }, [atlas, selected]);

  const onPick = useCallback((part: Part | null) => {
    setSelected(part ? groupOfSystem(part.system) : null);
  }, []);

  const loading = !error && progress < 100;
  const streak = STREAK_BEFORE_TODAY + (done === total ? 1 : 0);

  return (
    <div className={`app${selected ? ' has-selection' : ''}`}>
      <TopBar env={envId} onEnv={setEnvId} day={day} streak={streak} />

      <SystemList
        statuses={statuses} selected={selected} onSelect={setSelected}
        done={done} total={total} canCheckIn={day === TODAY} onCheckIn={() => setCheckIn(true)}
      />

      <main className="stage">
        {atlas && (
          <AnatomyScene
            atlas={atlas} visible={visible} colors={colors} pulse={pulse} focus={focus}
            onPick={onPick} onProgress={setProgress} onError={setError}
          />
        )}
        {loading && (
          <div className="loader" role="status">
            <progress max={100} value={progress} />
            <span>Loading body model</span>
          </div>
        )}
        {error && <div className="loader loader-error" role="alert">{error}</div>}
        <ul className="legend" aria-label="Legend">
          <li><span className="dot dot-normal" />Normal</li>
          <li><span className="dot dot-watch" />Watch</li>
          <li><span className="dot dot-alert" />Alert</li>
        </ul>
      </main>

      <DetailPanel group={selected} log={log} day={day} env={env} statuses={statuses} onSelect={setSelected} />

      <Timeline day={day} onDay={setDay} playing={playing} onPlaying={setPlaying} />

      <CheckInDialog open={checkIn} initial={today} onClose={() => setCheckIn(false)} onSave={record} />
    </div>
  );
}
