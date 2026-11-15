import {Bell, Flame} from 'lucide-react';
import Routine from '../components/Routine';
import type {Task, TaskState} from '../health/data';
import {useI18n} from '../i18n';

interface Props {
  tasks: (Task & {state: TaskState})[];
  completed: number;
  streak: number;
  onToggle: (id: string) => void;
  onLog: () => void;
}

/** Daily routine: scheduled measurements and exercise, with streak tracking. */
export default function RoutinePage({tasks, completed, streak, onToggle, onLog}: Props) {
  const {t, task: taskLabel} = useI18n();
  const week = t('routine.weekdays').split(',');
  const next = tasks.find(x => x.state === 'overdue' || x.state === 'due') ?? tasks.find(x => x.state === 'upcoming');
  const today = (new Date().getDay() + 6) % 7;
  const percent = Math.round((completed / tasks.length) * 100);

  return (
    <div className="page page-routine">
      <header className="page-head">
        <div>
          <h1>{t('routine.title')}</h1>
          <p className="muted">{t('routine.sub')}</p>
        </div>
      </header>

      <div className="routine-stats">
        <section className="stat">
          <span className="stat-label">{t('routine.todayStat')}</span>
          <strong className="stat-value">{percent}%</strong>
          <span className="stat-sub">{completed === tasks.length ? t('routine.allDone') : t('routine.tasksDone', {a: completed, b: tasks.length})}</span>
          <progress max={tasks.length} value={completed} aria-label={t('routine.tasksDone', {a: completed, b: tasks.length})} />
        </section>
        <section className="stat">
          <span className="stat-label">{t('routine.streak')}</span>
          <strong className="stat-value stat-streak"><Flame aria-hidden="true" />{t('routine.days', {n: streak})}</strong>
          <ol className="week" aria-label={t('routine.week')}>
            {week.map((d, i) => (
              <li key={d} className={i < today ? 'is-done' : i === today ? 'is-today' : ''}>
                <span className="week-dot" aria-hidden="true" />
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </section>
        {next && (
          <section className={`stat stat-next stat-${next.state}`}>
            <span className="stat-label"><Bell aria-hidden="true" />{next.state === 'upcoming' ? t('routine.next') : next.state === 'overdue' ? t('routine.overdue') : t('routine.due')}</span>
            <strong className="stat-task">{taskLabel(next)}</strong>
            <span className="muted">{next.time}</span>
            {next.kind === 'measure' && next.state !== 'upcoming' && (
              <button className="btn btn-primary btn-small" onClick={onLog}>{t('routine.logNow')}</button>
            )}
          </section>
        )}
      </div>

      <div className="card">
        <Routine tasks={tasks} completed={completed} canAct onToggle={onToggle} onLog={onLog} />
      </div>
    </div>
  );
}
