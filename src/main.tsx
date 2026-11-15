import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import App from './App';
import {I18nProvider} from './i18n';
import {SessionGate} from './api/session';
import LandingPage from './pages/LandingPage';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

/** The root URL presents the project; any app route (#/body, #/vitals…) opens the app. */
const isLanding = () => ['', '#', '#/', '#/home'].includes(location.hash);

function Root() {
  const [landing, setLanding] = useState(isLanding);
  useEffect(() => {
    const onHash = () => setLanding(isLanding());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  return landing ? <LandingPage /> : <SessionGate><App /></SessionGate>;
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <Root />
  </I18nProvider>,
);
