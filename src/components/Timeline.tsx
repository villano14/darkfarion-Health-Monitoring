import {useEffect} from 'react';
import {Pause, Play} from 'lucide-react';
import {TODAY} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  day: number;
  onDay: (day: number) => void;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
}

export default function Timeline({day, onDay, playing, onPlaying}: Props) {
  const {t} = useI18n();
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
      <button className="icon-btn play" onClick={toggle} aria-label={playing ? t('timeline.pause') : t('timeline.replay')}>
        {playing ? <Pause /> : <Play />}
      </button>
      <span className="timeline-day">{t('timeline.day')} <strong>{day}</strong></span>
      <input
        type="range" min={1} max={TODAY} value={day} aria-label={t('timeline.mission')}
        onChange={e => { onPlaying(false); onDay(+e.target.value); }}
      />
      <button className="today-btn" onClick={() => { onPlaying(false); onDay(TODAY); }} disabled={day === TODAY}>
        {t('timeline.today')}
      </button>
    </footer>
  );
}
