import {AlertTriangle, ChevronRight, Radio, X} from 'lucide-react';
import {latest, series, type Log} from '../health/data';
import {
  GROUP, GROUPS, INDICATORS, NORMAL, actionsFor, format, worst,
  type Environment, type GroupId, type Status,
} from '../health/model';
import Sparkline from './Sparkline';

interface Props {
  group: GroupId | null;
  log: Log;
  day: number;
  env: Environment;
  statuses: Record<GroupId, Status>;
  onSelect: (id: GroupId | null) => void;
}

const LABEL: Record<Status, string> = {normal: 'Normal', watch: 'Watch', alert: 'Alert'};

export default function DetailPanel({group, log, day, env, statuses, onSelect}: Props) {
  if (!group) return <Overview statuses={statuses} onSelect={onSelect} />;
  const g = GROUP[group];
  const rows = INDICATORS.filter(i => i.group === group).map(i => {
    const {value, day: at} = latest(log, i.id, day);
    const a = value ? i.assess(value) : {status: 'normal' as Status};
    return {i, value, at, a, actions: actionsFor(i, a)};
  });
  const status = worst(rows.map(r => r.a)).status;
  const actions = [...new Set(rows.flatMap(r => r.actions))];

  return (
    <aside className="detail" aria-label={`${g.name} details`}>
      <header className="detail-head">
        <div>
          <h2>{g.name}</h2>
          <p className="muted">{g.role}</p>
        </div>
        <span className={`chip chip-${status}`}>{LABEL[status]}</span>
        <button className="icon-btn" onClick={() => onSelect(null)} aria-label="Close"><X /></button>
      </header>

      {status === 'alert' && (
        <div className="escalate">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>{env.autonomous ? 'Act now, then report' : 'Contact flight surgeon'}</strong>
            <span><Radio aria-hidden="true" /> Signal delay {env.delay}</span>
          </div>
        </div>
      )}

      <ul className="metrics">
        {rows.map(({i, value, at, a}) => (
          <li key={i.id} className="metric">
            <div className="metric-top">
              <span className="metric-label">{i.label}</span>
              <span className={`dot dot-${a.status}`} aria-label={LABEL[a.status]} />
            </div>
            <div className="metric-value">
              <strong>{format(i, value)}</strong> <span className="muted">{i.unit}</span>
              {at !== undefined && at < day && <span className="metric-age">day {at}</span>}
            </div>
            <Sparkline values={series(log, i.id, day)} normal={NORMAL[i.id]} status={a.status} />
            <span className="metric-range muted">Normal {i.range}</span>
          </li>
        ))}
      </ul>

      {actions.length > 0 && (
        <section className="actions">
          <h3>What to do</h3>
          <ol>{actions.map(t => <li key={t}>{t}</li>)}</ol>
        </section>
      )}

      <details className="why">
        <summary>Why it matters in space</summary>
        <p>{g.why}</p>
        <div className="tags">{g.hazards.map(h => <span key={h} className="tag">{h}</span>)}</div>
      </details>
    </aside>
  );
}

function Overview({statuses, onSelect}: {statuses: Record<GroupId, Status>; onSelect: (id: GroupId) => void}) {
  const flagged = GROUPS.filter(g => statuses[g.id] !== 'normal')
    .sort((a, b) => (statuses[b.id] === 'alert' ? 1 : 0) - (statuses[a.id] === 'alert' ? 1 : 0));
  return (
    <aside className="detail detail-overview" aria-label="Health summary">
      <header className="detail-head">
        <div>
          <h2>{flagged.length ? `${flagged.length} need attention` : 'All systems normal'}</h2>
          <p className="muted">Tap a body system to inspect it.</p>
        </div>
      </header>
      <ul className="flagged">
        {flagged.map(g => (
          <li key={g.id}>
            <button className="flagged-item" onClick={() => onSelect(g.id)}>
              <span className={`dot dot-${statuses[g.id]}`} aria-hidden="true" />
              <span>{g.name}</span>
              <span className={`chip chip-${statuses[g.id]}`}>{LABEL[statuses[g.id]]}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
