import type {Status} from '../health/model';

interface Props {
  values: number[];
  normal: [number, number];
  status: Status;
}

const W = 100, H = 36, PAD = 3;

/** Trend line over a shaded normal band. Sizing and colors live in CSS. */
export default function Sparkline({values, normal, status}: Props) {
  if (values.length < 2) return <div className="spark spark-empty" />;
  const lo = Math.min(...values, normal[0]), hi = Math.max(...values, normal[1]);
  const span = hi - lo || 1;
  const y = (v: number) => H - PAD - ((v - lo) / span) * (H - PAD * 2);
  const x = (i: number) => (i / (values.length - 1)) * W;
  const points = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = values[values.length - 1];
  return (
    <svg className={`spark spark-${status}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <rect className="spark-band" x="0" width={W} y={y(normal[1])} height={Math.max(0.5, y(normal[0]) - y(normal[1]))} />
      <polyline className="spark-line" points={points} />
      <circle className="spark-dot" cx={x(values.length - 1)} cy={y(last)} r="2.2" />
    </svg>
  );
}
