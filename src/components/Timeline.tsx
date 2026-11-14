import {useEffect} from 'react';
import {Pause, Play} from 'lucide-react';
import {TODAY} from '../health/model';

interface Props {
  day: number;
  onDay: (day: number) => void;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
}

export default function Timeline({day, onDay, playing, onPlaying}: Props) {
  useEffect(() => {
    if (!playing) return;
    if (day >= TODAY) { onPlaying(false); return; }
    const t = setTimeout(() => onDay(day + 1), 90);
    return () => clearTimeout(t);
  }, [playing, day, onDay, onPlaying]);

  const toggle = () => {
    if (!playing && day >= TODAY) onDay(1);
    onPlaying(!playing);
  };

  return (
    <footer className="timeline">
      <button className="icon-btn play" onClick={toggle} aria-label={playing ? 'Pause' : 'Replay mission'}>
        {playing ? <Pause /> : <Play />}
      </button>
      <input
        type="range" min={1} max={TODAY} value={day} aria-label="Mission day"
        onChange={e => { onPlaying(false); onDay(+e.target.value); }}
      />
      <button className="today-btn" onClick={() => { onPlaying(false); onDay(TODAY); }} disabled={day === TODAY}>
        Today
      </button>
    </footer>
  );
}
