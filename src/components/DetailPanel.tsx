import {useEffect, useRef, useState, type ReactNode} from 'react';
import {BookOpen, CircleCheck, ListChecks, X} from 'lucide-react';
import {latest, series, type GroupState, type Log} from '../health/data';
import {
  GROUP, actionsFor, format, indicatorsOf,
  type Environment, type GroupId, type Status,
} from '../health/model';
import Escalation from './Escalation';
import TrendChart from './TrendChart';
import CrewCompare, {hasCrewData} from './CrewCompare';
import {GROUP_ICON, Segmented, StatusChip} from './ui';
import {useI18n} from '../i18n';

type Tab = 'status' | 'trends' | 'learn';
type Range = '7' | '30' | '90';

interface Props {
  group: GroupId;
  log: Log;
  day: number;
  env: Environment;
  state: GroupState;
  onClose: () => void;
  report: () => string;
}

/** Fades the bottom edge of a card column while more cards wait below it. */
function useScrollFade(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => el.classList.toggle('is-scrollable', el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    update();
    el.addEventListener('scroll', update, {passive: true});
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => { el.removeEventListener('scroll', update); observer.disconnect(); };
  }, deps);
  return ref;
}

/** One floating card around the body. */
function Card({className = '', children}: {className?: string; children: ReactNode}) {
  return <section className={`float-card ${className}`}>{children}</section>;
}

/**
 * Selected system, split into floating cards around the body:
 * header on top, risk / escalation / plan on the left, measurements on the right.
 */
export default function DetailPanel({group, log, day, env, state, onClose, report}: Props) {
  const [tab, setTab] = useState<Tab>('status');
  const [range, setRange] = useState<Range>('30');
  const L = useI18n(), {t} = L;
  const g = L.group(GROUP[group]), Icon = GROUP_ICON[group];
  const rows = indicatorsOf(group).map(base => {
    const i = L.ind(base);
    const {value, day: at} = latest(log, i.id, day);
    const a = value ? i.assess(value) : {status: 'normal' as Status};
    return {i, value, at, a};
  });
  const flagged = rows.filter(r => r.a.status !== 'normal');
  const plan = [...new Set((flagged.length ? flagged : rows).flatMap(r => actionsFor(r.i, r.a)))];

  const riskCards = flagged.length > 0 ? flagged.map(({i, a}) => (
    <Card key={`risk-${i.id}`} className={`risk-card risk-card-${a.status}`}>
      <StatusChip status={a.status} />
      <h3>{L.risk(i, a)}</h3>
      <p>{i.why} {i.space}</p>
    </Card>
  )) : [
    <Card key="in-range" className="risk-card risk-card-normal">
      <CircleCheck aria-hidden="true" />
      <p>{t('detail.inRange')}</p>
    </Card>,
  ];

  let left: ReactNode[] = [], right: ReactNode[] = [];
  const leftCol = useScrollFade([tab, range, log]), rightCol = useScrollFade([tab, range, log]);

  if (tab === 'status') {
    left = [
      ...riskCards,
      state.tier !== 'none' && (
        <Card key="escalation" className="escalation-card">
          <Escalation tier={state.tier} env={env} report={report} />
        </Card>
      ),
      <Card key="plan" className="plan-card">
        <div className="card-kicker"><ListChecks aria-hidden="true" />{flagged.length ? t('detail.doNow') : t('detail.keep')}</div>
        <ol className="plan-list">{plan.map(step => <li key={step}>{step}</li>)}</ol>
      </Card>,
    ];
    right = rows.map(({i, value, at, a}) => (
      <Card key={i.id} className={`metric-card metric-card-${a.status}`}>
        <div className="metric-top">
          <span className="metric-label">{i.label}</span>
          <StatusChip status={a.status} />
        </div>
        <div className="metric-value">
          <strong>{format(i, value)}</strong>
          <span className="muted">{i.unit}</span>
          {at !== undefined && at < day && <span className="metric-age">{t('detail.day', {n: at})}</span>}
        </div>
        <TrendChart indicator={i} points={series(log, i.id, day, 14)} status={a.status} compact />
        <span className="metric-range">{t('detail.normal', {range: i.range, unit: i.unit})}</span>
      </Card>
    ));
  }

  if (tab === 'trends') {
    left = riskCards;
    right = [
      <Card key="range" className="range-card">
        <Segmented
          label={t('detail.range')} value={range} onChange={setRange} className="segmented-small"
          options={(['7', '30', '90'] as const).map(id => ({id, label: t('detail.days', {n: id})}))}
        />
      </Card>,
      ...rows.map(({i, a, value}) => (
        <Card key={i.id} className="trend-card">
          <div className="section-head">
            <h3>{i.label}</h3>
            <span className="muted">{i.unit}</span>
          </div>
          <TrendChart indicator={i} points={series(log, i.id, day, +range)} status={a.status} />
          {hasCrewData(i.id) && <CrewCompare indicator={i} value={value} />}
        </Card>
      )),
    ];
  }

  if (tab === 'learn') {
    left = [
      <Card key="hazards" className="hazard-card">
        <div className="card-kicker"><BookOpen aria-hidden="true" />{t('detail.hazards')}</div>
        <div className="tags">{g.hazards.map(h => <span key={h} className="tag">{L.hazard(h)}</span>)}</div>
      </Card>,
      ...rows.map(({i}) => (
        <Card key={`why-${i.id}`} className="learn-card">
          <h3>{i.label}</h3>
          <dl>
            <div><dt>{t('detail.why')}</dt><dd>{i.why}</dd></div>
            <div><dt>{t('detail.space')}</dt><dd>{i.space}</dd></div>
          </dl>
        </Card>
      )),
    ];
    right = rows.map(({i}) => (
      <Card key={`how-${i.id}`} className="learn-card">
        <h3>{i.label}</h3>
        <dl>
          <div><dt>{t('detail.device')}</dt><dd>{i.device}</dd></div>
          {i.source && <div><dt>{t('detail.source')}</dt><dd>{i.source}</dd></div>}
        </dl>
        <ol className="steps">{i.steps.map(s => <li key={s}>{s}</li>)}</ol>
      </Card>
    ));
  }

  return (
    <div className="detail-cards" aria-label={t('detail.label', {name: g.name})} data-tab={tab}>
      <header className="float-card detail-header">
        <span className={`detail-icon detail-icon-${state.status}`}><Icon aria-hidden="true" /></span>
        <div className="detail-title">
          <h2>{g.name}</h2>
          <p className="muted">{g.role}</p>
        </div>
        <Segmented
          label={t('detail.view')} value={tab} onChange={setTab} className="detail-tabs"
          options={[{id: 'status', label: t('detail.status')}, {id: 'trends', label: t('detail.trends')}, {id: 'learn', label: t('detail.learn')}]}
        />
        <button className="icon-btn" onClick={onClose} aria-label={t('detail.close')}><X aria-hidden="true" /></button>
      </header>
      <div className="cards-col cards-left" role="tabpanel" ref={leftCol}>{left}</div>
      <div className="cards-col cards-right" ref={rightCol}>{right}</div>
    </div>
  );
}
