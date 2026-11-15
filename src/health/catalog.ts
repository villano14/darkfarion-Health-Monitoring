import type {Catalog} from '../api/client';
import {EN_HAZARDS, ES_ENVIRONMENTS, ES_GROUPS, ES_HAZARDS, ES_INDICATORS, ES_SOURCES, ES_TASKS, ES_TIERS} from '../i18n/es';
import {ACHIEVEMENTS, ROUTINE} from './data';
import {
  DAILY, ENVIRONMENTS, FOCUS, GROUP, GROUPS, INDICATOR, INDICATORS, RISKS, TIERS, band, worst,
  type ActionKey, type EnvironmentId, type GroupId, type IndicatorId, type Reading,
} from './model';
import type {SystemId} from '../atlas/anatomy';

/** Fills the catalog containers (model.ts, i18n/es.ts, data.ts) from GET /api/catalog. */
export function hydrateCatalog(c: Catalog) {
  INDICATORS.length = 0;
  DAILY.length = 0;
  for (const x of c.indicators) {
    const en = x.text.en, es = x.text.es;
    const id = x.id as IndicatorId;
    const indicator = {
      id, label: en.label, unit: en.unit ?? x.unit, group: x.group as GroupId, input: x.input,
      min: x.min, max: x.max, step: x.step, how: en.how, range: x.range, normal: x.normal,
      device: en.device, why: en.why, space: en.space, steps: en.steps, source: en.source,
      actions: en.actions as Partial<Record<ActionKey, string[]>>,
      // The worst band wins (blood pressure has one band per value).
      assess: (v: Reading) => worst(x.bands.map((b, k) => (v[k] === undefined ? {status: 'normal' as const} : band(v[k], b)))),
    };
    INDICATORS.push(indicator);
    INDICATOR[id] = indicator;
    if (x.input !== 'scan') DAILY.push(indicator);
    RISKS[id] = en.risks as Partial<Record<ActionKey, string>>;
    const {unit, ...rest} = es;
    // Only override the unit when the language has its own (e.g. "eventos").
    ES_INDICATORS[id] = {...rest, ...(unit ? {unit} : {}), actions: es.actions as Partial<Record<ActionKey, string[]>>, risks: es.risks as Partial<Record<ActionKey, string>>};
    ES_SOURCES[id] = es.source;
  }

  GROUPS.length = 0;
  for (const g of c.groups) {
    const id = g.id as GroupId;
    const group = {id, name: g.text.en.name, role: g.text.en.role, hazards: g.hazards, systems: g.systems as SystemId[], context: g.context as SystemId[], focus: FOCUS[id]};
    GROUPS.push(group);
    GROUP[id] = group;
    ES_GROUPS[id] = g.text.es;
  }

  for (const h of c.hazards) {
    EN_HAZARDS[h.id] = h.name.en;
    ES_HAZARDS[h.id] = h.name.es;
  }

  ENVIRONMENTS.length = 0;
  for (const e of c.environments) {
    const id = e.id as EnvironmentId;
    ENVIRONMENTS.push({id, name: e.name.en, gravity: e.gravity, delay: e.delay, unloading: e.unloading, dose: e.dose, autonomous: e.autonomous});
    ES_ENVIRONMENTS[id] = e.name.es;
  }

  TIERS.length = 0;
  for (const t of c.tiers) {
    TIERS.push({id: t.id, label: t.text.en.label, rule: t.text.en.rule});
    ES_TIERS[t.id] = t.text.es;
  }

  ROUTINE.length = 0;
  for (const t of c.tasks) {
    ROUTINE.push({id: t.id, time: t.time, label: t.label.en, kind: t.kind, points: t.points, indicators: t.indicators.length ? (t.indicators as IndicatorId[]) : undefined});
    ES_TASKS[t.id] = t.label.es;
  }

  ACHIEVEMENTS.length = 0;
  ACHIEVEMENTS.push(...c.achievements);
}
