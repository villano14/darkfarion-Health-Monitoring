import {useState} from 'react';
import {Check, Copy, Radio, Stethoscope, UserRound, Users} from 'lucide-react';
import {TIERS, type Environment, type Tier} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  tier: Exclude<Tier, 'none'>;
  env: Environment;
  report: () => Promise<string>;
}

const ICON = {self: UserRound, crew: Users, surgeon: Stethoscope};

/** Three-step ladder: who acts now, and what the next step would be. */
export default function Escalation({tier, env, report}: Props) {
  const [copied, setCopied] = useState(false);
  const {t, tier: tierText} = useI18n();
  const current = TIERS.findIndex(t => t.id === tier);
  const Icon = ICON[tier];
  const message = {
    self: t('esc.self'),
    crew: t('esc.crew'),
    surgeon: env.autonomous ? t('esc.autonomous') : t('esc.surgeon'),
  }[tier];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await report());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard or network unavailable */ }
  };

  return (
    <section className={`escalation escalation-${tier}`} aria-label={t('esc.label')}>
      <div className="escalation-head">
        <Icon aria-hidden="true" />
        <div>
          <strong>{message}</strong>
          {tier === 'surgeon' && <span className="escalation-delay"><Radio aria-hidden="true" />{t('esc.delay', {d: env.delay})}</span>}
        </div>
      </div>
      <ol className="ladder">
        {TIERS.map((step, i) => (
          <li key={step.id} className={i < current ? 'is-past' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}>
            <span className="ladder-bar" aria-hidden="true" />
            <span className="ladder-label">{tierText(step.id).label}</span>
            <span className="ladder-rule">{tierText(step.id).rule}</span>
          </li>
        ))}
      </ol>
      {tier === 'surgeon' && (
        <button className="btn btn-secondary" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('esc.copied') : t('esc.copy')}
        </button>
      )}
    </section>
  );
}
