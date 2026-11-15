import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {Rocket, UserPlus} from 'lucide-react';
import {api, ApiError, type ApiMission, type ApiUser, type Role} from '../api/client';
import {ENVIRONMENTS} from '../health/model';
import {useI18n} from '../i18n';

const ROLES: Role[] = ['astronaut', 'crew_medical_officer', 'flight_surgeon', 'admin'];
const today = () => new Date().toISOString().slice(0, 10);

/** Mission control: people, roles and missions. */
export default function AdminPage() {
  const {t, env: envName} = useI18n();
  const [users, setUsers] = useState<(ApiUser & {mission: string; title: string})[]>([]);
  const [missions, setMissions] = useState<(ApiMission & {members: number})[]>([]);
  const [user, setUser] = useState({name: '', email: '', password: '', role: 'astronaut' as Role, missionId: 0, title: ''});
  const [mission, setMission] = useState({name: '', environment: 'iss', startDate: today(), plannedDays: 180});
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    Promise.all([api.admin.users(), api.admin.missions()]).then(([u, m]) => { setUsers(u); setMissions(m); }).catch(() => setMessage(t('session.offline')));
  }, [t]);
  useEffect(load, [load]);

  const explain = (e: unknown) => setMessage(e instanceof ApiError ? t(e.code === 'email_taken' ? 'admin.emailTaken' : 'admin.invalid') : t('session.offline'));

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createUser({...user, missionId: user.missionId || undefined});
      setUser(u => ({...u, name: '', email: '', password: '', title: ''}));
      setMessage(t('admin.userCreated'));
      load();
    } catch (err) { explain(err); }
  };
  const createMission = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.admin.createMission(mission);
      setMission(m => ({...m, name: ''}));
      setMessage(t('admin.missionCreated'));
      load();
    } catch (err) { explain(err); }
  };

  return (
    <div className="page page-admin">
      <header className="page-head">
        <div>
          <h1>{t('admin.title')}</h1>
          <p className="muted">{t('admin.sub')}</p>
        </div>
      </header>
      {message && <p className="card admin-message" role="status">{message}</p>}

      <div className="admin-grid">
        <section className="card" aria-labelledby="missions-title">
          <h2 id="missions-title"><Rocket aria-hidden="true" />{t('admin.missions')}</h2>
          <table className="admin-table">
            <thead><tr><th>{t('admin.name')}</th><th>{t('admin.environment')}</th><th>{t('admin.day')}</th><th>{t('admin.members')}</th></tr></thead>
            <tbody>
              {missions.map(m => {
                const e = ENVIRONMENTS.find(x => x.id === m.environment);
                return <tr key={m.id}><td>{m.name}</td><td>{e ? envName(e) : m.environment}</td><td>{m.day} / {m.plannedDays}</td><td>{m.members}</td></tr>;
              })}
            </tbody>
          </table>
          <form className="admin-form" onSubmit={createMission}>
            <h3>{t('admin.newMission')}</h3>
            <label><span>{t('admin.name')}</span><input required value={mission.name} onChange={e => setMission({...mission, name: e.target.value})} /></label>
            <label><span>{t('admin.environment')}</span>
              <select value={mission.environment} onChange={e => setMission({...mission, environment: e.target.value})}>
                {ENVIRONMENTS.map(e => <option key={e.id} value={e.id}>{envName(e)}</option>)}
              </select>
            </label>
            <label><span>{t('admin.start')}</span><input type="date" required value={mission.startDate} onChange={e => setMission({...mission, startDate: e.target.value})} /></label>
            <label><span>{t('admin.days')}</span><input type="number" min={1} max={3000} required value={mission.plannedDays} onChange={e => setMission({...mission, plannedDays: +e.target.value})} /></label>
            <button className="btn btn-primary" type="submit">{t('admin.create')}</button>
          </form>
        </section>

        <section className="card" aria-labelledby="users-title">
          <h2 id="users-title"><UserPlus aria-hidden="true" />{t('admin.users')}</h2>
          <table className="admin-table">
            <thead><tr><th>{t('admin.name')}</th><th>{t('admin.role')}</th><th>{t('admin.mission')}</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br /><span className="muted">{u.email}</span></td>
                  <td><span className={`role-chip role-${u.role}`}>{t(`role.${u.role}`)}</span></td>
                  <td>{u.mission || '—'}{u.title && <><br /><span className="muted">{u.title}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="admin-form" onSubmit={createUser}>
            <h3>{t('admin.newUser')}</h3>
            <label><span>{t('admin.name')}</span><input required value={user.name} onChange={e => setUser({...user, name: e.target.value})} /></label>
            <label><span>{t('login.email')}</span><input type="email" required value={user.email} onChange={e => setUser({...user, email: e.target.value})} /></label>
            <label><span>{t('login.password')}</span><input type="password" minLength={8} required value={user.password} onChange={e => setUser({...user, password: e.target.value})} /></label>
            <label><span>{t('admin.role')}</span>
              <select value={user.role} onChange={e => setUser({...user, role: e.target.value as Role})}>
                {ROLES.map(r => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </select>
            </label>
            <label><span>{t('admin.mission')}</span>
              <select value={user.missionId} onChange={e => setUser({...user, missionId: +e.target.value})}>
                <option value={0}>—</option>
                {missions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label><span>{t('admin.position')}</span><input value={user.title} onChange={e => setUser({...user, title: e.target.value})} /></label>
            <button className="btn btn-primary" type="submit">{t('admin.create')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
