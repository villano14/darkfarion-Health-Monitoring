import {useRef, useState, type FormEvent} from 'react';
import {FlaskConical, LogIn, X} from 'lucide-react';
import {api, ApiError, setToken, type AppConfig, type DemoAccount} from '../api/client';
import {useI18n} from '../i18n';

/** Sign-in. In demo mode a floating window lists the seeded crew so judges can enter with one tap. */
export default function LoginPage({config}: {config: AppConfig}) {
  const {t, lang, setLang} = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demoDialog = useRef<HTMLDialogElement>(null);

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
          <a className="link-btn login-about" href="#/home">{t('login.about')}</a>
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
          <>
            <button type="button" className="btn btn-secondary login-demo-open" onClick={() => demoDialog.current?.showModal()}>
              <FlaskConical aria-hidden="true" />{t('login.demoOpen')}
            </button>
            <dialog ref={demoDialog} className="demo-dialog" aria-labelledby="demo-title" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
              <div className="demo-dialog-body">
                <header className="demo-dialog-head">
                  <h2 id="demo-title" className="name">{t('login.demo')}</h2>
                  <button type="button" className="icon-btn" onClick={() => demoDialog.current?.close()} aria-label={t('login.close')}><X aria-hidden="true" /></button>
                </header>
                <p className="muted">{t('login.demoSub', {p: config.demoAccounts[0]?.password ?? ''})}</p>
                <ul className="login-demo">
                  {config.demoAccounts.map(a => (
                    <li key={a.email}>
                      <button type="button" onClick={() => { demoDialog.current?.close(); demo(a); }} disabled={busy}>
                        <strong>{a.name}</strong>
                        <span className={`role-chip role-${a.role}`}>{t(`role.${a.role}`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </dialog>
          </>
        )}
      </section>
    </main>
  );
}
