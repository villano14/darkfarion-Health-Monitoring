import type {Part, SystemId} from '../atlas/anatomy';

export type Status = 'normal' | 'watch' | 'alert';
export type Direction = 'low' | 'high';
export interface Assessment {status: Status; direction?: Direction}

export type IndicatorId = 'bp' | 'hr' | 'glucose' | 'temp' | 'sleep' | 'mood' | 'water' | 'calcium' | 'creatinine' | 'radiation' | 'solar' | 'bone' | 'muscle';
export type GroupId = 'heart' | 'brain' | 'metabolism' | 'kidneys' | 'immune' | 'bones' | 'muscles';
/** Values are arrays so blood pressure can carry systolic/diastolic. */
export type Reading = number[];

/** Normal range is [watchLow, watchHigh]; outside [alertLow, alertHigh] is an alert. */
export interface Bands {alertLow: number; watchLow: number; watchHigh: number; alertHigh: number}

const RANK: Record<Status, number> = {normal: 0, watch: 1, alert: 2};
export const worst = (list: Assessment[]): Assessment =>
  list.reduce<Assessment>((a, b) => (RANK[b.status] > RANK[a.status] ? b : a), {status: 'normal'});

export function band(v: number, b: Bands): Assessment {
  if (v < b.alertLow) return {status: 'alert', direction: 'low'};
  if (v > b.alertHigh) return {status: 'alert', direction: 'high'};
  if (v < b.watchLow) return {status: 'watch', direction: 'low'};
  if (v > b.watchHigh) return {status: 'watch', direction: 'high'};
  return {status: 'normal'};
}

export type ActionKey = `${Exclude<Status, 'normal'>}-${Direction}` | Status;

export interface Indicator {
  id: IndicatorId;
  label: string;
  unit: string;
  group: GroupId;
  /** How the value is collected. `scan` values come from onboard equipment automatically. */
  input: 'bp' | 'number' | 'scale' | 'scan';
  min: number;
  max: number;
  step: number;
  /** One-line hint shown in the check-in form. */
  how: string;
  /** Normal range shown to the user. */
  range: string;
  /** Band drawn on charts (first value of each reading). */
  normal: [number, number];
  /** Onboard equipment used to take it. */
  device: string;
  /** Why the exam matters. */
  why: string;
  /** How spaceflight hazards change it. */
  space: string;
  /** Guided measurement. */
  steps: string[];
  assess: (v: Reading) => Assessment;
  /** `normal` holds prevention: what keeps the value in range. */
  actions: Partial<Record<ActionKey, string[]>>;
  /** Where the threshold comes from. */
  source?: string;
}

/** Filled from the backend catalog (GET /api/catalog) before the app renders. */
export const INDICATORS: Indicator[] = [];

export const INDICATOR = {} as Record<IndicatorId, Indicator>;
/** Indicators the astronaut logs every day (everything not read by onboard equipment). */
export const DAILY: Indicator[] = [];

export function actionsFor(indicator: Indicator, a: Assessment): string[] {
  const specific = a.direction ? indicator.actions[`${a.status as 'watch' | 'alert'}-${a.direction}`] : undefined;
  return specific ?? indicator.actions[a.status] ?? [];
}

export function format(indicator: Indicator, v: Reading | undefined): string {
  if (!v) return '—';
  if (indicator.input === 'bp') return `${Math.round(v[0])}/${Math.round(v[1])}`;
  const digits = indicator.step < 1 ? 1 : 0;
  const text = v[0].toFixed(digits);
  if (indicator.id === 'creatinine') return v[0].toFixed(2);
  return (indicator.id === 'bone' || indicator.id === 'muscle') && v[0] > 0 ? `+${text}` : text;
}

// --- Escalation ----------------------------------------------------------------

/** Who should act: the astronaut, the crew, or the flight surgeon on the ground. */
export type Tier = 'none' | 'self' | 'crew' | 'surgeon';
export const TIERS: {id: Exclude<Tier, 'none'>; label: string; rule: string}[] = [];
export function tierFor(status: Status, alertStreak: number): Tier {
  if (status === 'normal') return 'none';
  if (status === 'watch') return 'self';
  return alertStreak >= 2 ? 'surgeon' : 'crew';
}

// --- Body systems ------------------------------------------------------------

/** Hazard id from the catalog: radiation, isolation, distance, gravity, closed-environment. */
export type Hazard = string;

export interface Group {
  id: GroupId;
  name: string;
  role: string;
  hazards: Hazard[];
  systems: SystemId[];
  /** Neutral systems shown around the group for context. */
  context?: SystemId[];
  /** Which parts the camera frames when the group is selected. */
  focus?: (p: Part) => boolean;
}

/** Vertical center of a part, in meters. */
const center = (p: Part) => (p.bounds[0][1] + p.bounds[1][1]) / 2;

/** Which parts the camera frames per group. Tied to the 3D model, so it stays in the frontend. */
export const FOCUS: Partial<Record<GroupId, (p: Part) => boolean>> = {
  heart: p => p.system === 'cardiac' && center(p) < 1.45, // brain ventricles are tagged cardiac in the source
  brain: p => p.system === 'nervous' && center(p) > 1.45,
  metabolism: p => p.system === 'digestive' && center(p) < 1.4,
  kidneys: p => p.system === 'urinary',
  immune: p => p.system === 'lymphatic',
};

export const GROUPS: Group[] = [];
export const GROUP = {} as Record<GroupId, Group>;
export const groupOfSystem = (s: SystemId) => GROUPS.find(g => g.systems.includes(s))?.id ?? null;
export const indicatorsOf = (g: GroupId) => INDICATORS.filter(i => i.group === g);

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
  /** Typical daily dose in mSv (ISS dosimetry, MSL-RAD cruise and surface, Chang'e-4 LND). */
  dose: number;
  autonomous: boolean;
}
export const ENVIRONMENTS: Environment[] = [];

/** Current mission, set from GET /api/me. ES module bindings are live, so importers see updates. */
export let MISSION = {name: '', crew: '', role: '', initials: ''};
export let MISSION_DAYS = 0;
/** Today's mission day. */
export let TODAY = 1;
export function setMission(m: typeof MISSION, today: number, days: number) {
  MISSION = m;
  TODAY = Math.max(1, today);
  MISSION_DAYS = days;
}

// --- Possible conditions -------------------------------------------------------

/** Preliminary risk name per out-of-range reading. A hint for the crew, not a diagnosis. */
export const RISKS = {} as Record<IndicatorId, Partial<Record<ActionKey, string>>>;
export function riskFor(indicator: Indicator, a: Assessment): string | undefined {
  if (a.status === 'normal' || !a.direction) return undefined;
  return RISKS[indicator.id][`${a.status}-${a.direction}`];
}
