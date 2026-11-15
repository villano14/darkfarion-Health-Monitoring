import {useState, type FormEvent} from 'react';
import {LogIn} from 'lucide-react';
import {api, ApiError, setToken, type AppConfig, type DemoAccount} from '../api/client';
import {useI18n} from '../i18n';

/** Sign-in. In demo mode it lists the seeded crew so judges can enter with one tap. */
export default function LoginPage({config}: {config: AppConfig}) {
  const {t, lang, setLang} = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signIn = async (e: string, p: string) => {
    setBusy(true);
    setError('');
    try {
      const {token} = await api.login(e, p);
      setToken(token);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('login.invalid') : t('session.offline'));
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void signIn(email, password); };
  const demo = (a: DemoAccount) => { setEmail(a.email); setPassword(a.password); void signIn(a.email, a.password); };

  return (
    <main className="login">
      <section className="login-card plate" aria-labelledby="login-title">
        <div className="login-brand">
          <img className="login-logo" src="/logo-mark.webp" alt="Qhalikay" width="111" height="96" />
          <button type="button" className="link-btn login-lang" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
            {lang === 'es' ? 'English' : 'Español'}
          </button>
        </div>
        <h1 id="login-title">{t('login.title')}</h1>
        <p className="muted">{t('login.sub')}</p>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>{t('login.email')}</span>
            <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>
            <span>{t('login.password')}</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <LogIn aria-hidden="true" />{busy ? t('login.busy') : t('login.submit')}
          </button>
        </form>

        {config.demo && config.demoAccounts && (
          <div className="login-demo">
            <h2 className="label">{t('login.demo')}</h2>
            <p className="muted">{t('login.demoSub', {p: config.demoAccounts[0]?.password ?? ''})}</p>
            <ul>
              {config.demoAccounts.map(a => (
                <li key={a.email}>
                  <button type="button" onClick={() => demo(a)} disabled={busy}>
                    <strong>{a.name}</strong>
                    <span className={`role-chip role-${a.role}`}>{t(`role.${a.role}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
