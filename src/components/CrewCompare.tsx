import {Users} from 'lucide-react';
import {crewSummary, useCrewPanel, type PanelAnalyte} from '../health/nasa';
import {format, type Indicator, type Reading} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  indicator: Indicator;
  value?: Reading;
}

const ANALYTES: PanelAnalyte[] = ['glucose', 'calcium', 'creatinine'];
export const hasCrewData = (id: string): id is PanelAnalyte => (ANALYTES as string[]).includes(id);

/**
 * Compares the crew member's latest value with real astronaut blood work
 * (NASA OSDR OSD-575, SpaceX Inspiration4): pre-flight mean, landing-day mean and range.
 */
export default function CrewCompare({indicator, value}: Props) {
  const panel = useCrewPanel();
  const {t} = useI18n();
  if (!panel || !hasCrewData(indicator.id)) return null;
  const s = crewSummary(panel, indicator.id);
  const digits = indicator.id === 'creatinine' ? 2 : indicator.id === 'calcium' ? 1 : 0;
  const f = (n: number) => n.toFixed(digits);

  // Position markers on a shared scale (lab range ± margin).
  const lo = Math.min(s.min, s.range.min, value?.[0] ?? Infinity), hi = Math.max(s.max, s.range.max, value?.[0] ?? -Infinity);
  const pad = (hi - lo) * 0.08, a = lo - pad, b = hi + pad;
  const x = (v: number) => ((v - a) / (b - a)) * 100;

  return (
    <div className="crew-compare">
      <div className="card-kicker"><Users aria-hidden="true" />{t('crew.title')}</div>
      <svg className="crew-scale" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <rect className="crew-lab" x={x(s.range.min)} y="8" width={x(s.range.max) - x(s.range.min)} height="4" rx="2" />
        <rect className="crew-span" x={x(s.min)} y="9" width={Math.max(0.5, x(s.max) - x(s.min))} height="2" />
        <circle className="crew-pre" cx={x(s.preflight)} cy="10" r="2.2" />
        <circle className="crew-landing" cx={x(s.landing)} cy="10" r="2.2" />
        {value && <path className="crew-you" d={`M${x(value[0])} 2 V18`} />}
      </svg>
      <dl className="crew-stats">
        <div><dt><span className="dot crew-dot-pre" />{t('crew.pre')}</dt><dd>{f(s.preflight)}</dd></div>
        <div><dt><span className="dot crew-dot-landing" />{t('crew.landing')}</dt><dd>{f(s.landing)}</dd></div>
        <div><dt>{t('crew.range')}</dt><dd>{f(s.min)}–{f(s.max)}</dd></div>
        {value && <div><dt><span className="crew-you-mark" />{t('crew.you')}</dt><dd>{format(indicator, value)}</dd></div>}
      </dl>
      <a className="crew-source" href={panel.url} target="_blank" rel="noreferrer">{t('crew.source')}</a>
    </div>
  );
}
