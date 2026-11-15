import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react';
import {api, ApiError, getToken, onAuthChange, setToken, type AppConfig, type Me, type Role} from './client';
import {hydrateCatalog} from '../health/catalog';
import {setMission} from '../health/model';
import LoginPage from '../pages/LoginPage';
import {useI18n} from '../i18n';

interface Session {
  me: Me;
  role: Role;
  /** Can log their own health data (astronaut, crew medical officer). */
  isCrew: boolean;
  /** Can see other people's data (crew medical officer, flight surgeon, mission control). */
  isStaff: boolean;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);
export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside SessionGate');
  return s;
}

type Phase = {name: 'loading'} | {name: 'login'; config: AppConfig} | {name: 'ready'; me: Me} | {name: 'error'; message: string};

/** Signs the user in, then loads their mission and the health catalog before the app renders. */
export function SessionGate({children}: {children: ReactNode}) {
  const {t} = useI18n();
  const [phase, setPhase] = useState<Phase>({name: 'loading'});
  const [attempt, setAttempt] = useState(0);
  const [tokenVersion, setTokenVersion] = useState(0);

  useEffect(() => onAuthChange(() => setTokenVersion(v => v + 1)), []);

  useEffect(() => {
    let live = true;
    setPhase({name: 'loading'});
    (async () => {
      try {
        if (!getToken()) {
          const config = await api.config();
          if (live) setPhase({name: 'login', config});
          return;
        }
        const [me, catalog] = await Promise.all([api.me(), api.catalog()]);
        hydrateCatalog(catalog);
        let day = me.mission?.mission.day ?? 1, days = me.mission?.mission.plannedDays ?? 0, name = me.mission?.mission.name ?? '';
        if (!me.mission) {
          // Mission control has no crew position: follow the most recent mission.
          const first = (await api.crew())[0]?.mission;
          if (first) ({day, plannedDays: days, name} = first);
        }
        setMission({name, crew: me.user.name, role: me.title, initials: me.user.initials}, day, days);
        if (live) setPhase({name: 'ready', me});
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 401) return; // token dropped: the auth listener reloads
        setPhase({name: 'error', message: e instanceof ApiError ? e.code : t('session.offline')});
      }
    })();
    return () => { live = false; };
  }, [tokenVersion, attempt, t]);

  const logout = useCallback(() => setToken(null), []);

  if (phase.name === 'loading') {
    return <div className="session-screen" role="status"><span className="session-spinner" aria-hidden="true" />{t('session.loading')}</div>;
  }
  if (phase.name === 'error') {
    return (
      <div className="session-screen" role="alert">
        <p>{t('session.error')}</p>
        <button className="btn btn-primary" onClick={() => setAttempt(a => a + 1)}>{t('session.retry')}</button>
      </div>
    );
  }
  if (phase.name === 'login') return <LoginPage config={phase.config} />;

  const role = phase.me.user.role;
  const value: Session = {
    me: phase.me,
    role,
    isCrew: role === 'astronaut' || role === 'crew_medical_officer',
    isStaff: role !== 'astronaut',
    logout,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
