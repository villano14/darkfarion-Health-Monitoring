import {useState} from 'react';
import {ArrowRight, Camera, ClipboardPen, Code, Eye, Siren} from 'lucide-react';
import {useI18n, type Lang} from '../i18n';

function GithubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

/** Opens the working app (sign-in first when there is no session). */
const openApp = () => { location.hash = '/body'; };

type Shot = 'detail' | 'body' | 'vitals' | 'routine' | 'crew' | 'mobile';

const COPY = {
  en: {
    nav: {problem: 'Problem', how: 'How it works', screens: 'Screens', tech: 'Technology', impact: 'Impact', team: 'Team'},
    open: 'Open the app',
    heroTitle: 'Astronaut health, read like a star chart.',
    heroLead: 'Qhalikay helps astronauts on long-duration missions check their own health every day, see which body system needs care, and know who should act: themselves, the crew, or the flight surgeon on Earth.',
    heroSecondary: 'See how it works',
    heroNote: 'Built for the NASA Space Apps Challenge. Demo mission with synthetic daily data.',
    heroCaption: 'Fig. 1 · The heart under the red reticle: blood pressure in alert two days in a row, so the flight surgeon must review it.',
    problemTitle: 'The problem',
    problemBody: [
      'Long missions expose crews to the five hazards mapped by NASA’s Human Research Program. Over months they can bring immune changes, bone loss, cardiovascular events and behavioral health problems.',
      'Far from Earth, astronauts carry much of the responsibility for spotting these changes in themselves, without a doctor at their side and often without knowing what a reading means.',
    ],
    hazards: [
      ['Space radiation', 'Immune system and long-term cancer risk'],
      ['Isolation and confinement', 'Sleep, mood and teamwork'],
      ['Distance from Earth', 'Help arrives late: the crew must act alone'],
      ['Altered gravity', 'Bone, muscle and heart lose conditioning'],
      ['Hostile closed environment', 'Infections and kidney stones'],
    ],
    whyTitle: 'Why it matters',
    why: [
      ['From the Moon to Mars', 'Artemis and future Mars missions mean months away from Earth. On Mars a message takes 4 to 24 minutes each way, so the crew cannot wait for an answer before acting.'],
      ['Small changes come first', 'Blood pressure that creeps up, short nights, too little water: caught early they are fixed with self-care; caught late they become an emergency.'],
      ['Everyone sees the same thing', 'The astronaut, the crew medical officer and the flight surgeon read the same status, computed by one set of rules on the server.'],
    ],
    howTitle: 'How it works',
    how: [
      ['Log', 'Blood pressure, heart rate, blood sugar, temperature, sleep, mood and fluids, typed in or with a tap. The pulse can be measured with the phone camera.'],
      ['Read the body', 'A 3D body is the interface. Each system is ranked like a star by magnitude: the bigger and redder the dot, the more it needs care.'],
      ['Understand', 'Every measurement explains how to take it, why it matters, and how space changes it, in plain words. No medical training assumed.'],
      ['Act', 'A clear ladder says who acts: self-care when a value is out of range, tell the crew on an alert, call the flight surgeon after two days in alert.'],
    ],
    howExtra: 'A daily routine prompts each measurement and workout, with a streak, points and achievements. Orbi, an AI companion, answers questions using the astronaut’s own readings.',
    screensTitle: 'Screens',
    shots: {
      detail: ['Body system detail', 'Risk, who must act, what to do now, and each reading with its trend.'],
      body: ['Body overview', 'The seven systems ranked by magnitude, live NASA space weather and the mission environment.'],
      vitals: ['Daily check-in', 'Readings with a live preliminary assessment as they are typed.'],
      routine: ['Routine and achievements', 'What is next, today’s progress, the streak and earned achievements.'],
      crew: ['Crew view', 'For the crew medical officer and the flight surgeon: every crew member and every alert, with notes.'],
      mobile: ['On a phone', 'The same chart, one-handed, inside a moving cabin.'],
    } as Record<Shot, [string, string]>,
    dataTitle: 'Real NASA data',
    data: [
      ['NASA DONKI', 'Live solar particle events and flares feed the radiation and immune status.'],
      ['NASA OSDR OSD-575', 'The real blood panel of the SpaceX Inspiration4 crew sets lab ranges and demo baselines.'],
      ['NASA-STD-3001', 'Radiation limits: 600 mSv career, 250 mSv per solar event.'],
      ['BodyParts3D', 'The anatomical 3D model (DBCLS, CC BY 4.0).'],
    ],
    techTitle: 'Technology',
    tech: [
      ['Frontend', 'React 19, TypeScript, Vite, Three.js for the 3D body, deployed on Vercel.'],
      ['Backend', 'Go REST API with PostgreSQL on Railway. Migrations run when the API starts.'],
      ['Security', 'Sign-in with JWT and four roles checked on the server: astronaut, crew medical officer, flight surgeon, mission control.'],
      ['Assistant', 'Orbi runs on Groq; the health context is built on the server from the database.'],
      ['Camera', 'Heart rate by photoplethysmography: the fingertip over the lens and flash, 20 seconds.'],
      ['Languages', 'English and Spanish across the whole app.'],
    ],
    impactTitle: 'Impact',
    impactBody: 'Qhalikay turns scattered readings into one picture and one next step. It lets a crew act on its own when Earth is minutes away, gives the flight surgeon a consistent report at the next comm window, and teaches every astronaut what their numbers mean.',
    impact: [
      'Earlier detection through a daily routine that is easy to keep.',
      'The same escalation rules for everyone, from self-care to the flight surgeon.',
      'Autonomy for missions with long communication delays.',
      'Health literacy: each measurement explained, never just a number.',
    ],
    teamTitle: 'Our Team',
    team: [
      {name: 'Juan Salomon Villano Castro', role: 'Fullstack Developer', photo: '/juan.jpeg', github: 'https://github.com/villano14', linkedin: 'https://www.linkedin.com/in/jsvillano?trk=contact-info'},
      {name: 'Rodrigo Riveros Mitma', role: 'Fullstack Developer & QA', photo: '/rodri.jpeg', github: 'https://github.com/Nate2658', linkedin: 'https://www.linkedin.com/in/rodrigo-riveros-mitma-8290a0384/'},
      {name: 'Jacob Aldo Chipana Delgado', role: 'Mobile Developer', photo: '/jacob.jpeg', github: 'https://github.com/jacobaldodev', linkedin: 'https://www.linkedin.com/in/jacobaldochipanadelgado/'},
    ],
    closeTitle: 'Open the mission',
    closeBody: 'Enter with a demo crew member and explore the body, the check-in and the crew view.',
    disclaimer: 'Educational prototype, not a medical device. Thresholds are reference values; daily vitals in the demo are synthetic. Not affiliated with or endorsed by NASA.',
  },
  es: {
    nav: {problem: 'Problemática', how: 'Funcionamiento', screens: 'Capturas', tech: 'Tecnologías', impact: 'Impacto', team: 'Equipo'},
    open: 'Abrir la app',
    heroTitle: 'La salud del astronauta, leída como una carta celeste.',
    heroLead: 'Qhalikay ayuda a los astronautas de misiones largas a revisar su salud cada día, ver qué sistema del cuerpo necesita atención y saber quién debe actuar: ellos mismos, la tripulación o el médico de vuelo en Tierra.',
    heroSecondary: 'Ver cómo funciona',
    heroNote: 'Hecho para el NASA Space Apps Challenge. Misión de demo con datos diarios sintéticos.',
    heroCaption: 'Fig. 1 · El corazón bajo la retícula roja: presión en alerta dos días seguidos, así que debe revisarla el médico de vuelo.',
    problemTitle: 'La problemática',
    problemBody: [
      'Las misiones largas exponen a la tripulación a los cinco peligros que identificó el Programa de Investigación Humana de la NASA. Con los meses pueden causar cambios inmunitarios, pérdida ósea, eventos cardiovasculares y problemas de salud conductual.',
      'Lejos de la Tierra, los astronautas cargan con buena parte de la responsabilidad de detectar esos cambios en sí mismos, sin un médico al lado y muchas veces sin saber qué significa una lectura.',
    ],
    hazards: [
      ['Radiación espacial', 'Sistema inmune y riesgo de cáncer a largo plazo'],
      ['Aislamiento y confinamiento', 'Sueño, ánimo y trabajo en equipo'],
      ['Distancia de la Tierra', 'La ayuda llega tarde: la tripulación actúa sola'],
      ['Gravedad alterada', 'Huesos, músculos y corazón pierden condición'],
      ['Entorno cerrado hostil', 'Infecciones y cálculos renales'],
    ],
    whyTitle: 'Por qué importa',
    why: [
      ['De la Luna a Marte', 'Artemis y las futuras misiones a Marte significan meses lejos de la Tierra. En Marte un mensaje tarda de 4 a 24 minutos en cada sentido, así que la tripulación no puede esperar una respuesta para actuar.'],
      ['Lo pequeño llega primero', 'La presión que sube poco a poco, noches cortas, poca agua: detectados a tiempo se corrigen con autocuidado; tarde, se vuelven una emergencia.'],
      ['Todos ven lo mismo', 'El astronauta, el oficial médico y el médico de vuelo leen el mismo estado, calculado con las mismas reglas en el servidor.'],
    ],
    howTitle: 'Cómo funciona',
    how: [
      ['Registrar', 'Presión, pulso, glucosa, temperatura, sueño, ánimo y líquidos, escritos o con un toque. El pulso se puede medir con la cámara del celular.'],
      ['Leer el cuerpo', 'Un cuerpo 3D es la interfaz. Cada sistema se ordena como una estrella por magnitud: cuanto más grande y rojo el punto, más atención necesita.'],
      ['Entender', 'Cada medición explica cómo tomarla, por qué importa y cómo la cambia el espacio, con palabras simples. No hace falta saber medicina.'],
      ['Actuar', 'Una escalera clara dice quién actúa: autocuidado si un valor sale de rango, avisar a la tripulación ante una alerta, llamar al médico de vuelo tras dos días en alerta.'],
    ],
    howExtra: 'Una rutina diaria recuerda cada medición y entrenamiento, con racha, puntos y logros. Orbi, un asistente con IA, responde usando las lecturas del propio astronauta.',
    screensTitle: 'Capturas',
    shots: {
      detail: ['Detalle de un sistema', 'Riesgo, quién debe actuar, qué hacer ahora y cada lectura con su tendencia.'],
      body: ['Vista del cuerpo', 'Los siete sistemas por magnitud, el clima espacial de la NASA en vivo y el entorno de la misión.'],
      vitals: ['Registro diario', 'Lecturas con una evaluación preliminar en vivo mientras se escriben.'],
      routine: ['Rutina y logros', 'Lo siguiente, el avance del día, la racha y los logros obtenidos.'],
      crew: ['Vista de tripulación', 'Para el oficial médico y el médico de vuelo: cada tripulante y cada alerta, con notas.'],
      mobile: ['En el celular', 'La misma carta, con una mano, dentro de una cabina en movimiento.'],
    } as Record<Shot, [string, string]>,
    dataTitle: 'Datos reales de la NASA',
    data: [
      ['NASA DONKI', 'Eventos de partículas solares y llamaradas en vivo alimentan el estado de radiación e inmunidad.'],
      ['NASA OSDR OSD-575', 'El panel de sangre real de la tripulación de SpaceX Inspiration4 define rangos de laboratorio y valores base de la demo.'],
      ['NASA-STD-3001', 'Límites de radiación: 600 mSv en la carrera, 250 mSv por evento solar.'],
      ['BodyParts3D', 'El modelo anatómico 3D (DBCLS, CC BY 4.0).'],
    ],
    techTitle: 'Tecnologías',
    tech: [
      ['Frontend', 'React 19, TypeScript, Vite y Three.js para el cuerpo 3D, desplegado en Vercel.'],
      ['Backend', 'API REST en Go con PostgreSQL en Railway. Las migraciones corren al iniciar la API.'],
      ['Seguridad', 'Inicio de sesión con JWT y cuatro roles validados en el servidor: astronauta, oficial médico, médico de vuelo y control de misión.'],
      ['Asistente', 'Orbi funciona con Groq; el contexto de salud se arma en el servidor desde la base de datos.'],
      ['Cámara', 'Frecuencia cardiaca por fotopletismografía: la yema del dedo sobre la lente y el flash, 20 segundos.'],
      ['Idiomas', 'Inglés y español en toda la app.'],
    ],
    impactTitle: 'Impacto',
    impactBody: 'Qhalikay convierte lecturas sueltas en una sola imagen y un siguiente paso. Permite que la tripulación actúe por su cuenta cuando la Tierra está a minutos, le da al médico de vuelo un reporte consistente en la próxima ventana de comunicación y enseña a cada astronauta qué significan sus números.',
    impact: [
      'Detección más temprana gracias a una rutina diaria fácil de mantener.',
      'Las mismas reglas de escalado para todos, del autocuidado al médico de vuelo.',
      'Autonomía para misiones con grandes retrasos de comunicación.',
      'Educación en salud: cada medición explicada, nunca solo un número.',
    ],
    teamTitle: 'Nuestro Equipo',
    team: [
      {name: 'Juan Salomon Villano Castro', role: 'Desarrollador Fullstack', photo: '/juan.jpeg', github: 'https://github.com/villano14', linkedin: 'https://www.linkedin.com/in/jsvillano?trk=contact-info'},
      {name: 'Rodrigo Riveros Mitma', role: 'Desarrollador Fullstack y QA', photo: '/rodri.jpeg', github: 'https://github.com/Nate2658', linkedin: 'https://www.linkedin.com/in/rodrigo-riveros-mitma-8290a0384/'},
      {name: 'Jacob Aldo Chipana Delgado', role: 'Desarrollador Mobile', photo: '/jacob.jpeg', github: 'https://github.com/jacobaldodev', linkedin: 'https://www.linkedin.com/in/jacobaldochipanadelgado/'},
    ],
    closeTitle: 'Abre la misión',
    closeBody: 'Entra con un tripulante de demo y recorre el cuerpo, el registro diario y la vista de tripulación.',
    disclaimer: 'Prototipo educativo, no es un dispositivo médico. Los umbrales son valores de referencia; los signos vitales diarios de la demo son sintéticos. Sin afiliación ni respaldo de la NASA.',
  },
} satisfies Record<Lang, unknown>;

const HOW_ICONS = [ClipboardPen, Eye, Camera, Siren];
const SHOTS: Shot[] = ['detail', 'body', 'vitals', 'routine', 'crew', 'mobile'];

/** Project presentation at the root URL, in English (default) and Spanish, with the entry to the app. */
export default function LandingPage() {
  const {lang, setLang} = useI18n();
  const c = COPY[lang];
  const [shot, setShot] = useState<Shot>('detail');
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'});

  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="landing-brand">
          <img src="/logo-mark.webp" alt="" width="46" height="40" />
          <span className="name">Qhalikay</span>
        </span>
        <nav className="landing-nav" aria-label="Qhalikay">
          {(Object.keys(c.nav) as (keyof typeof c.nav)[]).map(k => (
            <button key={k} type="button" onClick={() => go(k)}>{c.nav[k]}</button>
          ))}
        </nav>
        <div className="landing-bar-end">
          <div className="lang-switch" role="group" aria-label="Language" data-lang={lang}>
            <span className="lang-thumb" aria-hidden="true" />
            <button className="lang-option" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
            <button className="lang-option" aria-pressed={lang === 'es'} onClick={() => setLang('es')} lang="es">ES</button>
          </div>
          <button type="button" className="btn btn-primary btn-small" onClick={openApp}>{c.open}<ArrowRight aria-hidden="true" /></button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1 className="name">{c.heroTitle}</h1>
            <p className="landing-lead">{c.heroLead}</p>
            <div className="landing-actions">
              <button type="button" className="btn btn-primary landing-open" onClick={openApp}>{c.open}<ArrowRight aria-hidden="true" /></button>
              <button type="button" className="btn btn-secondary" onClick={() => go('how')}>{c.heroSecondary}</button>
            </div>
            <p className="landing-note">{c.heroNote}</p>
          </div>
          <figure className="landing-figure plate">
            <img src={`/screens/detail-${lang}.webp`} alt={c.shots.detail[0]} width="1440" height="900" />
            <figcaption>{c.heroCaption}</figcaption>
          </figure>
        </section>

        <section id="problem" className="landing-section landing-split">
          <div>
            <h2 className="name">{c.problemTitle}</h2>
            {c.problemBody.map(p => <p key={p} className="landing-text">{p}</p>)}
          </div>
          <ul className="hazard-list">
            {c.hazards.map(([name, effect]) => (
              <li key={name}>
                <span className="mag" aria-hidden="true" />
                <strong className="name">{name}</strong>
                <span>{effect}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section">
          <h2 className="name">{c.whyTitle}</h2>
          <div className="why-grid">
            {c.why.map(([title, body]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="landing-section">
          <h2 className="name">{c.howTitle}</h2>
          <ol className="how-steps">
            {c.how.map(([title, body], i) => {
              const Icon = HOW_ICONS[i];
              return (
                <li key={title}>
                  <span className="how-icon" aria-hidden="true"><Icon /></span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              );
            })}
          </ol>
          <p className="landing-text landing-extra">{c.howExtra}</p>
        </section>

        <section id="screens" className="landing-section">
          <h2 className="name">{c.screensTitle}</h2>
          <div className="gallery">
            <div className="gallery-tabs" role="tablist" aria-label={c.screensTitle}>
              {SHOTS.map(id => (
                <button key={id} role="tab" type="button" aria-selected={shot === id} onClick={() => setShot(id)}>
                  <span className="gallery-tab-name">{c.shots[id][0]}</span>
                  <span className="gallery-tab-text">{c.shots[id][1]}</span>
                </button>
              ))}
            </div>
            <figure className={`gallery-view plate${shot === 'mobile' ? ' is-phone' : ''}`} role="tabpanel">
              <img key={`${shot}-${lang}`} src={`/screens/${shot}-${lang}.webp`} alt={c.shots[shot][0]} loading="lazy" />
            </figure>
          </div>
        </section>

        <section id="tech" className="landing-section landing-split landing-split-even">
          <div>
            <h2 className="name">{c.techTitle}</h2>
            <dl className="fact-list">
              {c.tech.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
          <div>
            <h2 className="name">{c.dataTitle}</h2>
            <dl className="fact-list">
              {c.data.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        </section>

        <section id="impact" className="landing-section landing-split">
          <div>
            <h2 className="name">{c.impactTitle}</h2>
            <p className="landing-text">{c.impactBody}</p>
          </div>
          <ul className="impact-list">
            {c.impact.map(item => <li key={item}><span className="mag" aria-hidden="true" />{item}</li>)}
          </ul>
        </section>

        <section id="team" className="landing-section">
          <h2 className="name">{c.teamTitle}</h2>
          <div className="team-grid">
            {c.team.map(m => (
              <article key={m.name} className="team-card">
                <div className="team-avatar">
                  {m.photo ? (
                    <img src={m.photo} alt={m.name} width="128" height="128" loading="lazy" />
                  ) : (
                    m.name.split(' ').map(w => w[0]).slice(0, 2).join('')
                  )}
                </div>
                <h3>{m.name}</h3>
                <p className="team-role">{m.role}</p>
                <div className="team-links">
                  <a href={m.github} target="_blank" rel="noreferrer" aria-label={`${m.name} GitHub`}><GithubIcon /></a>
                  <a href={m.linkedin} target="_blank" rel="noreferrer" aria-label={`${m.name} LinkedIn`}><LinkedinIcon /></a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-close plate">
          <h2 className="name">{c.closeTitle}</h2>
          <p>{c.closeBody}</p>
          <button type="button" className="btn btn-primary landing-open" onClick={openApp}>{c.open}<ArrowRight aria-hidden="true" /></button>
        </section>
      </main>

      <footer className="landing-foot">
        <p>{c.disclaimer}</p>
        <a href="https://github.com/villano14/darkfarion-Health-Monitoring" target="_blank" rel="noreferrer"><Code aria-hidden="true" />GitHub</a>
      </footer>
    </div>
  );
}
