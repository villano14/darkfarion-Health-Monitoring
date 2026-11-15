import {ClipboardPlus, Flame, ListChecks, LogOut, PersonStanding, ShieldCheck, Users} from 'lucide-react';
import {useSession} from '../api/session';
import {TODAY} from '../health/model';
import {useI18n, type Lang} from '../i18n';
import type {Route} from '../router';

interface Props {
  route: Route;
  /** The signed-in user logs their own health (hidden for the flight surgeon and mission control). */
  canRecord: boolean;
  now: Date;
  streak: number;
  vitalsDone: number;
  vitalsTotal: number;
  overdue: number;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');
const LANGS: {id: Lang; label: string; name: string}[] = [
  {id: 'en', label: 'EN', name: 'English'},
  {id: 'es', label: 'ES', name: 'Español'},
];

export default function NavBar({route, canRecord, now, streak, vitalsDone, vitalsTotal, overdue}: Props) {
  const {t, lang, setLang} = useI18n();
  // Mission elapsed time: DDD:HH:MM:SS since launch.
  const met = `${pad(TODAY - 1, 3)}:${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const {me, isStaff, role, logout} = useSession();
  const links = [
    {id: 'body' as const, label: t('nav.body'), icon: PersonStanding, badge: null},
    ...(canRecord ? [{id: 'vitals' as const, label: t('nav.vitals'), icon: ClipboardPlus, badge: vitalsDone < vitalsTotal ? `${vitalsDone}/${vitalsTotal}` : null}] : []),
    ...(canRecord ? [{id: 'routine' as const, label: t('nav.routine'), icon: ListChecks, badge: overdue ? String(overdue) : null}] : []),
    ...(isStaff ? [{id: 'crew' as const, label: t('nav.crew'), icon: Users, badge: null}] : []),
    ...(role === 'admin' ? [{id: 'admin' as const, label: t('nav.admin'), icon: ShieldCheck, badge: null}] : []),
  ];
  return (
    <header className="navbar">
      <a className="brand" href="#/body" aria-label={t('nav.home')}>
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <ellipse cx="12" cy="12" rx="10.5" ry="4" />
        </svg>
        <span className="brand-name">CrewHealth</span>
      </a>

      <nav className="nav-links" aria-label={t('nav.main')}>
        {links.map(l => (
          <a key={l.id} href={`#/${l.id}`} className={`nav-link${route === l.id ? ' is-active' : ''}`} aria-current={route === l.id ? 'page' : undefined}>
            <l.icon aria-hidden="true" />
            <span>{l.label}</span>
            {l.badge && <span className={`nav-badge${l.id === 'routine' ? ' nav-badge-warn' : ''}`}>{l.badge}</span>}
          </a>
        ))}
      </nav>

      <div className="navbar-end">
        <div className="lang-switch" role="group" aria-label={t('nav.language')} data-lang={lang}>
          <span className="lang-thumb" aria-hidden="true" />
          {LANGS.map(l => (
            <button key={l.id} className="lang-option" aria-pressed={lang === l.id} onClick={() => setLang(l.id)} title={l.name} lang={l.id}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="met" title={t('nav.met')}>
          <span className="met-label">MET</span>
          <span className="met-value">{met}</span>
        </div>
        {canRecord && (
          <span className="streak" title={t('nav.streak', {n: streak})}>
            <Flame aria-hidden="true" />
            <span>{streak}</span>
            <span className="sr-only">{t('nav.streak', {n: streak})}</span>
          </span>
        )}
        <div className="user-menu" title={`${me.user.name} · ${t(`role.${role}`)}`}>
          <span className="avatar avatar-small" aria-hidden="true">{me.user.initials}</span>
          <span className="user-name">
            <strong>{me.user.name}</strong>
            <span>{t(`role.${role}`)}</span>
          </span>
          <button className="icon-btn" onClick={logout} aria-label={t('nav.logout')} title={t('nav.logout')}><LogOut aria-hidden="true" /></button>
        </div>
      </div>
    </header>
  );
}
