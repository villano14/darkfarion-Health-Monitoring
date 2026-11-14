import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {ArrowRight, Camera, CircleCheck, ClipboardList} from 'lucide-react';
import CameraPulse from '../components/CameraPulse';
import {
  DAILY,
  type Indicator, type IndicatorId, type Reading, type Status,
} from '../health/model';
import {useI18n} from '../i18n';
import {GROUP_ICON, StatusChip} from '../components/ui';
import type {GroupId} from '../health/model';

interface Props {
  initial: Partial<Record<IndicatorId, Reading>>;
  onSave: (values: Partial<Record<IndicatorId, Reading>>) => void;
  onViewBody: (group: GroupId) => void;
}

type Draft = Partial<Record<IndicatorId, string[]>>;
const MOODS = ['😣', '🙁', '😐', '🙂', '😄'];
const RANK: Record<Status, number> = {alert: 0, watch: 1, normal: 2};

const toDraft = (v: Props['initial']): Draft =>
  Object.fromEntries(Object.entries(v).map(([k, r]) => [k, r!.map(String)]));

function parse(i: Indicator, raw: string[] | undefined): Reading | undefined {
  if (!raw) return undefined;
  const need = i.input === 'bp' ? 2 : 1;
  const nums = raw.slice(0, need).map(Number);
  if (nums.length < need || nums.some((n, k) => raw[k] === '' || !Number.isFinite(n))) return undefined;
  if (nums.some(n => n < i.min || n > i.max)) return undefined;
  return nums;
}

/** Vitals entry with a live preliminary assessment of what the readings may mean. */
export default function VitalsPage({initial, onSave, onViewBody}: Props) {
  const L = useI18n(), {t} = L;
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);
  useEffect(() => { setDraft(toDraft(initial)); }, [initial]);

  const set = (id: IndicatorId, index: number, value: string) => {
    setSavedAt(null);
    setDraft(d => {
      const next = [...(d[id] ?? [])];
      next[index] = value;
      return {...d, [id]: next};
    });
  };

  const fields = useMemo(() => DAILY.map(L.ind), [L]);
  const readings = useMemo(() => fields.flatMap(i => {
    const v = parse(i, draft[i.id]);
    return v ? [{i, v, a: i.assess(v)}] : [];
  }), [draft, fields]);
  const findings = readings.filter(r => r.a.status !== 'normal').sort((x, y) => RANK[x.a.status] - RANK[y.a.status]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(Object.fromEntries(readings.map(r => [r.i.id, r.v])));
    setSavedAt(new Date().toTimeString().slice(0, 5));
  };

  return (
    <div className="page page-vitals">
      <header className="page-head">
        <div>
          <h1>{t('vitals.title')}</h1>
          <p className="muted">{t('vitals.sub')}</p>
        </div>
      </header>

      <div className="vitals-layout">
        <form className="vitals-form" onSubmit={submit}>
          <div className="fields">
            {fields.map(i => {
              const v = parse(i, draft[i.id]);
              const status = v ? i.assess(v).status : 'empty';
              return (
                <fieldset key={i.id} className={`field field-${status}`}>
                  <legend>
                    <span className={`dot dot-${status}`} aria-hidden="true" />
                    {i.label}
                  </legend>
                  {i.input === 'scale' ? (
                    <div className="mood" role="radiogroup" aria-label={i.label}>
                      {MOODS.map((m, n) => (
                        <label key={m} className="mood-option">
                          <input
                            type="radio" name="mood" value={n + 1}
                            checked={draft.mood?.[0] === String(n + 1)}
                            onChange={() => set('mood', 0, String(n + 1))}
                          />
                          <span aria-label={t('vitals.moodOf', {n: n + 1})}>{m}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="inputs">
                      {(i.input === 'bp' ? [t('vitals.sys'), t('vitals.dia')] : [i.label]).map((label, n) => (
                        <input
                          key={label} type="number" inputMode="decimal" aria-label={label}
                          placeholder={i.input === 'bp' ? label : i.range.split('–')[0]}
                          min={i.min} max={i.max} step={i.step}
                          value={draft[i.id]?.[n] ?? ''}
                          onChange={e => set(i.id, n, e.target.value)}
                        />
                      ))}
                      <span className="unit">{i.unit}</span>
                    </div>
                  )}
                  <small className="muted">{i.how}</small>
                  {i.id === 'hr' && (
                    <button type="button" className="link-btn camera-btn" onClick={() => setPulseOpen(true)}>
                      <Camera aria-hidden="true" />{t('pulse.button')}
                    </button>
                  )}
                </fieldset>
              );
            })}
          </div>
          <div className="form-actions">
            {savedAt && <span className="saved"><CircleCheck aria-hidden="true" />{t('vitals.savedAt', {t: savedAt})}</span>}
            <button type="submit" className="btn btn-primary" disabled={!readings.length}>{t('vitals.save')}</button>
          </div>
        </form>

        <aside className="assessment" aria-live="polite" aria-labelledby="assessment-title">
          <div className="section-head">
            <h2 id="assessment-title">{t('vitals.assessment')}</h2>
            <span className="muted">{t('vitals.count', {a: readings.length, b: DAILY.length})}</span>
          </div>

          {!readings.length && (
            <div className="assessment-empty">
              <ClipboardList aria-hidden="true" />
              <p>{t('vitals.empty')}</p>
            </div>
          )}

          {readings.length > 0 && !findings.length && (
            <div className="assessment-clear">
              <CircleCheck aria-hidden="true" />
              <div>
                <strong>{t('vitals.clear')}</strong>
                <p className="muted">{t('vitals.keep')}</p>
              </div>
            </div>
          )}

          <ul className="findings">
            {findings.map(({i, v, a}) => {
              const Icon = GROUP_ICON[i.group];
              return (
                <li key={i.id} className={`finding finding-${a.status}`}>
                  <div className="finding-head">
                    <span className={`finding-icon finding-icon-${a.status}`}><Icon aria-hidden="true" /></span>
                    <div className="finding-title">
                      <strong>{L.risk(i, a)}</strong>
                      <span className="muted">{i.label} · {i.input === 'bp' ? `${v[0]}/${v[1]}` : v[0]} {i.unit}</span>
                    </div>
                    <StatusChip status={a.status} />
                  </div>
                  <p className="finding-text">{i.why}</p>
                  <p className="finding-next"><strong>{t('vitals.next')}</strong> {L.actions(i, a)[0]}</p>
                  <button type="button" className="link-btn" onClick={() => onViewBody(i.group)}>
                    {t('vitals.see', {name: L.groupName(i.group).toLowerCase()})} <ArrowRight aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="disclaimer">{t('vitals.disclaimer')}</p>
        </aside>
      </div>
      <CameraPulse open={pulseOpen} onClose={() => setPulseOpen(false)} onResult={bpm => set('hr', 0, String(bpm))} />
    </div>
  );
}
