import type {Part, SystemId} from '../atlas/anatomy';

export type Status = 'normal' | 'watch' | 'alert';
export type Direction = 'low' | 'high';
export interface Assessment {status: Status; direction?: Direction}

export type IndicatorId = 'bp' | 'hr' | 'glucose' | 'temp' | 'sleep' | 'mood' | 'bone' | 'muscle';
export type GroupId = 'heart' | 'brain' | 'metabolism' | 'immune' | 'bones' | 'muscles';
/** Values are arrays so blood pressure can carry systolic/diastolic. */
export type Reading = number[];

/** Normal range is [watchLow, watchHigh]; outside [alertLow, alertHigh] is an alert. */
interface Bands {alertLow: number; watchLow: number; watchHigh: number; alertHigh: number}

const RANK: Record<Status, number> = {normal: 0, watch: 1, alert: 2};
export const worst = (list: Assessment[]): Assessment =>
  list.reduce<Assessment>((a, b) => (RANK[b.status] > RANK[a.status] ? b : a), {status: 'normal'});

function band(v: number, b: Bands): Assessment {
  if (v < b.alertLow) return {status: 'alert', direction: 'low'};
  if (v > b.alertHigh) return {status: 'alert', direction: 'high'};
  if (v < b.watchLow) return {status: 'watch', direction: 'low'};
  if (v > b.watchHigh) return {status: 'watch', direction: 'high'};
  return {status: 'normal'};
}

export interface Indicator {
  id: IndicatorId;
  label: string;
  unit: string;
  group: GroupId;
  /** How the value is collected. `scan` values come from onboard equipment. */
  input: 'bp' | 'number' | 'scale' | 'scan';
  min: number;
  max: number;
  step: number;
  how: string;
  /** Normal range shown to the user. */
  range: string;
  assess: (v: Reading) => Assessment;
  actions: Partial<Record<`${Status}-${Direction}` | Status, string[]>>;
}

// Thresholds follow common clinical reference ranges (AHA, ADA, NSF) and HRP risk notes.
// Demo values only — not a medical device.
export const INDICATORS: Indicator[] = [
  {
    id: 'bp', label: 'Blood pressure', unit: 'mmHg', group: 'heart', input: 'bp', min: 50, max: 220, step: 1,
    how: 'Seated, arm at heart level, after 5 min rest.', range: '90–129 / 60–79',
    assess: ([s, d]) => worst([
      band(s, {alertLow: 90, watchLow: 90, watchHigh: 129, alertHigh: 139}),
      band(d ?? 70, {alertLow: 60, watchLow: 60, watchHigh: 79, alertHigh: 89}),
    ]),
    actions: {
      'watch-high': ['Recheck in 15 min', 'Reduce sodium today', 'Keep daily aerobic exercise'],
      'alert-high': ['Recheck now, both arms', 'Stop strenuous activity', 'Contact flight surgeon'],
      'alert-low': ['Lie down, legs raised', 'Drink 500 mL fluids', 'Contact flight surgeon'],
    },
  },
  {
    id: 'hr', label: 'Resting heart rate', unit: 'bpm', group: 'heart', input: 'number', min: 30, max: 200, step: 1,
    how: 'At rest, before coffee or exercise. Count 60 s.', range: '60–100',
    assess: ([v]) => band(v, {alertLow: 50, watchLow: 60, watchHigh: 100, alertHigh: 110}),
    actions: {
      'watch-high': ['Rest 10 min and recheck', 'Hydrate'],
      'watch-low': ['Recheck after standing 2 min'],
      'alert-high': ['Stop activity, sit down', 'Record an ECG', 'Contact flight surgeon'],
      'alert-low': ['Record an ECG', 'Contact flight surgeon'],
    },
  },
  {
    id: 'glucose', label: 'Blood sugar', unit: 'mg/dL', group: 'metabolism', input: 'number', min: 20, max: 400, step: 1,
    how: 'Fasting, finger-prick meter.', range: '70–99',
    assess: ([v]) => band(v, {alertLow: 54, watchLow: 70, watchHigh: 99, alertHigh: 125}),
    actions: {
      'watch-high': ['Review meal timing', 'Add a walk or cycle session after meals'],
      'alert-high': ['Recheck in 1 h', 'Contact flight surgeon'],
      'watch-low': ['Eat a snack now', 'Recheck in 15 min'],
      'alert-low': ['Take 15 g fast sugar now', 'Recheck in 15 min', 'Alert a crewmate'],
    },
  },
  {
    id: 'temp', label: 'Body temperature', unit: '°C', group: 'immune', input: 'number', min: 33, max: 42, step: 0.1,
    how: 'Oral thermometer, 15 min after eating or drinking.', range: '36.1–37.4',
    assess: ([v]) => band(v, {alertLow: 35.5, watchLow: 36.1, watchHigh: 37.4, alertHigh: 37.9}),
    actions: {
      'watch-high': ['Hydrate and rest', 'Recheck in 2 h'],
      'alert-high': ['Limit contact with crew', 'Recheck in 1 h', 'Contact flight surgeon'],
      'watch-low': ['Add a layer, warm drink', 'Recheck in 1 h'],
      'alert-low': ['Warm up now', 'Contact flight surgeon'],
    },
  },
  {
    id: 'sleep', label: 'Sleep', unit: 'h', group: 'brain', input: 'number', min: 0, max: 16, step: 0.5,
    how: 'Hours actually asleep last night.', range: '7–9',
    assess: ([v]) => band(v, {alertLow: 6, watchLow: 7, watchHigh: 9.5, alertHigh: 12}),
    actions: {
      'watch-low': ['Dim lights 1 h before bed', 'Keep a fixed sleep window', 'No screens in the sleep station'],
      'alert-low': ['Request a schedule adjustment', 'Talk to the flight surgeon'],
      'watch-high': ['Check for fatigue or illness'],
    },
  },
  {
    id: 'mood', label: 'Mood', unit: '/ 5', group: 'brain', input: 'scale', min: 1, max: 5, step: 1,
    how: 'How do you feel today, overall?', range: '4–5',
    assess: ([v]) => band(v, {alertLow: 3, watchLow: 4, watchHigh: 5, alertHigh: 5}),
    actions: {
      'watch-low': ['Schedule a private call home', 'Do a leisure activity', 'Share a meal with the crew'],
      'alert-low': ['Talk to the behavioral health team', 'Tell a crewmate how you feel'],
    },
  },
  {
    id: 'bone', label: 'Bone density', unit: '%', group: 'bones', input: 'scan', min: -20, max: 5, step: 0.1,
    how: 'Change vs. preflight baseline. Weekly scan.', range: '> −3 %',
    assess: ([v]) => band(v, {alertLow: -6, watchLow: -3, watchHigh: 100, alertHigh: 100}),
    actions: {
      'watch-low': ['Daily resistance session (ARED)', 'Calcium + vitamin D with meals'],
      'alert-low': ['Increase resistance load', 'Contact flight surgeon'],
    },
  },
  {
    id: 'muscle', label: 'Muscle mass', unit: '%', group: 'muscles', input: 'scan', min: -30, max: 5, step: 0.1,
    how: 'Change vs. preflight baseline. Weekly scan.', range: '> −5 %',
    assess: ([v]) => band(v, {alertLow: -10, watchLow: -5, watchHigh: 100, alertHigh: 100}),
    actions: {
      'watch-low': ['Add one resistance session', 'Protein with every meal'],
      'alert-low': ['Review exercise plan', 'Contact flight surgeon'],
    },
  },
];
export const INDICATOR = Object.fromEntries(INDICATORS.map(i => [i.id, i])) as Record<IndicatorId, Indicator>;
export const DAILY = INDICATORS.filter(i => i.input !== 'scan');

export function actionsFor(indicator: Indicator, a: Assessment): string[] {
  if (a.status === 'normal') return [];
  const specific = a.direction ? indicator.actions[`${a.status}-${a.direction}`] : undefined;
  return specific ?? indicator.actions[a.status] ?? [];
}

export function format(indicator: Indicator, v: Reading | undefined): string {
  if (!v) return '—';
  if (indicator.input === 'bp') return `${Math.round(v[0])}/${Math.round(v[1])}`;
  const digits = indicator.step < 1 ? 1 : 0;
  const text = v[0].toFixed(digits);
  return indicator.input === 'scan' && v[0] > 0 ? `+${text}` : text;
}

// --- Body systems ------------------------------------------------------------

export type Hazard = 'Radiation' | 'Isolation' | 'Distance' | 'Gravity' | 'Closed environment';

export interface Group {
  id: GroupId;
  name: string;
  role: string;
  hazards: Hazard[];
  why: string;
  systems: SystemId[];
  /** Neutral systems shown around the group for context. */
  context?: SystemId[];
  /** Which parts the camera frames when the group is selected. */
  focus?: (p: Part) => boolean;
}

/** Vertical center of a part, in meters. */
const center = (p: Part) => (p.bounds[0][1] + p.bounds[1][1]) / 2;

export const GROUPS: Group[] = [
  {
    id: 'heart', name: 'Heart', systems: ['cardiac', 'arterial', 'venous'],
    role: 'Pumps blood to every tissue.', hazards: ['Gravity', 'Radiation'],
    why: 'Without gravity, fluids shift to the head and the heart adapts. Radiation may damage vessels.',
    focus: p => p.system === 'cardiac' && center(p) < 1.45, // brain ventricles are tagged cardiac in the source
  },
  {
    id: 'brain', name: 'Brain', systems: ['nervous'],
    role: 'Controls sleep, mood, and focus.', hazards: ['Isolation', 'Distance'],
    why: 'Confinement, distance from home, and shifted light cycles disrupt sleep and mood.',
    focus: p => p.system === 'nervous' && center(p) > 1.45,
  },
  {
    id: 'metabolism', name: 'Metabolism', systems: ['digestive'],
    role: 'Turns food into energy.', hazards: ['Closed environment', 'Gravity'],
    why: 'Limited menus and less activity can change how the body handles sugar.',
    context: ['arterial', 'venous'],
    focus: p => p.system === 'digestive' && center(p) < 1.4,
  },
  {
    id: 'immune', name: 'Immune', systems: ['lymphatic'],
    role: 'Defends against infection.', hazards: ['Radiation', 'Closed environment'],
    why: 'Stress and radiation weaken immunity while microbes thrive in a closed cabin.',
    context: ['arterial', 'venous'],
    focus: p => p.system === 'lymphatic',
  },
  {
    id: 'bones', name: 'Bones', systems: ['skeletal'],
    role: 'Support the body and store minerals.', hazards: ['Gravity'],
    why: 'In microgravity, weight-bearing bones lose 1–1.5 % of mass per month.',
  },
  {
    id: 'muscles', name: 'Muscles', systems: ['muscular'],
    role: 'Move and stabilize the body.', hazards: ['Gravity'],
    why: 'Unloaded muscles shrink fast without daily resistance exercise.',
  },
];
export const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<GroupId, Group>;
export const groupOfSystem = (s: SystemId) => GROUPS.find(g => g.systems.includes(s))?.id ?? null;

// --- Mission environments ------------------------------------------------------

export type EnvironmentId = 'iss' | 'orion' | 'moon' | 'mars';
export interface Environment {
  id: EnvironmentId;
  name: string;
  gravity: string;
  /** One-way signal delay to Earth. */
  delay: string;
  /** Bone and muscle loss multiplier versus microgravity. */
  unloading: number;
  autonomous: boolean;
}
export const ENVIRONMENTS: Environment[] = [
  {id: 'iss', name: 'Space station', gravity: '0 g', delay: '< 1 s', unloading: 1, autonomous: false},
  {id: 'orion', name: 'Spacecraft', gravity: '0 g', delay: '1.3 s', unloading: 1, autonomous: false},
  {id: 'moon', name: 'Lunar base', gravity: '0.17 g', delay: '1.3 s', unloading: 0.7, autonomous: false},
  {id: 'mars', name: 'Mars base', gravity: '0.38 g', delay: '4–24 min', unloading: 0.5, autonomous: true},
];

export const MISSION_DAYS = 180;
export const TODAY = 87;

/** Normal band drawn on trend charts (first value of each reading). */
export const NORMAL: Record<IndicatorId, [number, number]> = {
  bp: [90, 129], hr: [60, 100], glucose: [70, 99], temp: [36.1, 37.4],
  sleep: [7, 9.5], mood: [4, 5], bone: [-3, 1], muscle: [-5, 1],
};
