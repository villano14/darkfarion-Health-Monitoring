import type {GroupState, Log} from '../health/data';
import {latest} from '../health/data';
import {GROUPS, format, indicatorsOf, type GroupId, type Status} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  states: Record<GroupId, GroupState>;
  log: Log;
  day: number;
  selected: GroupId | null;
  onSelect: (id: GroupId) => void;
}

const RANK: Record<Status, number> = {alert: 0, watch: 1, normal: 2};

/**
 * Object index: every body system as an object on a star chart, ranked by magnitude
 * (alert > watch > in range), with the reading that decides its state.
 */
export default function AttentionList({states, log, day, selected, onSelect}: Props) {
  const L = useI18n(), {t, groupName, status: statusWord} = L;
  const flagged = GROUPS.filter(g => states[g.id].status !== 'normal').length;
  const rows = [...GROUPS].sort((a, b) => RANK[states[a.id].status] - RANK[states[b.id].status]).map(g => {
    const status = states[g.id].status;
    // The reading behind the state: the worst indicator of the system, else its first one.
    const readings = indicatorsOf(g.id).map(base => {
      const i = L.ind(base), {value} = latest(log, i.id, day);
      return {i, value, status: value ? i.assess(value).status : ('normal' as Status)};
    }).filter(r => r.value);
    const lead = readings.sort((a, b) => RANK[a.status] - RANK[b.status])[0];
    return {g, status, lead};
  });

  return (
    <section className="attention" aria-label={t('body.atRiskLabel')}>
      <h2 className="attention-title label">{flagged ? t('body.atRisk', {n: flagged}) : t('body.allClear')}</h2>
      <ul>
        {rows.map(({g, status, lead}) => (
          <li key={g.id}>
            <button className={`attention-item attention-${status}${selected === g.id ? ' is-active' : ''}`} onClick={() => onSelect(g.id)}>
              <span className={`mag mag-${status}`} aria-hidden="true" />
              <span className="attention-name">{groupName(g.id)}</span>
              <span className="attention-meta">
                {lead && <span className="attention-value">{format(lead.i, lead.value)} <span className="muted">{lead.i.unit}</span></span>}
                <span className="attention-status">{statusWord(status)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
