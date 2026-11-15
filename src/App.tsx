import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {RotateCcw} from 'lucide-react';
import AnatomyScene, {type Highlight, type Insets, type ViewDirection} from './atlas/scene';
import type {Atlas, Part, SystemId} from './atlas/anatomy';
import {STAGES} from './atlas/environments';
import EnvironmentSwitch from './components/EnvironmentSwitch';
import {groupStates, useHealthLog, useNow, useProgress, useRoutine} from './health/data';
import {useSpaceWeather} from './health/nasa';
import {api} from './api/client';
import {useSession} from './api/session';
import {
  ENVIRONMENTS, GROUP, GROUPS, TODAY, groupOfSystem,
  type EnvironmentId, type GroupId, type IndicatorId, type Reading, type Status,
} from './health/model';
import {useRoute} from './router';
import NavBar from './components/NavBar';
import AttentionList from './components/AttentionList';
import DetailPanel from './components/DetailPanel';
import Timeline from './components/Timeline';
import Toasts, {type Toast} from './components/Toasts';
import {Segmented} from './components/ui';
import {useI18n} from './i18n';
import VitalsPage from './pages/VitalsPage';
import RoutinePage from './pages/RoutinePage';
import CrewPage from './pages/CrewPage';
import AdminPage from './pages/AdminPage';
import Assistant from './components/Assistant';
import SpaceWeatherCard from './components/SpaceWeatherCard';

/**
 * Body colors: everything rests in a calm blue; only the affected organ or zone is painted.
 * Mild risk (watch) → yellow, high risk (alert) → red.
 */
const BLUE = '#a9c1e6';
const BLUE_SELECTED = '#6f95d8';
const BLUE_CONTEXT = '#c9d7ee';
const RISK: Record<Exclude<Status, 'normal'>, string> = {watch: '#f7c531', alert: '#fc3d21'};
/** The whole body: muscles and connective tissue included, shown translucent so inner organs stay visible. */
const OVERVIEW: SystemId[] = ['muscular', 'connective', 'skeletal', 'cardiac', 'arterial', 'venous', 'nervous', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine', 'sensory', 'reproductive'];
const NO_INSETS: Insets = {top: 0, right: 0, bottom: 0};

export default function App() {
  const [route, go] = useRoute();
  const session = useSession();
  const L = useI18n(), {t} = L;
  const i18n = useRef(L);
  i18n.current = L;
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  // Defaults to the mission's environment; the switch on the stage changes the view.
  const [envId, setEnvId] = useState<EnvironmentId>(() => (session.me.mission?.mission.environment ?? 'iss') as EnvironmentId);
  // Whose health is on screen: yourself, or a crew member opened from the crew page.
  const [subject, setSubject] = useState<number | undefined>(undefined);
  const [subjectName, setSubjectName] = useState('');
  const [day, setDay] = useState(TODAY);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<GroupId | null>(null);
  const [view, setView] = useState<{direction: ViewDirection; n: number}>({direction: 'angle', n: 0});
  const [hovered, setHovered] = useState<Part | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const dock = useRef<HTMLDivElement>(null);

  const now = useNow();
  const env = ENVIRONMENTS.find(e => e.id === envId)!;
  const weather = useSpaceWeather();
  const [simulateStorm, setSimulateStorm] = useState(false);
  // The live NASA DONKI count is stored by the backend; the demo switch only overlays a storm on screen.
  const {log, record, today, done, total, error: dataError} = useHealthLog(subject, simulateStorm ? Math.max(1, weather.recentSep.length) : null);
  const viewingOther = subject !== undefined && subject !== session.me.user.id;
  const canRecord = session.isCrew && !viewingOther;
  const routine = useRoutine(subject, now, log);
  const progressInfo = useProgress(subject, log);

  // Flight surgeon and mission control have no health record: open the crew member who needs most attention.
  useEffect(() => {
    if (session.isCrew || subject !== undefined) return;
    const rank = {none: 0, self: 1, crew: 2, surgeon: 3};
    api.crew().then(missions => {
      const people = missions.flatMap(m => m.crew).sort((a, b) => rank[b.tier] - rank[a.tier]);
      if (people[0]) { setSubject(people[0].id); setSubjectName(people[0].name); }
    }).catch(() => {});
  }, [session.isCrew, subject]);
  const openPerson = useCallback((id: number) => {
    const name = session.me.mission?.crew.find(c => c.id === id)?.name ?? '';
    setSubject(id === session.me.user.id ? undefined : id);
    setSubjectName(name);
    setSelected(null);
    setDay(TODAY);
    go('body');
  }, [session.me, go]);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/models/atlas.json', {signal: abort.signal})
      .then(r => { if (!r.ok) throw new Error(i18n.current.t('body.loadError')); return r.json(); })
      .then(data => setAtlas(data as Atlas))
      .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => abort.abort();
  }, []);

  const states = useMemo(() => groupStates(log, day), [log, day]);

  // Frame the body between the floating cards (desktop) or above the sheet (mobile).
  useEffect(() => {
    const el = dock.current;
    if (!el || !selected) { setInsets(NO_INSETS); return; }
    const measure = () => {
      const stage = el.getBoundingClientRect();
      let next: Insets;
      if (innerWidth <= 760) {
        next = {top: 0, right: 0, bottom: el.querySelector('.detail-cards')?.getBoundingClientRect().height ?? 0, left: 0};
      } else {
        const header = el.querySelector('.detail-header')?.getBoundingClientRect();
        const left = el.querySelector('.cards-left')?.getBoundingClientRect();
        const right = el.querySelector('.cards-right')?.getBoundingClientRect();
        next = {
          top: header ? header.bottom - stage.top + 8 : 0,
          left: left?.width ? left.right - stage.left + 16 : 0,
          right: right?.width ? stage.right - right.left + 16 : 0,
          bottom: 0,
        };
      }
      setInsets(i => (i.top === next.top && i.right === next.right && i.bottom === next.bottom && i.left === next.left ? i : next));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.querySelectorAll('.detail-cards, .cards-col, .detail-header').forEach(c => observer.observe(c));
    measure();
    return () => observer.disconnect();
  }, [selected]);

  // After saving vitals, tell the astronaut which systems changed.
  const saved = useRef(false), previous = useRef(states);
  useEffect(() => {
    if (saved.current) {
      saved.current = false;
      const {t: tr, groupName, status: label} = i18n.current;
      const changes = GROUPS.filter(g => previous.current[g.id].status !== states[g.id].status).map(g => {
        const status = states[g.id].status, name = groupName(g.id);
        const text = status === 'normal' ? tr('toast.back', {name}) : tr('toast.changed', {name, status: label(status).toLowerCase()});
        return {id: Date.now() + Math.random(), status, text};
      });
      setToasts(list => [...list, ...(changes.length ? changes : [{id: Date.now(), status: 'normal' as Status, text: tr('toast.saved')}])]);
    }
    previous.current = states;
  }, [states]);
  const save = useCallback(async (values: Partial<Record<IndicatorId, Reading>>, sources?: Partial<Record<IndicatorId, string>>) => {
    saved.current = true;
    try {
      await record(values, sources);
      setDay(TODAY);
    } catch {
      saved.current = false;
      setToasts(list => [...list, {id: Date.now(), status: 'alert', text: i18n.current.t('toast.saveFailed')}]);
    }
  }, [record]);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  // Scene inputs: memoized so the scene only reacts to real changes.
  const visible = useMemo<SystemId[]>(
    () => (selected ? [...GROUP[selected].systems, ...(GROUP[selected].context ?? [])] : OVERVIEW),
    [selected],
  );
  const colors = useMemo(() => {
    // Base body: all blue. The selected group reads a step darker; everything else fades back.
    const out: Partial<Record<SystemId, string>> = Object.fromEntries(OVERVIEW.map(s => [s, selected ? BLUE_CONTEXT : BLUE]));
    if (selected) for (const s of GROUP[selected].systems) out[s] = BLUE_SELECTED;
    return out;
  }, [selected]);
  // Affected organs or zones (the group's focus parts), painted over the blue body.
  const highlights = useMemo<Highlight[]>(() => {
    if (!atlas) return [];
    return GROUPS.filter(g => states[g.id].status !== 'normal' && (!selected || selected === g.id)).map(g => {
      const status = states[g.id].status as Exclude<Status, 'normal'>;
      const inZone = g.focus ?? ((p: Part) => g.systems.includes(p.system));
      return {ids: atlas.parts.filter(inZone).map(p => p.id), color: RISK[status], pulse: status === 'alert'};
    });
  }, [atlas, states, selected]);
  const opacity = useMemo<Partial<Record<SystemId, number>>>(() => {
    if (selected) return {};
    const atRisk = GROUPS.some(g => states[g.id].status !== 'normal');
    if (!atRisk) return {muscular: 0.18, connective: 0.25};
    // X-ray mode: everything turns translucent so the painted zones stand out solid.
    return Object.fromEntries(OVERVIEW.map(s => [
      s,
      s === 'muscular' ? (states.muscles.status === 'normal' ? 0.14 : 1)
        : s === 'skeletal' ? (states.bones.status === 'normal' ? 0.3 : 1)
          : 0.35,
    ]));
  }, [selected, states]);
  const focus = useMemo(() => {
    const test = selected ? GROUP[selected].focus : undefined;
    return atlas && test ? atlas.parts.filter(test).map(p => p.id) : null;
  }, [atlas, selected]);

  const onPick = useCallback((part: Part | null) => {
    setSelected(part ? groupOfSystem(part.system) : null);
  }, []);
  // The flight surgeon report is written by the backend from the database.
  const report = useCallback(() => api.report(subject ?? session.me.user.id, L.lang, envId), [subject, session.me.user.id, L.lang, envId]);
  const viewOnBody = useCallback((g: GroupId) => { setDay(TODAY); setSelected(g); go('body'); }, [go]);

  const loading = !error && progress < 100;
  const streak = progressInfo?.streak ?? 0;
  const overdue = routine.tasks.filter(t => t.state === 'overdue').length;
  const hoveredGroup = hovered ? groupOfSystem(hovered.system) : null;

  return (
    <div className="app" data-route={route}>
      <NavBar
        route={route} now={now} streak={streak} canRecord={canRecord}
        vitalsDone={done} vitalsTotal={total} overdue={overdue}
      />

      {/* The body page stays mounted so the 3D model never reloads. */}
      <div className={`page-body${selected ? ' has-selection' : ''}`} hidden={route !== 'body'}>
        <main className="stage">
          {atlas && (
            <AnatomyScene
              atlas={atlas} visible={visible} colors={colors} opacity={opacity} highlights={highlights} focus={focus} view={view} insets={insets} stage={STAGES[envId]}
              onPick={onPick} onHover={setHovered} onProgress={setProgress} onError={setError}
            />
          )}

          {viewingOther && (
            <div className="viewing-banner" role="status">
              <span>{t('viewing.label', {name: subjectName})}</span>
              {session.isCrew
                ? <button className="link-btn" onClick={() => { setSubject(undefined); setSelected(null); }}>{t('viewing.back')}</button>
                : <a className="link-btn" href="#/crew">{t('viewing.change')}</a>}
            </div>
          )}
          {dataError && <div className="loader loader-error" role="alert">{t('session.offline')}</div>}

          {!loading && !error && !selected && (
            <div className="body-side">
              <AttentionList states={states} selected={selected} onSelect={setSelected} />
              <SpaceWeatherCard weather={weather} simulated={simulateStorm} onSimulate={setSimulateStorm} />
            </div>
          )}

          {!error && <EnvironmentSwitch value={envId} onChange={setEnvId} />}

          {loading && (
            <div className="loader" role="status">
              <progress max={100} value={progress} />
              <span>{t('body.loading', {p: progress})}</span>
            </div>
          )}
          {error && <div className="loader loader-error" role="alert">{error}</div>}

          {hovered && (
            <div className="hover-name" aria-hidden="true">
              <span>{hovered.name}</span>
              {hoveredGroup && <span className="muted">{L.groupName(hoveredGroup)}</span>}
            </div>
          )}

          <div className="stage-bottom">
            <ul className="legend" aria-label={t('legend')}>
              <li><span className="dot dot-blue" />{t('legend.normal')}</li>
              <li><span className="dot dot-watch" />{t('legend.watch')}</li>
              <li><span className="dot dot-alert" />{t('legend.alert')}</li>
            </ul>
            <div className="view-controls">
              <Segmented
                label={t('body.camera')} value={view.direction} className="segmented-small"
                onChange={direction => setView(v => ({direction, n: v.n + 1}))}
                options={[{id: 'front', label: t('body.front')}, {id: 'side', label: t('body.side')}, {id: 'back', label: t('body.back')}]}
              />
              <button className="icon-btn icon-btn-surface" onClick={() => setView(v => ({direction: 'angle', n: v.n + 1}))} aria-label={t('body.reset')}>
                <RotateCcw aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="detail-layer" ref={dock}>
            {selected && (
              <DetailPanel
                key={selected} group={selected} log={log} day={day} env={env} state={states[selected]}
                onClose={() => setSelected(null)} report={report}
              />
            )}
          </div>
        </main>

        <Timeline day={day} onDay={setDay} playing={playing} onPlaying={setPlaying} />
      </div>

      {route === 'vitals' && canRecord && <VitalsPage initial={today} onSave={save} onViewBody={viewOnBody} />}
      {route === 'routine' && (
        <RoutinePage
          tasks={routine.tasks} completed={routine.completed} progress={progressInfo} canAct={canRecord}
          onToggle={routine.toggle} onLog={() => go('vitals')}
        />
      )}
      {route === 'crew' && session.isStaff && <CrewPage onOpen={openPerson} />}
      {route === 'admin' && session.role === 'admin' && <AdminPage />}

      {canRecord && <Assistant states={states} environment={envId} />}
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
