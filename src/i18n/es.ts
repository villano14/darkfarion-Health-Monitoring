import type {ActionKey, EnvironmentId, GroupId, Hazard, IndicatorId, Tier} from '../health/model';

/**
 * Spanish health content. Like the English one in health/model.ts, it comes from the backend
 * catalog (GET /api/catalog) and is filled in by health/catalog.ts before the app renders.
 */
export interface IndicatorText {
  label: string;
  how: string;
  device: string;
  why: string;
  space: string;
  steps: string[];
  actions: Partial<Record<ActionKey, string[]>>;
  risks: Partial<Record<ActionKey, string>>;
  source?: string;
  unit?: string;
}

export const ES_INDICATORS = {} as Record<IndicatorId, IndicatorText>;
export const ES_SOURCES = {} as Record<IndicatorId, string>;
export const ES_GROUPS = {} as Record<GroupId, {name: string; role: string}>;
export const ES_HAZARDS: Record<Hazard, string> = {};
export const EN_HAZARDS: Record<Hazard, string> = {};
export const ES_ENVIRONMENTS = {} as Record<EnvironmentId, string>;
export const ES_TASKS: Record<string, string> = {};
export const ES_TIERS = {} as Record<Exclude<Tier, 'none'>, {label: string; rule: string}>;
