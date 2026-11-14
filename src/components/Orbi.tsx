import type {Status} from '../health/model';

/**
 * Orbi, the CrewHealth mascot: an original astronaut riding a rocket and waving.
 * The eyes inside the visor follow the crew member's overall status
 * (happy / concerned / alert). Colors and motion live in CSS.
 */
export default function Orbi({mood, className = ''}: {mood: Status; className?: string}) {
  return (
    <svg className={`orbi orbi-${mood} ${className}`} viewBox="0 0 120 120" aria-hidden="true">
      <g transform="translate(13 2) scale(0.82)">
        <g className="astro-ink">
          {/* Rocket */}
          <g transform="rotate(-30 64 86)">
            <g className="astro-flame">
              <path className="astro-flame-outer" d="M16 80 Q4 78 -4 86 Q4 94 16 92 Z" />
              <path className="astro-flame-inner" d="M16 82.5 Q8 82 3 86 Q8 90 16 89.5 Z" />
            </g>
            <rect className="astro-nozzle" x="14" y="78" width="8" height="16" rx="3" />
            <path className="astro-red" d="M36 75 L24 62 Q38 61 48 71 Z" />
            <path className="astro-red" d="M36 97 L24 110 Q38 111 48 101 Z" />
            <path className="astro-white" d="M21 86 Q40 68 80 70 Q104 73 114 86 Q104 99 80 102 Q40 104 21 86 Z" />
            <path className="astro-shade" d="M24 90 Q44 100 80 98 Q102 96 111 89" />
            <path className="astro-red" d="M94 71.5 Q107 76 114 86 Q107 96 94 100.5 Q99 86 94 71.5 Z" />
            <circle className="astro-red" cx="74" cy="86" r="8.5" />
            <circle className="astro-window" cx="74" cy="86" r="5" />
          </g>

          {/* Astronaut */}
          <rect className="astro-white" x="33" y="46" width="13" height="24" rx="5" />
          <path className="astro-white" d="M43 50 Q40 66 47 74 L68 74 Q74 62 70 50 Z" />
          <path className="astro-line" d="M45 64 Q57 67 70 63" />
          <path className="astro-shade" d="M45 68 Q50 72 66 72" />
          <path className="astro-white" d="M50 70 Q47 84 54 90 Q63 93 66 86 Q61 80 63 71 Z" />
          <path className="astro-white" d="M46 54 Q48 68 60 71 L62 65 Q54 62 52 52 Z" />
          <g className="astro-wave">
            <path className="astro-white" d="M66 50 Q79 49 83 39 L89 42 Q85 55 70 59 Z" />
            <path className="astro-white" d="M82 39 Q81 30 85 28 Q88 28 88 32 Q90 28 93 30 Q95 34 92 40 Q88 44 84 42 Z" />
          </g>

          {/* Helmet */}
          <rect className="astro-white" x="31" y="26" width="7" height="14" rx="3.5" />
          <rect className="astro-white" x="74" y="26" width="7" height="14" rx="3.5" />
          <circle className="astro-white" cx="56" cy="31" r="21" />
          <path className="astro-shade" d="M71 44 Q62 52 48 51" />
          <ellipse className="astro-visor" cx="56" cy="33" rx="16.5" ry="14" />
        </g>

        <path className="astro-glare" d="M43 31 Q44 22 55 20.5 Q47 25 46 34 Z" />
        <circle className="astro-glare" cx="66" cy="27.5" r="2.4" />
        <circle className="astro-glare" cx="63.5" cy="32.5" r="1.1" />
        <path className="astro-band" d="M40 19 Q56 7 72 19" />

        {/* Mood: eyes inside the visor */}
        {mood === 'normal' && <path className="astro-eyes" d="M48 36 q3 -3.5 6 0 M58 36 q3 -3.5 6 0" />}
        {mood === 'watch' && (
          <g className="astro-eyes-fill">
            <circle cx="51" cy="35" r="2" />
            <circle cx="61" cy="35" r="2" />
          </g>
        )}
        {mood === 'alert' && (
          <>
            <path className="astro-eyes" d="M47.5 30.5 l5 1.4 M64.5 30.5 l-5 1.4" />
            <g className="astro-eyes-fill">
              <circle cx="51" cy="35.5" r="2" />
              <circle cx="61" cy="35.5" r="2" />
              <ellipse cx="56" cy="40.5" rx="1.7" ry="1.4" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
