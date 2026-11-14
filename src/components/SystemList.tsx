import {ClipboardCheck} from 'lucide-react';
import {GROUPS, type GroupId, type Status} from '../health/model';

interface Props {
  statuses: Record<GroupId, Status>;
  selected: GroupId | null;
  onSelect: (id: GroupId | null) => void;
  done: number;
  total: number;
  canCheckIn: boolean;
  onCheckIn: () => void;
}

export default function SystemList({statuses, selected, onSelect, done, total, canCheckIn, onCheckIn}: Props) {
  const complete = done === total;
  return (
    <nav className="systems" aria-label="Body systems">
      <button className={`checkin-btn${complete ? ' is-done' : ''}`} onClick={onCheckIn} disabled={!canCheckIn}>
        <ClipboardCheck aria-hidden="true" />
        <span className="checkin-text">
          <span>Daily check</span>
          <progress max={total} value={done} aria-label={`${done} of ${total} done`} />
        </span>
        <span className="checkin-count">{done}/{total}</span>
      </button>
      <ul className="system-list">
        {GROUPS.map(g => (
          <li key={g.id}>
            <button
              className={`system-item${selected === g.id ? ' is-active' : ''}`}
              aria-pressed={selected === g.id}
              onClick={() => onSelect(selected === g.id ? null : g.id)}
            >
              <span className={`dot dot-${statuses[g.id]}`} aria-hidden="true" />
              <span className="system-name">{g.name}</span>
              <span className={`system-status status-${statuses[g.id]}`}>{statuses[g.id]}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
