import {groupStates, latest, type Log} from './data';
import {GROUPS, MISSION, format, indicatorsOf, type Environment} from './model';

/** Plain-text summary for the flight surgeon, sent at the next comm window. */
export function buildReport(log: Log, day: number, env: Environment): string {
  const states = groupStates(log, day);
  const lines = [
    `CrewHealth report · ${MISSION.name} · ${MISSION.crew}`,
    `Mission day ${day} · ${env.name} (${env.gravity}, signal delay ${env.delay})`,
    '',
  ];
  for (const g of GROUPS) {
    const s = states[g.id];
    lines.push(`${g.name}: ${s.status.toUpperCase()}${s.tier === 'surgeon' ? ' — needs review' : ''}`);
    for (const i of indicatorsOf(g.id)) {
      const {value, day: at} = latest(log, i.id, day);
      const status = value ? i.assess(value).status : 'no data';
      lines.push(`  · ${i.label}: ${format(i, value)} ${i.unit} (${status}, day ${at ?? '—'})`);
    }
  }
  lines.push('', 'Simulated demo data. Not a medical device.');
  return lines.join('\n');
}
