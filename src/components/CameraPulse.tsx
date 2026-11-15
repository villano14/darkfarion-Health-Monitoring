import {useCallback, useEffect, useRef, useState} from 'react';
import {Camera, X} from 'lucide-react';
import {useI18n} from '../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (bpm: number) => void;
}

type Phase = 'idle' | 'measuring' | 'done' | 'failed' | 'denied';
interface Sample {t: number; v: number}

const DURATION_MS = 20000;
/** The fingertip must stay on the lens this long before the countdown starts. */
const SETTLE_MS = 600;
/** A short slip of the finger is tolerated; longer than this restarts the count. */
const GRACE_MS = 800;
const SECONDS = DURATION_MS / 1000;
const RING_R = 84, RING_C = 2 * Math.PI * RING_R;

/** Fingertip over a lit lens: the frame is bright and strongly red. */
function isCovered(r: number, g: number, b: number) {
  return r > 60 && r > g * 1.6 && r > b * 1.6;
}
const SIZE = {width: {ideal: 320}, height: {ideal: 240}};
const hasTorch = (m: MediaStream) =>
  Boolean((m.getVideoTracks()[0]?.getCapabilities?.() as {torch?: boolean} | undefined)?.torch);
const REAR = /back|rear|environment|trasera|posterior/i;

/**
 * Opens the phone's rear camera, preferring the lens next to the flash.
 * Phones with several rear lenses (wide, ultra-wide, tele) may hand back one without a torch,
 * so we try the other rear lenses until one can light the fingertip.
 * Computers without a rear camera fall back to whatever camera exists.
 */
async function openRearCamera(): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  let media: MediaStream;
  try {
    media = await md.getUserMedia({video: {facingMode: {exact: 'environment'}, ...SIZE}, audio: false});
  } catch (e) {
    if ((e as DOMException).name === 'NotAllowedError') throw e;
    return md.getUserMedia({video: SIZE, audio: false});
  }
  if (hasTorch(media)) return media;
  // Labels are only filled in once permission is granted, so list devices now.
  const current = media.getVideoTracks()[0]?.getSettings().deviceId;
  const rear = (await md.enumerateDevices())
    .filter(d => d.kind === 'videoinput' && d.deviceId !== current && REAR.test(d.label));
  for (const d of rear) {
    try {
      const other = await md.getUserMedia({video: {deviceId: {exact: d.deviceId}, ...SIZE}, audio: false});
      if (hasTorch(other)) { media.getTracks().forEach(t => t.stop()); return other; }
      other.getTracks().forEach(t => t.stop());
    } catch { /* lens busy or unavailable: try the next one */ }
  }
  return media;
}

const buzz = (ms: number | number[]) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

/**
 * Heart rate from the camera (photoplethysmography): with a fingertip over the lens,
 * blood volume changes the amount of red light reaching the sensor on every beat.
 */
export function estimateBpm(samples: Sample[]): number | null {
  if (samples.length < 60) return null;
  // Resample to a uniform 25 Hz grid (camera frame timing jitters).
  const HZ = 25, t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const n = Math.floor(((t1 - t0) / 1000) * HZ);
  if (n < HZ * 8) return null;
  const grid: number[] = [];
  for (let k = 0, j = 0; k < n; k++) {
    const t = t0 + (k * 1000) / HZ;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j], b = samples[j + 1], f = (t - a.t) / Math.max(1, b.t - a.t);
    grid.push(a.v + (b.v - a.v) * Math.min(1, Math.max(0, f)));
  }
  // Remove slow drift (1 s moving average), then smooth (200 ms).
  const avg = (xs: number[], w: number) => xs.map((_, i) => {
    let sum = 0, c = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(xs.length - 1, i + w); k++) { sum += xs[k]; c++; }
    return sum / c;
  });
  const trend = avg(grid, Math.round(HZ / 2));
  const x = avg(grid.map((v, i) => v - trend[i]), 2);
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const z = x.map(v => v - mean);
  const energy = z.reduce((a, b) => a + b * b, 0);
  if (!energy) return null;
  // Autocorrelation over plausible beat periods: 0.33 s (180 bpm) to 1.5 s (40 bpm).
  const r = (lag: number) => { let s2 = 0; for (let i = 0; i + lag < z.length; i++) s2 += z[i] * z[i + lag]; return s2 / energy; };
  const minLag = Math.round(0.33 * HZ), maxLag = Math.round(1.5 * HZ);
  const corr: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) corr.push(r(lag));
  const best = Math.max(...corr);
  // Not periodic enough: noise, motion, or a finger that is not covering the lens.
  if (best < 0.45) return null;
  // Take the shortest period close to the best one, so a double period is not mistaken for the beat.
  let idx = corr.findIndex((c, i) => c >= 0.9 * best && (i === 0 || c >= corr[i - 1]) && (i === corr.length - 1 || c >= corr[i + 1]));
  if (idx < 0) idx = corr.indexOf(best);
  // Parabolic refinement of the peak.
  const y0 = corr[idx - 1] ?? corr[idx], y1 = corr[idx], y2 = corr[idx + 1] ?? corr[idx];
  const shift = y0 - 2 * y1 + y2 ? (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2) : 0;
  const period = (minLag + idx + shift) / HZ;
  const bpm = Math.round(60 / period);
  return bpm >= 40 && bpm <= 180 ? bpm : null;
}

export default function CameraPulse({open, onClose, onResult}: Props) {
  const {t} = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [finger, setFinger] = useState(false);
  const [left, setLeft] = useState(SECONDS);
  const [progress, setProgress] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }, []);

  const reset = () => { setFinger(false); setLeft(SECONDS); setProgress(0); };

  useEffect(() => {
    const d = dialog.current!;
    if (open && !d.open) { setPhase('idle'); setBpm(null); reset(); d.showModal(); }
    if (!open && d.open) d.close();
    if (!open) stop();
  }, [open, stop]);
  useEffect(() => stop, [stop]);

  const start = async () => {
    reset();
    try {
      const media = await openRearCamera();
      stream.current = media;
      // Turn the flash on where the device allows it (Android); iPhone browsers ignore it.
      media.getVideoTracks()[0]
        .applyConstraints({advanced: [{torch: true} as MediaTrackConstraintSet]}).catch(() => {});
      const v = video.current!;
      v.srcObject = media;
      await v.play();
    } catch {
      setPhase('denied');
      return;
    }

    setPhase('measuring');
    const sampler = document.createElement('canvas');
    sampler.width = 32;
    sampler.height = 24;
    const ctx = sampler.getContext('2d', {willReadFrequently: true})!;
    let samples: Sample[] = [];
    let seenSince = 0;   // when the finger was first seen in the current streak
    let lostSince = 0;   // when the finger was last lost (0 while it is on the lens)
    let countedMs = 0;   // time accumulated toward DURATION_MS
    let last = 0;
    let detected = false;

    const tick = () => {
      const v = video.current;
      if (!v || !stream.current) return;
      ctx.drawImage(v, 0, 0, sampler.width, sampler.height);
      const px = ctx.getImageData(0, 0, sampler.width, sampler.height).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
      const n = px.length / 4;
      r /= n; g /= n; b /= n;
      const now = performance.now();
      const dt = last ? Math.min(100, now - last) : 0;
      last = now;

      if (isCovered(r, g, b)) {
        lostSince = 0;
        if (!seenSince) seenSince = now;
        if (!detected && now - seenSince >= SETTLE_MS) { detected = true; setFinger(true); buzz(40); }
        if (detected) {
          countedMs += dt;
          samples.push({t: now, v: r});
          setLeft(Math.max(0, Math.ceil((DURATION_MS - countedMs) / 1000)));
          setProgress(Math.min(1, countedMs / DURATION_MS));
          drawWave(samples.filter(s => now - s.t < 5000));
          if (countedMs >= DURATION_MS) {
            const result = estimateBpm(samples);
            stop();
            buzz(result ? [60, 80, 60] : 200);
            setBpm(result);
            setPhase(result ? 'done' : 'failed');
            return;
          }
        }
      } else {
        seenSince = 0;
        if (!lostSince) lostSince = now;
        // Finger slipped for too long: start over so the reading stays clean.
        if (detected && now - lostSince > GRACE_MS) {
          detected = false;
          samples = [];
          countedMs = 0;
          reset();
          wave.current?.getContext('2d')?.clearRect(0, 0, wave.current.width, wave.current.height);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const drawWave = (points: Sample[]) => {
    const c = wave.current;
    if (!c || points.length < 2) return;
    const g = c.getContext('2d')!;
    const w = c.width, h = c.height;
    const vs = points.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
    const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
    g.clearRect(0, 0, w, h);
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.strokeStyle = getComputedStyle(c).color;
    g.beginPath();
    points.forEach((p, i) => {
      const x = ((p.t - t0) / Math.max(1, t1 - t0)) * w, y = h - 6 - ((hi - p.v) / span) * (h - 12);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.stroke();
  };

  const close = () => { stop(); onClose(); };
  const measuring = phase === 'measuring';
  const lensState = phase === 'done' ? ' is-done' : measuring && finger ? ' is-covered' : measuring ? ' is-searching' : '';

  return (
    <dialog ref={dialog} className="pulse-dialog" onClose={close} aria-labelledby="pulse-title">
      <header className="pulse-head">
        <h2 id="pulse-title"><Camera aria-hidden="true" />{t('pulse.title')}</h2>
        <button type="button" className="icon-btn" onClick={close} aria-label={t('pulse.close')}><X aria-hidden="true" /></button>
      </header>
      <div className="pulse-body">
        <div className={`pulse-ring${lensState}`}>
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle className="pulse-track" cx="90" cy="90" r={RING_R} />
            <circle
              className="pulse-progress" cx="90" cy="90" r={RING_R}
              strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - (phase === 'done' ? 1 : progress))}
            />
          </svg>
          <div className="pulse-lens">
            <video ref={video} muted playsInline />
            {measuring && finger && <strong className="pulse-count">{left}<span>s</span></strong>}
            {phase === 'done' && <strong className="pulse-bpm">{bpm}<span>bpm</span></strong>}
          </div>
        </div>
        <canvas ref={wave} className="pulse-wave" width="560" height="120" aria-hidden="true" />
        <p className={`pulse-status${measuring && finger ? ' is-ok' : ''}`} role="status">
          {phase === 'idle' && <>{t('pulse.instructions')}<span className="pulse-duration">{t('pulse.duration', {s: SECONDS})}</span></>}
          {measuring && (finger ? t('pulse.detected', {s: left}) : t('pulse.noFinger'))}
          {phase === 'done' && t('pulse.done')}
          {phase === 'failed' && t('pulse.failed')}
          {phase === 'denied' && t('pulse.denied')}
        </p>
      </div>
      <footer className="pulse-foot">
        <small className="muted">{t('pulse.note')}</small>
        {phase === 'idle' && <button type="button" className="btn btn-primary" onClick={start}>{t('pulse.start')}</button>}
        {(phase === 'failed' || phase === 'denied') && <button type="button" className="btn btn-secondary" onClick={start}>{t('pulse.retry')}</button>}
        {phase === 'done' && bpm && (
          <button type="button" className="btn btn-primary" onClick={() => { onResult(bpm); close(); }}>{t('pulse.use')}</button>
        )}
      </footer>
    </dialog>
  );
}
