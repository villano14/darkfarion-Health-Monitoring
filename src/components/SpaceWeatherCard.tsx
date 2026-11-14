import {ExternalLink, Sun} from 'lucide-react';
import type {SpaceWeather} from '../health/nasa';
import {useI18n} from '../i18n';

interface Props {
  weather: SpaceWeather & {recentSep: SpaceWeather['sep']};
  simulated: boolean;
  onSimulate: (on: boolean) => void;
}

/** Live solar particle event status from NASA DONKI, with a demo switch for the presentation. */
export default function SpaceWeatherCard({weather, simulated, onSimulate}: Props) {
  const {t, lang} = useI18n();
  const storm = simulated || weather.recentSep.length > 0;
  const last = weather.sep[0];
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang, {day: 'numeric', month: 'short', year: 'numeric'});

  return (
    <section className={`weather${storm ? ' weather-storm' : ''}`} aria-label={t('weather.title')}>
      <div className="weather-head">
        <Sun aria-hidden="true" />
        <strong>{t('weather.title')}</strong>
        <span className={`weather-live weather-live-${weather.status}`}>{t('weather.live')}</span>
      </div>
      {weather.status === 'loading' && <p className="muted">{t('weather.loading')}</p>}
      {weather.status === 'error' && !simulated && <p className="muted">{t('weather.error')}</p>}
      {(weather.status === 'ok' || simulated) && (
        <>
          <p className="weather-status">{storm ? t('weather.storm') : t('weather.calm')}</p>
          {weather.status === 'ok' && (
            <ul className="weather-facts">
              <li>{last ? t('weather.last', {date: date(last.time)}) : t('weather.none')}</li>
              <li>{t('weather.flares', {n: weather.flares.length})}</li>
            </ul>
          )}
          {last?.link && (
            <a className="weather-link" href={last.link} target="_blank" rel="noreferrer">
              {t('weather.view')} <ExternalLink aria-hidden="true" />
            </a>
          )}
        </>
      )}
      <label className="weather-sim">
        <input type="checkbox" checked={simulated} onChange={e => onSimulate(e.target.checked)} />
        <span className="switch" aria-hidden="true" />
        {t('weather.simulate')}
      </label>
    </section>
  );
}
