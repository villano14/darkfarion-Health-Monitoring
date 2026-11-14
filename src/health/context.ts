import {groupStates, latest, type Log} from './data';
import {GROUPS, MISSION, format, indicatorsOf, riskFor, type Environment} from './model';

/** Plain-text snapshot of the crew member's health, sent with each Orbi question. */
export function buildContext(log: Log, day: number, env: Environment): string {
  const states = groupStates(log, day);
  const lines = [
    `Crew member: ${MISSION.crew} (${MISSION.role}), ${MISSION.name}`,
    `Mission day ${day} · Environment: ${env.name} (${env.gravity}, one-way signal delay to Earth ${env.delay}${env.autonomous ? ', crew must act autonomously' : ''})`,
    '',
    'Body systems (latest readings):',
  ];
  for (const g of GROUPS) {
    const s = states[g.id];
    lines.push(`- ${g.name}: ${s.status}${s.tier !== 'none' ? ` (escalation: ${s.tier})` : ''}`);
    for (const i of indicatorsOf(g.id)) {
      const {value, day: at} = latest(log, i.id, day);
      if (!value) { lines.push(`  · ${i.label}: no reading`); continue; }
      const a = i.assess(value), risk = riskFor(i, a);
      lines.push(`  · ${i.label}: ${format(i, value)} ${i.unit} (normal ${i.range}; ${a.status}${risk ? `, ${risk}` : ''}; day ${at})`);
    }
  }
  lines.push('', 'Thresholds are simulated demo values.');
  return lines.join('\n');
}
