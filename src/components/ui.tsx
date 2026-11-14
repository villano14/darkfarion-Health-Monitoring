import {
  Apple, Bone, Brain, CircleAlert, CircleCheck, Droplets, Dumbbell, Heart, ShieldPlus, TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type {GroupId, Status} from '../health/model';
import {useI18n} from '../i18n';

export const GROUP_ICON: Record<GroupId, LucideIcon> = {
  heart: Heart, brain: Brain, metabolism: Apple, kidneys: Droplets, immune: ShieldPlus, bones: Bone, muscles: Dumbbell,
};
export const STATUS_ICON: Record<Status, LucideIcon> = {normal: CircleCheck, watch: CircleAlert, alert: TriangleAlert};

/** Status is never color alone: every badge carries an icon and a word. */
export function StatusChip({status}: {status: Status}) {
  const Icon = STATUS_ICON[status], {status: label} = useI18n();
  return (
    <span className={`chip chip-${status}`}>
      <Icon aria-hidden="true" />
      {label(status)}
    </span>
  );
}

export function StatusIcon({status}: {status: Status}) {
  const Icon = STATUS_ICON[status], {status: label} = useI18n();
  return <Icon className={`status-icon status-${status}`} aria-label={label(status)} />;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: {id: T; label: string}[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}
/** Tabs/segmented control with one sliding indicator (positioned by CSS via data-index). */
export function Segmented<T extends string>({label, options, value, onChange, className = ''}: SegmentedProps<T>) {
  const index = options.findIndex(o => o.id === value);
  return (
    <div className={`segmented ${className}`} role="tablist" aria-label={label} data-count={options.length} data-index={index}>
      <span className="segmented-indicator" aria-hidden="true" />
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={o.id === value} className="segmented-option" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
