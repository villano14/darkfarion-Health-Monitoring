import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {CheckCheck, Eye, MessageSquare, RefreshCw, Stethoscope, Users} from 'lucide-react';
import {api, type Alert, type CrewMission} from '../api/client';
import {useSession} from '../api/session';
import {GROUPS, INDICATOR, format, type GroupId, type IndicatorId} from '../health/model';
import {StatusIcon} from '../components/ui';
import {useI18n} from '../i18n';

interface Props {
  /** Opens a crew member's body view. */
  onOpen: (userId: number) => void;
}

/** Crew overview for the crew medical officer, the flight surgeon and mission control. */
export default function CrewPage({onOpen}: Props) {
  const {t, groupName, indById, status: statusLabel, tier: tierText} = useI18n();
  const {role} = useSession();
  const [missions, setMissions] = useState<CrewMission[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setError(false);
    Promise.all([api.crew(), api.alerts(!showAll)])
      .then(([m, a]) => { setMissions(m); setAlerts(a); })
      .catch(() => setError(true));
  }, [showAll]);
  useEffect(load, [load]);

  const canAck = role === 'crew_medical_officer' || role === 'flight_surgeon';
  const ack = async (id: number) => { await api.ack(id); load(); };
  const note = async (e: FormEvent, id: number) => {
    e.preventDefault();
    const body = drafts[id]?.trim();
    if (!body) return;
    await api.note(id, body);
    setDrafts(d => ({...d, [id]: ''}));
    load();
  };

  return (
    <div className="page page-crew">
      <header className="page-head">
        <div>
          <h1>{t('crew.pageTitle')}</h1>
          <p className="muted">{t(role === 'flight_surgeon' ? 'crew.subSurgeon' : 'crew.sub')}</p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={load}><RefreshCw aria-hidden="true" />{t('crew.refresh')}</button>
      </header>

      {error && <p className="card error-card" role="alert">{t('session.offline')}</p>}
      {!missions && !error && <p className="muted" role="status">{t('session.loading')}</p>}

      {missions?.map(({mission, crew}) => (
        <section key={mission.id} className="crew-mission" aria-label={mission.name}>
          <h2 className="crew-mission-title"><Users aria-hidden="true" />{mission.name}<span className="muted">{t('crew.day', {d: mission.day, n: mission.plannedDays})}</span></h2>
          <ul className="crew-grid">
            {crew.map(p => (
              <li key={p.id} className={`card crew-card crew-${p.status}`}>
                <div className="crew-card-head">
                  <span className="avatar" aria-hidden="true">{p.initials}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted">{p.title}</span>
                  </div>
                  {p.tier !== 'none' && <span className={`tier-chip tier-${p.tier}`}>{tierText(p.tier).label}</span>}
                </div>
                <ul className="crew-groups" aria-label={t('crew.systems')}>
                  {GROUPS.map(g => {
                    const s = p.groups[g.id]?.status ?? 'normal';
                    return (
                      <li key={g.id} className={`crew-group crew-group-${s}`} title={`${groupName(g.id as GroupId)}: ${statusLabel(s)}`}>
                        <StatusIcon status={s} />
                        <span>{groupName(g.id as GroupId)}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="crew-card-foot">
                  <span className="muted">{t('crew.today', {a: p.todayDone, b: p.todayTotal})}</span>
                  {p.openAlerts > 0 && <span className="crew-alerts">{t('crew.openAlerts', {n: p.openAlerts})}</span>}
                  <button className="btn btn-secondary btn-small" onClick={() => onOpen(p.id)}><Eye aria-hidden="true" />{t('crew.open')}</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card crew-alerts-card" aria-labelledby="alerts-title">
        <div className="section-head">
          <h2 id="alerts-title"><Stethoscope aria-hidden="true" />{t('crew.alerts')}</h2>
          <label className="check">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
            {t('crew.showAcked')}
          </label>
        </div>
        {alerts.length === 0 && <p className="muted">{t('crew.noAlerts')}</p>}
        <ol className="alert-list">
          {alerts.map(a => {
            const ind = INDICATOR[a.indicator as IndicatorId];
            const text = ind ? indById(ind.id) : null;
            return (
              <li key={a.id} className={`alert-item alert-${a.tier}${a.ackedAt ? ' is-acked' : ''}`}>
                <div className="alert-head">
                  <span className={`tier-chip tier-${a.tier}`}>{tierText(a.tier).label}</span>
                  <strong>{a.userName}</strong>
                  <span>{text?.label ?? a.indicator}: {ind ? format(ind, a.value) : a.value.join('/')} {text?.unit}</span>
                  <span className="muted">{t('crew.dayShort', {d: a.day})}</span>
                </div>
                {a.ackedAt && <p className="muted alert-acked"><CheckCheck aria-hidden="true" />{t('crew.ackedBy', {name: a.ackedBy ?? ''})}</p>}
                {a.notes.length > 0 && (
                  <ul className="alert-notes">
                    {a.notes.map(n => (
                      <li key={n.id}><strong>{n.author}</strong> <span className="muted">· {t(`role.${n.role}`)}</span><p>{n.body}</p></li>
                    ))}
                  </ul>
                )}
                <div className="alert-actions">
                  <form onSubmit={e => note(e, a.id)}>
                    <MessageSquare aria-hidden="true" />
                    <input
                      value={drafts[a.id] ?? ''} maxLength={2000} placeholder={t('crew.notePlaceholder')} aria-label={t('crew.notePlaceholder')}
                      onChange={e => setDrafts(d => ({...d, [a.id]: e.target.value}))}
                    />
                    <button className="btn btn-secondary btn-small" type="submit">{t('crew.addNote')}</button>
                  </form>
                  {canAck && !a.ackedAt && <button className="btn btn-primary btn-small" onClick={() => ack(a.id)}><CheckCheck aria-hidden="true" />{t('crew.ack')}</button>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
