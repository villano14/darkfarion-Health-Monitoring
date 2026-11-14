import {useState, type PointerEvent} from 'react';
import type {Point} from '../health/data';
import {format, type Indicator, type Status} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  indicator: Indicator;
  points: Point[];
  status: Status;
  /** Compact sparkline (no axes, no hover). */
  compact?: boolean;
}

const W = 320, H = 140, L = 34, R = 10, T = 12, B = 22;
const SW = 100, SH = 32;

/** Trend line over the shaded normal band. Sizes and colors live in CSS. */
export default function TrendChart({indicator, points, status, compact = false}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const {t} = useI18n();
  if (points.length < 2) return <div className={compact ? 'spark spark-empty' : 'chart chart-empty'}>{t('chart.empty')}</div>;

  const [nLo, nHi] = indicator.normal;
  const all = points.flatMap(p => p.value);
  const lo0 = Math.min(...all, nLo), hi0 = Math.max(...all, nHi), padY = (hi0 - lo0) * 0.08 || 1;
  const lo = lo0 - padY, hi = hi0 + padY;
  const w = compact ? SW : W, h = compact ? SH : H;
  const left = compact ? 0 : L, right = compact ? 0 : R, top = compact ? 2 : T, bottom = compact ? 2 : B;
  const d0 = points[0].day, d1 = points[points.length - 1].day;
  const x = (day: number) => left + ((day - d0) / Math.max(1, d1 - d0)) * (w - left - right);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (h - top - bottom);
  const lines = (indicator.input === 'bp' ? [0, 1] : [0]).map(k =>
    points.map(p => `${x(p.day).toFixed(1)},${y(p.value[k]).toFixed(1)}`).join(' '),
  );
  const last = points[points.length - 1];

  if (compact) {
    return (
      <svg className={`spark spark-${status}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <rect className="chart-band" x="0" width={w} y={y(nHi)} height={Math.max(0.5, y(nLo) - y(nHi))} />
        {lines.map((pts, k) => <polyline key={k} className={`chart-line chart-line-${k}`} points={pts} />)}
        <circle className="chart-dot" cx={x(last.day)} cy={y(last.value[0])} r="2.2" />
      </svg>
    );
  }

  const ticks = [lo0, (lo0 + hi0) / 2, hi0];
  const digits = indicator.step < 1 || hi0 - lo0 < 5 ? 1 : 0;
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.day) - px) < Math.abs(x(points[best].day) - px)) best = i; });
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;
  const tipX = hp ? Math.min(Math.max(x(hp.day), L + 40), W - R - 40) : 0;

  return (
    <svg
      className={`chart chart-${status}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={t('chart.aria', {label: indicator.label, n: points.length, value: format(indicator, last.value), unit: indicator.unit})}
      onPointerMove={move} onPointerLeave={() => setHover(null)}
    >
      <rect className="chart-band" x={L} width={W - L - R} y={y(nHi)} height={Math.max(0.5, y(nLo) - y(nHi))} />
      {ticks.map(t => (
        <g key={t}>
          <line className="chart-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="chart-tick" x={L - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">{t.toFixed(digits)}</text>
        </g>
      ))}
      <text className="chart-tick" x={L} y={H - 6}>{t('chart.day', {n: d0})}</text>
      <text className="chart-tick" x={W - R} y={H - 6} textAnchor="end">{t('chart.day', {n: d1})}</text>
      {lines.map((pts, k) => <polyline key={k} className={`chart-line chart-line-${k}`} points={pts} />)}
      <circle className="chart-dot" cx={x(last.day)} cy={y(last.value[0])} r="3.5" />
      {hp && (
        <g className="chart-hover">
          <line x1={x(hp.day)} x2={x(hp.day)} y1={T} y2={H - B} />
          {hp.value.slice(0, indicator.input === 'bp' ? 2 : 1).map((v, k) => <circle key={k} cx={x(hp.day)} cy={y(v)} r="3.5" />)}
          <rect className="chart-tip" x={tipX - 40} y={0} width="80" height="18" rx="9" />
          <text className="chart-tip-text" x={tipX} y={9} textAnchor="middle" dominantBaseline="middle">
            {t('chart.day', {n: hp.day})} · {format(indicator, hp.value)}
          </text>
        </g>
      )}
    </svg>
  );
}
