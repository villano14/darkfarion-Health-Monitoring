import {useEffect, useRef, useState, type FormEvent} from 'react';
import {X} from 'lucide-react';
import {DAILY, type Indicator, type IndicatorId, type Reading} from '../health/model';

interface Props {
  open: boolean;
  initial: Partial<Record<IndicatorId, Reading>>;
  onClose: () => void;
  onSave: (values: Partial<Record<IndicatorId, Reading>>) => void;
}

type Draft = Partial<Record<IndicatorId, string[]>>;
const MOODS = ['😣', '🙁', '😐', '🙂', '😄'];

const toDraft = (v: Props['initial']): Draft =>
  Object.fromEntries(Object.entries(v).map(([k, r]) => [k, r!.map(String)]));

function parse(i: Indicator, raw: string[] | undefined): Reading | undefined {
  if (!raw) return undefined;
  const nums = raw.map(Number);
  const need = i.input === 'bp' ? 2 : 1;
  if (nums.length < need || nums.slice(0, need).some((n, k) => raw[k] === '' || !Number.isFinite(n))) return undefined;
  if (nums.slice(0, need).some(n => n < i.min || n > i.max)) return undefined;
  return nums.slice(0, need);
}

export default function CheckInDialog({open, initial, onClose, onSave}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) { setDraft(toDraft(initial)); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open, initial]);

  const set = (id: IndicatorId, index: number, value: string) =>
    setDraft(d => {
      const next = [...(d[id] ?? [])];
      next[index] = value;
      return {...d, [id]: next};
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const values: Partial<Record<IndicatorId, Reading>> = {};
    for (const i of DAILY) {
      const v = parse(i, draft[i.id]);
      if (v) values[i.id] = v;
    }
    onSave(values);
    onClose();
  };

  return (
    <dialog ref={ref} className="checkin" onClose={onClose} aria-labelledby="checkin-title">
      <form onSubmit={submit}>
        <header className="checkin-head">
          <h2 id="checkin-title">Daily check</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </header>
        <div className="fields">
          {DAILY.map(i => {
            const v = parse(i, draft[i.id]);
            const status = v ? i.assess(v).status : 'empty';
            return (
              <fieldset key={i.id} className="field">
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
                        <span aria-label={`${n + 1} of 5`}>{m}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="inputs">
                    {(i.input === 'bp' ? ['Sys', 'Dia'] : [i.label]).map((label, n) => (
                      <input
                        key={label} type="number" inputMode="decimal" aria-label={label}
                        placeholder={i.input === 'bp' ? label : undefined}
                        min={i.min} max={i.max} step={i.step}
                        value={draft[i.id]?.[n] ?? ''}
                        onChange={e => set(i.id, n, e.target.value)}
                      />
                    ))}
                    <span className="unit">{i.unit}</span>
                  </div>
                )}
                <small className="muted">{i.how}</small>
              </fieldset>
            );
          })}
        </div>
        <footer className="checkin-foot">
          <button type="submit" className="btn-primary">Save</button>
        </footer>
      </form>
    </dialog>
  );
}
