import {Bell, Camera, ClipboardCheck, Droplets, Dumbbell, Flame, Moon, Star, Trophy, type LucideIcon} from 'lucide-react';
import Routine from '../components/Routine';
import {ACHIEVEMENTS, type Task, type TaskState} from '../health/data';
import type {Progress} from '../api/client';
import {useI18n} from '../i18n';

interface Props {
  tasks: (Task & {state: TaskState})[];
  completed: number;
  progress: Progress | null;
  canAct: boolean;
  onToggle: (id: string) => void;
  onLog: () => void;
}

const ICONS: Record<string, LucideIcon> = {
  'clipboard-check': ClipboardCheck, flame: Flame, trophy: Trophy, moon: Moon, droplets: Droplets, dumbbell: Dumbbell, camera: Camera, star: Star,
};

/** Daily routine: scheduled measurements and exercise, with streak, points and achievements from the server. */
export default function RoutinePage({tasks, completed, progress, canAct, onToggle, onLog}: Props) {
  const {t, lang, task: taskLabel} = useI18n();
  const streak = progress?.streak ?? 0;
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
        <Routine tasks={tasks} completed={completed} canAct={canAct} onToggle={onToggle} onLog={onLog} />
      </div>

      {progress && (
        <section className="card achievements" aria-labelledby="achievements-title">
          <div className="section-head">
            <h3 id="achievements-title">{t('progress.title')}</h3>
            <span className="progress-points"><Star aria-hidden="true" />{t('progress.points', {n: progress.points, l: progress.level})}</span>
          </div>
          <p className="muted">{t('progress.sub', {b: progress.bestStreak})}</p>
          <ul className="achievement-list">
            {ACHIEVEMENTS.map(a => {
              const state = progress.achievements.find(x => x.id === a.id);
              const Icon = ICONS[a.icon] ?? Star, earned = !!state?.earned, text = a.text[lang];
              return (
                <li key={a.id} className={`achievement${earned ? ' is-earned' : ''}`}>
                  <span className="achievement-icon" aria-hidden="true"><Icon /></span>
                  <div>
                    <strong>{text.name}</strong>
                    <span className="muted">{text.description}</span>
                    {!earned && state && state.goal > 1 && (
                      <progress max={state.goal} value={state.progress} aria-label={t('progress.of', {a: state.progress, b: state.goal})} />
                    )}
                  </div>
                  <span className="achievement-points">{earned ? t('progress.earned') : `+${a.points}`}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
