import {ENVIRONMENTS, type EnvironmentId} from '../health/model';
import {useI18n} from '../i18n';

interface Props {
  value: EnvironmentId;
  onChange: (id: EnvironmentId) => void;
}

/** Mission environment picker floating over the 3D stage; each option tints to its world. */
export default function EnvironmentSwitch({value, onChange}: Props) {
  const {t, env: envName} = useI18n();
  return (
    <nav className="env-switch" aria-label={t('nav.env')}>
      <span className="env-switch-caption label">{t('env.caption')}</span>
      <div className="env-switch-options">
        {ENVIRONMENTS.map(e => (
          <button
            key={e.id} type="button" data-env={e.id} aria-pressed={value === e.id}
            title={`${envName(e)} · ${t('env.gravity', {g: e.gravity})}`}
            onClick={() => onChange(e.id)}
          >
            <span className="env-switch-dot" aria-hidden="true" />
            {t(`env.short.${e.id}`)}
          </button>
        ))}
      </div>
    </nav>
  );
}
