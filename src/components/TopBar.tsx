import {Flame} from 'lucide-react';
import {ENVIRONMENTS, MISSION_DAYS, type EnvironmentId} from '../health/model';

interface Props {
  env: EnvironmentId;
  onEnv: (id: EnvironmentId) => void;
  day: number;
  streak: number;
}

export default function TopBar({env, onEnv, day, streak}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <ellipse cx="12" cy="12" rx="10.5" ry="4" />
        </svg>
        <span>CrewHealth</span>
      </div>
      <label className="env">
        <span className="sr-only">Environment</span>
        <select value={env} onChange={e => onEnv(e.target.value as EnvironmentId)}>
          {ENVIRONMENTS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      <div className="topbar-stats">
        <span className="mission-day">Day <strong>{day}</strong><span className="muted"> / {MISSION_DAYS}</span></span>
        <span className="streak" title="Check-in streak"><Flame aria-hidden="true" />{streak}</span>
      </div>
    </header>
  );
}
