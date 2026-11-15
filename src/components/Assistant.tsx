import {Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {ApiError, request} from '../api/client';
import {RotateCcw, SendHorizontal, X} from 'lucide-react';
import type {GroupState} from '../health/data';
import {GROUPS, type GroupId, type Status} from '../health/model';
import {useI18n, type Key} from '../i18n';
import Orbi from './Orbi';

interface Message {role: 'user' | 'assistant'; text: string; error?: boolean}

interface Props {
  states: Record<GroupId, GroupState>;
  /** Environment shown in the app; the server reads everything else from the database. */
  environment: string;
}

const RANK: Record<Status, number> = {normal: 0, watch: 1, alert: 2};
const ERRORS: Record<string, Key> = {
  auth: 'orbi.err.auth', connection: 'orbi.err.offline', offline: 'orbi.err.offline',
  rate_limit: 'orbi.err.rate', refusal: 'orbi.err.refusal',
};

/** Renders **bold** and line breaks without injecting HTML. */
function rich(text: string): ReactNode {
  return text.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part,
      )}
    </Fragment>
  ));
}

/** Orbi: floating mascot that answers questions about risks, prevention, and kit medicines. */
export default function Assistant({states, environment}: Props) {
  const L = useI18n(), {t, lang} = L;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const flagged = GROUPS.filter(g => states[g.id].status !== 'normal');
  const mood = flagged.reduce<Status>((m, g) => (RANK[states[g.id].status] > RANK[m] ? states[g.id].status : m), 'normal');
  const greeting = flagged.length
    ? t('orbi.greetRisk', {n: flagged.length, list: flagged.map(g => L.groupName(g.id)).join(', ')})
    : t('orbi.greetOk');

  useEffect(() => { list.current?.scrollTo({top: list.current.scrollHeight}); }, [messages, busy]);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...messages.filter(m => !m.error), {role: 'user' as const, text: q}];
    setMessages([...messages, {role: 'user', text: q}]);
    setInput('');
    setBusy(true);
    abort.current = new AbortController();

    const fail = (code: string) =>
      setMessages(m => [...m.filter(x => !(x.role === 'assistant' && !x.text)), {role: 'assistant', text: t(ERRORS[code] ?? 'orbi.err.generic'), error: true}]);

    try {
      // The server builds the health context from the database; only the conversation travels.
      const res = await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({lang, environment, messages: history.map(m => ({role: m.role, content: m.text}))}),
        signal: abort.current.signal,
      }).catch((e: unknown) => {
        fail(e instanceof ApiError && e.status < 500 && e.status !== 404 ? 'generic' : 'offline');
        return null;
      });
      if (!res?.body) return;

      setMessages(m => [...m, {role: 'assistant', text: ''}]);
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream: true});
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {type: string; text?: string; code?: string};
          if (event.type === 'text' && event.text) {
            setMessages(m => {
              const next = [...m], last = next[next.length - 1];
              next[next.length - 1] = {...last, text: last.text + event.text};
              return next;
            });
          } else if (event.type === 'error') {
            fail(event.code ?? 'generic');
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') fail('offline');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(input); };
  const reset = () => { abort.current?.abort(); setMessages([]); setBusy(false); };
  const waiting = busy && !(messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.text);

  return (
    <>
      <button
        className={`orbi-fab orbi-fab-${mood}${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="orbi-panel"
        aria-label={open ? t('orbi.close') : t('orbi.open')}
      >
        <Orbi mood={mood} />
        {flagged.length > 0 && !open && <span className="orbi-badge">{flagged.length}</span>}
      </button>

      {open && (
        <section id="orbi-panel" className="orbi-panel" aria-label={t('orbi.name')}>
          <header className="orbi-head">
            <span className="orbi-avatar"><Orbi mood={mood} /></span>
            <div className="orbi-title">
              <strong>{t('orbi.name')}</strong>
              <span>{t('orbi.role')}</span>
            </div>
            {messages.length > 0 && (
              <button className="icon-btn" onClick={reset} aria-label={t('orbi.clear')} title={t('orbi.clear')}><RotateCcw aria-hidden="true" /></button>
            )}
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('orbi.close')}><X aria-hidden="true" /></button>
          </header>

          <ol className="orbi-messages" ref={list} aria-live="polite">
            <li className="orbi-msg orbi-msg-assistant">{greeting}</li>
            {messages.map((m, i) => (
              m.text ? <li key={i} className={`orbi-msg orbi-msg-${m.role}${m.error ? ' orbi-msg-error' : ''}`}>{rich(m.text)}</li> : null
            ))}
            {waiting && (
              <li className="orbi-msg orbi-msg-assistant orbi-typing" aria-label={t('orbi.thinking')}>
                <span /><span /><span />
              </li>
            )}
          </ol>

          {messages.length === 0 && (
            <div className="orbi-suggestions">
              {(['orbi.s1', 'orbi.s2', 'orbi.s3'] as const).map(k => (
                <button key={k} className="orbi-chip" onClick={() => void ask(t(k))}>{t(k)}</button>
              ))}
            </div>
          )}

          <form className="orbi-form" onSubmit={submit}>
            <input
              ref={field} value={input} onChange={e => setInput(e.target.value)}
              placeholder={t('orbi.placeholder')} aria-label={t('orbi.placeholder')} maxLength={1000}
            />
            <button type="submit" className="orbi-send" disabled={!input.trim() || busy} aria-label={t('orbi.send')}>
              <SendHorizontal aria-hidden="true" />
            </button>
          </form>
          <p className="orbi-disclaimer">{t('orbi.disclaimer')}</p>
        </section>
      )}
    </>
  );
}
