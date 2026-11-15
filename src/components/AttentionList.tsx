import {CircleCheck} from 'lucide-react';
import type {GroupState} from '../health/data';
import {GROUPS, type GroupId} from '../health/model';
import {GROUP_ICON, StatusIcon} from './ui';
import {useI18n} from '../i18n';

interface Props {
  states: Record<GroupId, GroupState>;
  selected: GroupId | null;
  onSelect: (id: GroupId) => void;
}

const RANK = {alert: 0, watch: 1, normal: 2};

/** Floating list of affected systems: the only color on the body page besides the body itself. */
export default function AttentionList({states, selected, onSelect}: Props) {
  const {t, groupName} = useI18n();
  const flagged = GROUPS.filter(g => states[g.id].status !== 'normal')
    .sort((a, b) => RANK[states[a.id].status] - RANK[states[b.id].status]);
  if (!flagged.length) {
    return (
      <div className="attention attention-clear" role="status">
        <CircleCheck aria-hidden="true" />
        {t('body.allClear')}
      </div>
    );
  }
  return (
    <section className="attention" aria-label={t('body.atRiskLabel')}>
      <h2 className="attention-title micro">{t('body.atRisk', {n: flagged.length})}</h2>
      <ul>
        {flagged.map(g => {
          const Icon = GROUP_ICON[g.id];
          return (
            <li key={g.id}>
              <button className={`attention-item attention-${states[g.id].status}${selected === g.id ? ' is-active' : ''}`} onClick={() => onSelect(g.id)}>
                <Icon aria-hidden="true" />
                <span>{groupName(g.id)}</span>
                <StatusIcon status={states[g.id].status} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
