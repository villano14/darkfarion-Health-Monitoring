import {createRoot} from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App';
import {I18nProvider} from './i18n';
import {SessionGate} from './api/session';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <SessionGate>
      <App />
    </SessionGate>
  </I18nProvider>,
);
