import {Check} from 'lucide-react';
import type {Task, TaskState} from '../health/data';
import {useI18n, type Key} from '../i18n';

interface Props {
  tasks: (Task & {state: TaskState})[];
  completed: number;
  canAct: boolean;
  onToggle: (id: string) => void;
  onLog: () => void;
}

const STATE_KEY: Record<TaskState, Key | null> = {done: 'routine.done', overdue: 'routine.overdue', due: 'routine.due', upcoming: null};

/** Today's routine: measurements and exercise that keep the crew healthy. */
export default function Routine({tasks, completed, canAct, onToggle, onLog}: Props) {
  const {t, task: taskLabel} = useI18n();
  return (
    <section className="routine" aria-labelledby="routine-title">
      <div className="section-head">
        <h3 id="routine-title">{t('routine.today')}</h3>
        <span className="muted">{t('routine.of', {a: completed, b: tasks.length})}</span>
      </div>
      <progress className="routine-progress" max={tasks.length} value={completed} aria-hidden="true" />
      <ol className="tasks">
        {tasks.map(task => {
          const action = task.kind === 'exercise' ? () => onToggle(task.id) : task.state !== 'done' ? onLog : undefined;
          const stateKey = STATE_KEY[task.state];
          return (
            <li key={task.id} className={`task task-${task.state}`}>
              <button className="task-btn" onClick={action} disabled={!canAct || !action} aria-pressed={task.kind === 'exercise' ? task.state === 'done' : undefined}>
                <span className="task-check" aria-hidden="true">{task.state === 'done' && <Check />}</span>
                <span className="task-time">{task.time}</span>
                <span className="task-label">{taskLabel(task)}</span>
                {stateKey && <span className="task-state">{t(stateKey)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
