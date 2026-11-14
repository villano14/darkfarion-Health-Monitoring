import type {Part, SystemId} from '../atlas/anatomy';

export type Status = 'normal' | 'watch' | 'alert';
export type Direction = 'low' | 'high';
export interface Assessment {status: Status; direction?: Direction}

export type IndicatorId = 'bp' | 'hr' | 'glucose' | 'temp' | 'sleep' | 'mood' | 'water' | 'calcium' | 'creatinine' | 'radiation' | 'solar' | 'bone' | 'muscle';
export type GroupId = 'heart' | 'brain' | 'metabolism' | 'kidneys' | 'immune' | 'bones' | 'muscles';
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

// Thresholds follow common clinical reference ranges (AHA, ADA, NSF) and NASA HRP risk notes.
// Demo values only — not a medical device.
export const INDICATORS: Indicator[] = [
  {
    id: 'bp', label: 'Blood pressure', unit: 'mmHg', group: 'heart', input: 'bp', min: 50, max: 220, step: 1,
    how: 'Seated, arm at heart level, after 5 min rest.', range: '90–129 / 60–79', normal: [90, 129],
    device: 'Automatic arm cuff',
    why: 'Spots strain on the heart and vessels before it causes symptoms.',
    space: 'Fluids shift toward the head in weightlessness, and the heart and vessels adapt to it.',
    steps: ['Sit still for 5 minutes', 'Strap the cuff on the bare upper arm', 'Rest the arm at heart level', 'Press start and stay silent'],
    assess: ([s, d]) => worst([
      band(s, {alertLow: 90, watchLow: 90, watchHigh: 129, alertHigh: 139}),
      band(d ?? 70, {alertLow: 60, watchLow: 60, watchHigh: 79, alertHigh: 89}),
    ]),
    actions: {
      normal: ['30 min on the cycle ergometer', 'Keep sodium low'],
      'watch-high': ['Recheck in 15 min', 'Reduce sodium today', 'Keep daily aerobic exercise'],
      'alert-high': ['Recheck now, both arms', 'Stop strenuous activity', 'Tell a crewmate'],
      'alert-low': ['Lie down, legs raised', 'Drink 500 mL of fluids', 'Tell a crewmate'],
    },
  },
  {
    id: 'hr', label: 'Resting heart rate', unit: 'bpm', group: 'heart', input: 'number', min: 30, max: 200, step: 1,
    how: 'At rest, before coffee or exercise. Count 60 s.', range: '60–100', normal: [60, 100],
    device: 'Cuff or chest-strap monitor',
    why: 'A rising resting rate can signal fatigue, dehydration, or illness.',
    space: 'Without gravity the heart works less and can lose fitness over months.',
    steps: ['Measure before getting up', 'Find the pulse at the wrist', 'Count beats for 60 seconds'],
    assess: ([v]) => band(v, {alertLow: 50, watchLow: 60, watchHigh: 100, alertHigh: 110}),
    actions: {
      normal: ['Keep aerobic sessions 5 days a week'],
      'watch-high': ['Rest 10 min and recheck', 'Hydrate'],
      'watch-low': ['Recheck after standing for 2 min'],
      'alert-high': ['Stop activity and sit down', 'Record an ECG', 'Tell a crewmate'],
      'alert-low': ['Record an ECG', 'Tell a crewmate'],
    },
  },
  {
    id: 'glucose', label: 'Blood sugar', unit: 'mg/dL', group: 'metabolism', input: 'number', min: 20, max: 400, step: 1,
    how: 'Fasting, finger-prick meter.', range: '70–99', normal: [70, 99],
    device: 'Finger-prick glucose meter',
    why: 'Shows how well the body turns food into energy.',
    space: 'Less movement and a fixed menu can make the body handle sugar worse.',
    steps: ['Measure before breakfast', 'Clean the fingertip and let it dry', 'Prick the side of the finger', 'Touch the drop to the strip'],
    assess: ([v]) => band(v, {alertLow: 54, watchLow: 70, watchHigh: 99, alertHigh: 125}),
    actions: {
      normal: ['Spread meals across the day', 'Walk or cycle after meals'],
      'watch-high': ['Review meal timing', 'Add a cycle session after meals'],
      'alert-high': ['Recheck in 1 h', 'Tell a crewmate'],
      'watch-low': ['Eat a snack now', 'Recheck in 15 min'],
      'alert-low': ['Take 15 g of fast sugar now', 'Recheck in 15 min', 'Tell a crewmate'],
    },
  },
  {
    id: 'water', label: 'Fluid intake', unit: 'L', group: 'kidneys', input: 'number', min: 0, max: 8, step: 0.1,
    how: 'Total drinks logged since waking.', range: '2.0–4.0', normal: [2, 4],
    device: 'Drink bag counter',
    why: 'Low fluid intake concentrates urine and favors kidney stones.',
    space: 'Bones release calcium in weightlessness, and thirst is weaker, so stones form more easily.',
    steps: ['Count each drink bag', 'Add soups and rehydrated meals', 'Log the total in liters'],
    assess: ([v]) => band(v, {alertLow: 1.5, watchLow: 2, watchHigh: 4, alertHigh: 6}),
    actions: {
      normal: ['Keep a drink bag in reach'],
      'watch-low': ['Drink 500 mL in the next hour', 'Set a drink reminder'],
      'alert-low': ['Drink 1 L over 2 hours', 'Watch for flank pain', 'Tell a crewmate'],
      'watch-high': ['Spread drinks across the day'],
    },
  },
  {
    id: 'calcium', label: 'Blood calcium', unit: 'mg/dL', group: 'kidneys', input: 'scan', min: 5, max: 15, step: 0.1,
    how: 'Weekly blood check.', range: '8.6–10.3', normal: [8.6, 10.3],
    device: 'Handheld blood analyzer',
    why: 'Calcium released from bone raises the risk of kidney stones.',
    space: 'Without load, bones release calcium into the blood and urine.',
    steps: ['Clean the fingertip and let it dry', 'Fill the analyzer cartridge with one drop', 'Results sync automatically'],
    assess: ([v]) => band(v, {alertLow: 8, watchLow: 8.6, watchHigh: 10.3, alertHigh: 11}),
    actions: {
      normal: ['Keep fluids above 2 L a day'],
      'watch-high': ['Drink 500 mL more today', 'Limit salt and animal protein'],
      'alert-high': ['Recheck with the analyzer', 'Watch for flank pain', 'Tell a crewmate'],
      'watch-low': ['Calcium and vitamin D with meals'],
      'alert-low': ['Recheck with the analyzer', 'Tell a crewmate'],
    },
  },
  {
    id: 'creatinine', label: 'Creatinine', unit: 'mg/dL', group: 'kidneys', input: 'scan', min: 0.1, max: 5, step: 0.01,
    how: 'Weekly blood check.', range: '0.6–1.35', normal: [0.6, 1.35],
    device: 'Handheld blood analyzer',
    why: 'Shows how well the kidneys filter the blood.',
    space: 'Dehydration and fluid shifts change how the kidneys filter.',
    steps: ['Clean the fingertip and let it dry', 'Fill the analyzer cartridge with one drop', 'Results sync automatically'],
    assess: ([v]) => band(v, {alertLow: 0.3, watchLow: 0.6, watchHigh: 1.35, alertHigh: 1.8}),
    actions: {
      normal: ['Keep fluids above 2 L a day'],
      'watch-high': ['Drink 500 mL more today', 'Recheck next week'],
      'alert-high': ['Recheck with the analyzer', 'Tell a crewmate'],
      'watch-low': ['Check your muscle mass trend'],
    },
  },
  {
    id: 'temp', label: 'Body temperature', unit: '°C', group: 'immune', input: 'number', min: 33, max: 42, step: 0.1,
    how: 'Oral thermometer, 15 min after eating or drinking.', range: '36.1–37.4', normal: [36.1, 37.4],
    device: 'Digital oral thermometer',
    why: 'Fever is the first sign of an infection.',
    space: 'Stress and radiation weaken immunity, and microbes spread easily in a closed cabin.',
    steps: ['Wait 15 min after eating or drinking', 'Place the tip under the tongue', 'Close the mouth until it beeps'],
    assess: ([v]) => band(v, {alertLow: 35.5, watchLow: 36.1, watchHigh: 37.4, alertHigh: 37.9}),
    actions: {
      normal: ['Wash hands before meals', 'Sleep 7 h or more'],
      'watch-high': ['Hydrate and rest', 'Recheck in 2 h'],
      'alert-high': ['Limit contact with the crew', 'Recheck in 1 h', 'Tell a crewmate'],
      'watch-low': ['Add a layer and have a warm drink', 'Recheck in 1 h'],
      'alert-low': ['Warm up now', 'Tell a crewmate'],
    },
  },
  {
    id: 'radiation', label: 'Radiation dose', unit: 'mSv', group: 'immune', input: 'scan', min: 0, max: 1000, step: 0.1,
    how: 'Total since launch, read from your dosimeter.', range: '< 180', normal: [0, 180],
    device: 'Personal dosimeter',
    why: 'Total dose sets long-term cancer risk and limits mission time.',
    space: 'Beyond Earth\'s shield, cosmic rays and solar storms add dose every day.',
    steps: ['Wear the dosimeter at all times', 'Dock it daily to sync', 'Shelter if a solar storm alert sounds'],
    assess: ([v]) => band(v, {alertLow: -1, watchLow: -1, watchHigh: 180, alertHigh: 360}),
    actions: {
      normal: ['Sleep in the shielded crew quarters'],
      'watch-high': ['Limit time in low-shield modules', 'Review dose plan with the crew'],
      'alert-high': ['Move to the storm shelter', 'Tell a crewmate'],
    },
  },
  {
    id: 'solar', label: 'Solar particle events', unit: 'events', group: 'immune', input: 'scan', min: 0, max: 20, step: 1,
    how: 'Live feed, last 3 days.', range: '0', normal: [0, 0],
    device: 'NASA DONKI space weather feed',
    why: 'A solar storm can deliver a large radiation dose in hours.',
    space: 'Outside Earth\'s magnetic field, solar particle events are the biggest short-term radiation threat.',
    steps: ['Watch for the solar storm alert', 'Move to the shielded storm shelter', 'Stay until the all-clear'],
    assess: ([v]) => band(v, {alertLow: -1, watchLow: -1, watchHigh: 0, alertHigh: 0}),
    actions: {
      normal: ['Know your route to the storm shelter'],
      'alert-high': ['Move to the storm shelter now', 'Stay until the all-clear', 'Tell a crewmate'],
    },
  },
  {
    id: 'sleep', label: 'Sleep', unit: 'h', group: 'brain', input: 'number', min: 0, max: 16, step: 0.5,
    how: 'Hours actually asleep last night.', range: '7–9', normal: [7, 9.5],
    device: 'Sleep log or wrist actigraph',
    why: 'Short sleep slows reactions and raises the risk of errors.',
    space: 'Sixteen sunrises a day, noise, and stress break the body clock.',
    steps: ['Note the time you fell asleep', 'Note the time you woke', 'Subtract time spent awake'],
    assess: ([v]) => band(v, {alertLow: 6, watchLow: 7, watchHigh: 9.5, alertHigh: 12}),
    actions: {
      normal: ['Keep the same sleep window', 'Dim lights 1 h before bed'],
      'watch-low': ['Dim lights 1 h before bed', 'Keep a fixed sleep window', 'No screens in the sleep station'],
      'alert-low': ['Request a schedule change', 'Tell a crewmate'],
      'watch-high': ['Check for fatigue or illness'],
    },
  },
  {
    id: 'mood', label: 'Mood', unit: '/ 5', group: 'brain', input: 'scale', min: 1, max: 5, step: 1,
    how: 'How do you feel today, overall?', range: '4–5', normal: [4, 5],
    device: 'Self-report',
    why: 'Low mood over days affects sleep, teamwork, and safety.',
    space: 'Isolation, confinement, and distance from home weigh on mood.',
    steps: ['Pause for a moment', 'Think about the whole day', 'Pick the face that fits'],
    assess: ([v]) => band(v, {alertLow: 3, watchLow: 4, watchHigh: 5, alertHigh: 5}),
    actions: {
      normal: ['Share a meal with the crew', 'Keep a weekly call home'],
      'watch-low': ['Schedule a private call home', 'Make time for a hobby', 'Share a meal with the crew'],
      'alert-low': ['Talk to the behavioral health team', 'Tell a crewmate how you feel'],
    },
  },
  {
    id: 'bone', label: 'Bone density', unit: '%', group: 'bones', input: 'scan', min: -20, max: 5, step: 0.1,
    how: 'Change vs. preflight baseline.', range: '> −3 %', normal: [-3, 1],
    device: 'Weekly ultrasound scan',
    why: 'Weaker bones break more easily after landing.',
    space: 'Without load, hip and spine bones lose 1–1.5 % of mass each month.',
    steps: ['Scheduled weekly by the flight surgeon', 'Scan the heel and hip with the probe', 'Results sync automatically'],
    assess: ([v]) => band(v, {alertLow: -6, watchLow: -3, watchHigh: 100, alertHigh: 100}),
    actions: {
      normal: ['Daily resistance session', 'Calcium and vitamin D with meals'],
      'watch-low': ['Add load to resistance sessions', 'Calcium and vitamin D with meals'],
      'alert-low': ['Review the exercise plan', 'Tell a crewmate'],
    },
  },
  {
    id: 'muscle', label: 'Muscle mass', unit: '%', group: 'muscles', input: 'scan', min: -30, max: 5, step: 0.1,
    how: 'Change vs. preflight baseline.', range: '> −5 %', normal: [-5, 1],
    device: 'Weekly ultrasound scan',
    why: 'Strong muscles keep you safe during spacewalks and landing.',
    space: 'Legs and back shrink fast when they no longer hold the body up.',
    steps: ['Scheduled weekly by the flight surgeon', 'Scan thigh and calf with the probe', 'Results sync automatically'],
    assess: ([v]) => band(v, {alertLow: -10, watchLow: -5, watchHigh: 100, alertHigh: 100}),
    actions: {
      normal: ['Resistance training 6 days a week', 'Protein with every meal'],
      'watch-low': ['Add one resistance session', 'Protein with every meal'],
      'alert-low': ['Review the exercise plan', 'Tell a crewmate'],
    },
  },
];
/** Threshold sources, shown in the Learn tab. */
export const SOURCES: Record<IndicatorId, string> = {
  bp: 'AHA/ACC 2017 blood pressure guideline',
  hr: 'American Heart Association, adult resting heart rate',
  glucose: 'American Diabetes Association, fasting glucose; compared with NASA OSDR OSD-575 (Inspiration4)',
  water: 'NASA Human Research Program, Risk of Renal Stone Formation',
  calcium: 'Lab reference range in NASA OSDR OSD-575 (Inspiration4 metabolic panel)',
  creatinine: 'Lab reference range in NASA OSDR OSD-575 (Inspiration4 metabolic panel)',
  temp: 'Clinical reference range for oral temperature',
  radiation: 'NASA-STD-3001 Vol. 1: career limit 600 mSv (watch at 30 %, alert at 60 %)',
  solar: 'Live data from NASA DONKI (CCMC). NASA-STD-3001: 250 mSv limit per solar event',
  sleep: 'National Sleep Foundation and AASM adult sleep duration',
  mood: 'Self-report scale',
  bone: 'NASA Human Research Program, Risk of Early Onset Osteoporosis',
  muscle: 'NASA Human Research Program, Risk of Reduced Muscle Mass and Strength',
};
for (const i of INDICATORS) i.source = SOURCES[i.id];

export const INDICATOR = Object.fromEntries(INDICATORS.map(i => [i.id, i])) as Record<IndicatorId, Indicator>;
export const DAILY = INDICATORS.filter(i => i.input !== 'scan');

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
export const TIERS: {id: Exclude<Tier, 'none'>; label: string; rule: string}[] = [
  {id: 'self', label: 'Self-care', rule: 'Out of range'},
  {id: 'crew', label: 'Crew', rule: 'Alert'},
  {id: 'surgeon', label: 'Flight surgeon', rule: 'Alert 2 days in a row'},
];
export function tierFor(status: Status, alertStreak: number): Tier {
  if (status === 'normal') return 'none';
  if (status === 'watch') return 'self';
  return alertStreak >= 2 ? 'surgeon' : 'crew';
}

// --- Body systems ------------------------------------------------------------

export type Hazard = 'Radiation' | 'Isolation' | 'Distance' | 'Gravity' | 'Closed environment';

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

export const GROUPS: Group[] = [
  {
    id: 'heart', name: 'Heart', systems: ['cardiac', 'arterial', 'venous'],
    role: 'Pumps blood to every tissue.', hazards: ['Gravity', 'Radiation'],
    focus: p => p.system === 'cardiac' && center(p) < 1.45, // brain ventricles are tagged cardiac in the source
  },
  {
    id: 'brain', name: 'Brain', systems: ['nervous'],
    role: 'Controls sleep, mood, and focus.', hazards: ['Isolation', 'Distance'],
    focus: p => p.system === 'nervous' && center(p) > 1.45,
  },
  {
    id: 'metabolism', name: 'Metabolism', systems: ['digestive'], context: ['arterial', 'venous'],
    role: 'Turns food into energy.', hazards: ['Closed environment', 'Gravity'],
    focus: p => p.system === 'digestive' && center(p) < 1.4,
  },
  {
    id: 'kidneys', name: 'Kidneys', systems: ['urinary'], context: ['arterial', 'venous'],
    role: 'Filter blood and balance fluids.', hazards: ['Gravity', 'Closed environment'],
    focus: p => p.system === 'urinary',
  },
  {
    id: 'immune', name: 'Immune', systems: ['lymphatic'], context: ['arterial', 'venous'],
    role: 'Defends against infection and radiation damage.', hazards: ['Radiation', 'Closed environment'],
    focus: p => p.system === 'lymphatic',
  },
  {
    id: 'bones', name: 'Bones', systems: ['skeletal'],
    role: 'Support the body and store minerals.', hazards: ['Gravity'],
  },
  {
    id: 'muscles', name: 'Muscles', systems: ['muscular'],
    role: 'Move and stabilize the body.', hazards: ['Gravity'],
  },
];
export const GROUP = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<GroupId, Group>;
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
export const ENVIRONMENTS: Environment[] = [
  {id: 'iss', name: 'Space station', gravity: '0 g', delay: '< 1 s', unloading: 1, dose: 0.5, autonomous: false},
  {id: 'orion', name: 'Deep-space craft', gravity: '0 g', delay: '1.3 s', unloading: 1, dose: 1.8, autonomous: false},
  {id: 'moon', name: 'Lunar base', gravity: '0.17 g', delay: '1.3 s', unloading: 0.7, dose: 1.37, autonomous: false},
  {id: 'mars', name: 'Mars base', gravity: '0.38 g', delay: '4–24 min', unloading: 0.5, dose: 0.67, autonomous: true},
];

export const MISSION = {name: 'Expedition 7', crew: 'A. Rivera', role: 'Flight engineer', initials: 'AR'};
export const MISSION_DAYS = 180;
export const TODAY = 87;

// --- Possible conditions -------------------------------------------------------

/** Preliminary risk name per out-of-range reading. A hint for the crew, not a diagnosis. */
export const RISKS: Record<IndicatorId, Partial<Record<ActionKey, string>>> = {
  bp: {'watch-high': 'Elevated blood pressure', 'alert-high': 'Hypertension risk', 'alert-low': 'Low blood pressure'},
  hr: {'watch-high': 'Raised resting heart rate', 'alert-high': 'Tachycardia', 'watch-low': 'Low heart rate', 'alert-low': 'Bradycardia'},
  glucose: {'watch-high': 'Prediabetes range', 'alert-high': 'Hyperglycemia', 'watch-low': 'Low blood sugar', 'alert-low': 'Hypoglycemia'},
  water: {'watch-low': 'Low fluid intake', 'alert-low': 'Dehydration · kidney stone risk', 'watch-high': 'High fluid intake'},
  temp: {'watch-high': 'Mild fever', 'alert-high': 'Fever · possible infection', 'watch-low': 'Low body temperature', 'alert-low': 'Hypothermia risk'},
  radiation: {'watch-high': 'High cumulative dose', 'alert-high': 'Dose limit risk'},
  sleep: {'watch-low': 'Sleep deficit', 'alert-low': 'Severe sleep loss', 'watch-high': 'Oversleeping'},
  mood: {'watch-low': 'Low mood', 'alert-low': 'Behavioral health risk'},
  bone: {'watch-low': 'Bone loss', 'alert-low': 'Osteoporosis risk'},
  muscle: {'watch-low': 'Muscle loss', 'alert-low': 'Severe muscle atrophy'},
  calcium: {'watch-high': 'High blood calcium · kidney stone risk', 'alert-high': 'Hypercalcemia', 'watch-low': 'Low blood calcium', 'alert-low': 'Hypocalcemia'},
  creatinine: {'watch-high': 'Reduced kidney filtering', 'alert-high': 'Kidney function alert', 'watch-low': 'Low creatinine'},
  solar: {'alert-high': 'Solar particle event · shelter now'},
};
export function riskFor(indicator: Indicator, a: Assessment): string | undefined {
  if (a.status === 'normal' || !a.direction) return undefined;
  return RISKS[indicator.id][`${a.status}-${a.direction}`];
}
