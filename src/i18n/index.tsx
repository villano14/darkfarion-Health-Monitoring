import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {
  GROUP, INDICATOR, MISSION, TIERS, actionsFor, riskFor,
  type Assessment, type Environment, type Group, type Hazard, type Indicator, type Status, type Tier,
} from '../health/model';
import type {Task} from '../health/data';
import {ES_ENVIRONMENTS, ES_GROUPS, ES_HAZARDS, ES_INDICATORS, ES_ROLE, ES_SOURCES, ES_TASKS, ES_TIERS} from './es';

export type Lang = 'en' | 'es';

const UI = {
  en: {
    'nav.body': 'Body',
    'nav.vitals': 'Log vitals',
    'nav.routine': 'Routine',
    'nav.main': 'Main',
    'nav.home': 'CrewHealth home',
    'nav.env': 'Mission environment',
    'nav.met': 'Mission elapsed time',
    'nav.streak': '{n}-day check-in streak',
    'nav.language': 'Language',

    'status.normal': 'Normal',
    'status.watch': 'Watch',
    'status.alert': 'Alert',
    'legend': 'Legend',
    'legend.normal': 'In range',
    'legend.watch': 'Mild risk',
    'legend.alert': 'High risk',

    'body.loading': 'Loading body model · {p}%',
    'body.loadError': 'The body model could not be loaded.',
    'body.atRisk': '{n} at risk',
    'body.atRiskLabel': 'Systems at risk',
    'body.allClear': 'All systems in range',
    'body.camera': 'Camera view',
    'body.front': 'Front',
    'body.side': 'Side',
    'body.back': 'Back',
    'body.reset': 'Reset view',

    'detail.label': '{name} details',
    'detail.close': 'Close details',
    'detail.view': 'Detail view',
    'detail.status': 'Status',
    'detail.trends': 'Trends',
    'detail.learn': 'Learn',
    'detail.inRange': 'All readings in range.',
    'detail.day': 'Day {n}',
    'detail.normal': 'Normal {range} {unit}',
    'detail.doNow': 'What to do now',
    'detail.keep': 'Keep it in range',
    'detail.range': 'Range',
    'detail.days': '{n} days',
    'detail.hazards': 'Spaceflight hazards',
    'detail.why': 'Why measure',
    'detail.space': 'In space',
    'detail.device': 'Measured with',

    'esc.label': 'Who should act',
    'esc.self': 'Follow the plan and recheck',
    'esc.crew': 'Tell a crewmate now',
    'esc.surgeon': 'Contact the flight surgeon',
    'esc.autonomous': 'Act on the plan, then report',
    'esc.delay': 'Signal delay {d}',
    'esc.copy': 'Copy report',
    'esc.copied': 'Report copied',

    'chart.empty': 'Not enough readings yet',
    'chart.day': 'Day {n}',
    'chart.aria': '{label}, last {n} readings. Latest {value} {unit}.',

    'routine.title': 'Routine',
    'routine.sub': 'Measurements and exercise that keep you mission-ready.',
    'routine.today': "Today's routine",
    'routine.of': '{a} of {b}',
    'routine.done': 'Done',
    'routine.overdue': 'Overdue',
    'routine.due': 'Due now',
    'routine.next': 'Up next',
    'routine.todayStat': 'Today',
    'routine.streak': 'Streak',
    'routine.days': '{n} days',
    'routine.week': 'This week',
    'routine.weekdays': 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    'routine.tasksDone': '{a} of {b} tasks done',
    'routine.logNow': 'Log now',

    'timeline.pause': 'Pause',
    'timeline.replay': 'Replay mission',
    'timeline.day': 'Day',
    'timeline.mission': 'Mission day',
    'timeline.today': 'Back to today',

    'vitals.title': 'Log vitals',
    'vitals.sub': 'Enter what you measured. The assessment updates as you type.',
    'vitals.sys': 'Sys',
    'vitals.dia': 'Dia',
    'vitals.moodOf': '{n} of 5',
    'vitals.savedAt': 'Saved at {t}',
    'vitals.save': 'Save readings',
    'vitals.assessment': 'Assessment',
    'vitals.count': '{a} of {b} readings',
    'vitals.empty': 'Your results appear here as you enter readings.',
    'vitals.clear': 'All readings in range',
    'vitals.keep': 'Keep your routine.',
    'vitals.next': 'Next:',
    'vitals.see': 'See {name} on the body',
    'vitals.disclaimer': 'Preliminary guidance from simulated thresholds. Not a diagnosis.',

    'toast.back': '{name} back in range',
    'toast.changed': '{name}: {status}',
    'toast.saved': 'Readings saved',
    'toast.dismiss': 'Dismiss',

    'orbi.name': 'Orbi',
    'orbi.role': 'Your health companion',
    'orbi.open': 'Ask Orbi',
    'orbi.close': 'Close chat',
    'orbi.clear': 'New chat',
    'orbi.placeholder': 'Ask about your risks or medicines…',
    'orbi.send': 'Send',
    'orbi.greetRisk': "Hi! I'm Orbi. I see {n} at risk: {list}. Want me to tell you what to do?",
    'orbi.greetOk': "Hi! I'm Orbi. All your systems are in range today. Ask me anything about your health in space.",
    'orbi.s1': 'What should I do about my risks?',
    'orbi.s2': 'Which kit medicines help with fever?',
    'orbi.s3': 'How does space affect my heart?',
    'orbi.thinking': 'Orbi is thinking…',
    'orbi.err.auth': 'I am not connected yet: the server is missing its GROQ_API_KEY.',
    'orbi.err.offline': 'I cannot reach my server right now. Try again in a moment.',
    'orbi.err.rate': 'Too many questions at once. Try again in a moment.',
    'orbi.err.refusal': 'I cannot help with that one. Please ask your flight surgeon.',
    'orbi.err.generic': 'Something went wrong. Try again.',
    'orbi.disclaimer': 'Guidance only. Medication decisions go through your flight surgeon.',

    'detail.source': 'Source',
    'crew.title': 'Real crew data · Inspiration4',
    'crew.pre': 'Pre-flight',
    'crew.landing': 'Landing day (R+1)',
    'crew.range': 'Crew range',
    'crew.you': 'You',
    'crew.source': 'NASA OSDR · OSD-575 (2021, 4 crew)',

    'weather.title': 'Space weather',
    'weather.live': 'Live · NASA DONKI',
    'weather.calm': 'No solar particle events in the last 3 days.',
    'weather.storm': 'Solar particle event. Go to the storm shelter.',
    'weather.last': 'Last event: {date}',
    'weather.none': 'No events in the last 60 days',
    'weather.flares': '{n} solar flares in 14 days',
    'weather.loading': 'Checking NASA DONKI…',
    'weather.error': 'Live NASA feed unavailable right now.',
    'weather.simulate': 'Simulate solar storm',
    'weather.view': 'View on DONKI',

    'pulse.button': 'Measure with camera',
    'pulse.title': 'Camera pulse',
    'pulse.instructions': 'Cover the camera and flash with your fingertip. Stay still for 20 seconds.',
    'pulse.start': 'Start',
    'pulse.measuring': 'Measuring… {s} s',
    'pulse.noFinger': 'Cover the lens fully with your fingertip',
    'pulse.use': 'Use this value',
    'pulse.retry': 'Try again',
    'pulse.failed': 'Could not read a clear pulse. Try again with steady, gentle pressure.',
    'pulse.denied': 'Camera access was blocked or is not available.',
    'pulse.close': 'Close',
    'pulse.note': 'Estimate from the camera (photoplethysmography). Not a medical device.',
  },
  es: {
    'nav.body': 'Cuerpo',
    'nav.vitals': 'Registrar signos',
    'nav.routine': 'Rutina',
    'nav.main': 'Principal',
    'nav.home': 'Inicio de CrewHealth',
    'nav.env': 'Entorno de la misión',
    'nav.met': 'Tiempo transcurrido de misión',
    'nav.streak': 'Racha de {n} días de registro',
    'nav.language': 'Idioma',

    'status.normal': 'Normal',
    'status.watch': 'Vigilar',
    'status.alert': 'Alerta',
    'legend': 'Leyenda',
    'legend.normal': 'En rango',
    'legend.watch': 'Riesgo leve',
    'legend.alert': 'Riesgo alto',

    'body.loading': 'Cargando modelo del cuerpo · {p}%',
    'body.loadError': 'No se pudo cargar el modelo del cuerpo.',
    'body.atRisk': '{n} en riesgo',
    'body.atRiskLabel': 'Sistemas en riesgo',
    'body.allClear': 'Todos los sistemas en rango',
    'body.camera': 'Vista de cámara',
    'body.front': 'Frente',
    'body.side': 'Lado',
    'body.back': 'Espalda',
    'body.reset': 'Restablecer vista',

    'detail.label': 'Detalles de {name}',
    'detail.close': 'Cerrar detalles',
    'detail.view': 'Vista de detalle',
    'detail.status': 'Estado',
    'detail.trends': 'Tendencias',
    'detail.learn': 'Aprender',
    'detail.inRange': 'Todas las lecturas en rango.',
    'detail.day': 'Día {n}',
    'detail.normal': 'Normal {range} {unit}',
    'detail.doNow': 'Qué hacer ahora',
    'detail.keep': 'Mantenlo en rango',
    'detail.range': 'Rango',
    'detail.days': '{n} días',
    'detail.hazards': 'Peligros del vuelo espacial',
    'detail.why': 'Por qué se mide',
    'detail.space': 'En el espacio',
    'detail.device': 'Se mide con',

    'esc.label': 'Quién debe actuar',
    'esc.self': 'Sigue el plan y vuelve a medir',
    'esc.crew': 'Avisa a un compañero ahora',
    'esc.surgeon': 'Contacta al médico de vuelo',
    'esc.autonomous': 'Actúa según el plan y luego informa',
    'esc.delay': 'Retardo de señal {d}',
    'esc.copy': 'Copiar reporte',
    'esc.copied': 'Reporte copiado',

    'chart.empty': 'Aún no hay suficientes lecturas',
    'chart.day': 'Día {n}',
    'chart.aria': '{label}, últimas {n} lecturas. Última {value} {unit}.',

    'routine.title': 'Rutina',
    'routine.sub': 'Mediciones y ejercicio que te mantienen listo para la misión.',
    'routine.today': 'Rutina de hoy',
    'routine.of': '{a} de {b}',
    'routine.done': 'Hecho',
    'routine.overdue': 'Atrasado',
    'routine.due': 'Ahora',
    'routine.next': 'Siguiente',
    'routine.todayStat': 'Hoy',
    'routine.streak': 'Racha',
    'routine.days': '{n} días',
    'routine.week': 'Esta semana',
    'routine.weekdays': 'Lun,Mar,Mié,Jue,Vie,Sáb,Dom',
    'routine.tasksDone': '{a} de {b} tareas hechas',
    'routine.logNow': 'Registrar ahora',

    'timeline.pause': 'Pausar',
    'timeline.replay': 'Reproducir misión',
    'timeline.day': 'Día',
    'timeline.mission': 'Día de misión',
    'timeline.today': 'Volver a hoy',

    'vitals.title': 'Registrar signos vitales',
    'vitals.sub': 'Ingresa lo que mediste. La evaluación se actualiza mientras escribes.',
    'vitals.sys': 'Sis',
    'vitals.dia': 'Dia',
    'vitals.moodOf': '{n} de 5',
    'vitals.savedAt': 'Guardado a las {t}',
    'vitals.save': 'Guardar lecturas',
    'vitals.assessment': 'Evaluación',
    'vitals.count': '{a} de {b} lecturas',
    'vitals.empty': 'Tus resultados aparecen aquí a medida que ingresas lecturas.',
    'vitals.clear': 'Todas las lecturas en rango',
    'vitals.keep': 'Mantén tu rutina.',
    'vitals.next': 'Siguiente paso:',
    'vitals.see': 'Ver {name} en el cuerpo',
    'vitals.disclaimer': 'Orientación preliminar con umbrales simulados. No es un diagnóstico.',

    'toast.back': '{name} volvió al rango',
    'toast.changed': '{name}: {status}',
    'toast.saved': 'Lecturas guardadas',
    'toast.dismiss': 'Cerrar',

    'orbi.name': 'Orbi',
    'orbi.role': 'Tu compañero de salud',
    'orbi.open': 'Pregúntale a Orbi',
    'orbi.close': 'Cerrar chat',
    'orbi.clear': 'Nueva conversación',
    'orbi.placeholder': 'Pregunta por tus riesgos o medicamentos…',
    'orbi.send': 'Enviar',
    'orbi.greetRisk': '¡Hola! Soy Orbi. Veo {n} en riesgo: {list}. ¿Quieres que te diga qué hacer?',
    'orbi.greetOk': '¡Hola! Soy Orbi. Hoy todos tus sistemas están en rango. Pregúntame lo que quieras sobre tu salud en el espacio.',
    'orbi.s1': '¿Qué hago con mis riesgos?',
    'orbi.s2': '¿Qué medicamentos del botiquín sirven para la fiebre?',
    'orbi.s3': '¿Cómo afecta el espacio a mi corazón?',
    'orbi.thinking': 'Orbi está pensando…',
    'orbi.err.auth': 'Aún no estoy conectado: al servidor le falta su GROQ_API_KEY.',
    'orbi.err.offline': 'No puedo conectar con mi servidor ahora. Intenta de nuevo en un momento.',
    'orbi.err.rate': 'Demasiadas preguntas a la vez. Intenta de nuevo en un momento.',
    'orbi.err.refusal': 'No puedo ayudar con eso. Consulta a tu médico de vuelo.',
    'orbi.err.generic': 'Algo salió mal. Intenta de nuevo.',
    'orbi.disclaimer': 'Solo orientación. Las decisiones sobre medicamentos pasan por tu médico de vuelo.',

    'detail.source': 'Fuente',
    'crew.title': 'Datos reales de tripulación · Inspiration4',
    'crew.pre': 'Antes del vuelo',
    'crew.landing': 'Día del aterrizaje (R+1)',
    'crew.range': 'Rango de la tripulación',
    'crew.you': 'Tú',
    'crew.source': 'NASA OSDR · OSD-575 (2021, 4 tripulantes)',

    'weather.title': 'Clima espacial',
    'weather.live': 'En vivo · NASA DONKI',
    'weather.calm': 'Sin eventos de partículas solares en los últimos 3 días.',
    'weather.storm': 'Evento de partículas solares. Ve al refugio contra tormentas.',
    'weather.last': 'Último evento: {date}',
    'weather.none': 'Sin eventos en los últimos 60 días',
    'weather.flares': '{n} llamaradas solares en 14 días',
    'weather.loading': 'Consultando NASA DONKI…',
    'weather.error': 'Datos en vivo de la NASA no disponibles ahora.',
    'weather.simulate': 'Simular tormenta solar',
    'weather.view': 'Ver en DONKI',

    'pulse.button': 'Medir con la cámara',
    'pulse.title': 'Pulso con la cámara',
    'pulse.instructions': 'Cubre la cámara y el flash con la yema del dedo. Quédate quieto 20 segundos.',
    'pulse.start': 'Empezar',
    'pulse.measuring': 'Midiendo… {s} s',
    'pulse.noFinger': 'Cubre la lente por completo con la yema del dedo',
    'pulse.use': 'Usar este valor',
    'pulse.retry': 'Intentar de nuevo',
    'pulse.failed': 'No se pudo leer un pulso claro. Intenta de nuevo con presión suave y constante.',
    'pulse.denied': 'El acceso a la cámara está bloqueado o no disponible.',
    'pulse.close': 'Cerrar',
    'pulse.note': 'Estimación con la cámara (fotopletismografía). No es un dispositivo médico.',
  },
} as const;

export type Key = keyof typeof UI.en;
type Vars = Record<string, string | number>;

interface LangState {lang: Lang; setLang: (l: Lang) => void}
const LangContext = createContext<LangState>({lang: 'en', setLang: () => {}});
const STORAGE = 'crewhealth.lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === 'en' || saved === 'es') return saved;
  } catch { /* storage unavailable */ }
  return navigator.language?.startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({children}: {children: ReactNode}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE, lang); } catch { /* storage unavailable */ }
  }, [lang]);
  const value = useMemo(() => ({lang, setLang}), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** UI strings plus localized health content for the current language. */
export function useI18n() {
  const {lang, setLang} = useContext(LangContext);
  const es = lang === 'es';

  const t = useCallback((key: Key, vars?: Vars) => {
    let text: string = UI[lang][key] ?? UI.en[key];
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  }, [lang]);

  return useMemo(() => {
    const ind = (i: Indicator): Indicator => (es ? {...i, ...ES_INDICATORS[i.id], source: ES_SOURCES[i.id]} : i);
    return {
      lang,
      setLang,
      t,
      status: (s: Status) => t(`status.${s}`),
      ind,
      indById: (id: Indicator['id']) => ind(INDICATOR[id]),
      group: (g: Group): Group => (es ? {...g, ...ES_GROUPS[g.id]} : g),
      groupName: (id: Group['id']) => (es ? ES_GROUPS[id].name : GROUP[id].name),
      hazard: (h: Hazard) => (es ? ES_HAZARDS[h] : h),
      env: (e: Environment) => (es ? ES_ENVIRONMENTS[e.id] : e.name),
      task: (task: Task) => (es ? ES_TASKS[task.id] ?? task.label : task.label),
      tier: (id: Exclude<Tier, 'none'>) => (es ? ES_TIERS[id] : TIERS.find(x => x.id === id)!),
      risk: (i: Indicator, a: Assessment) => {
        if (!es) return riskFor(i, a);
        if (a.status === 'normal' || !a.direction) return undefined;
        return ES_INDICATORS[i.id].risks[`${a.status}-${a.direction}`];
      },
      actions: (i: Indicator, a: Assessment) => actionsFor(ind(i), a),
      role: es ? ES_ROLE : MISSION.role,
    };
  }, [lang, setLang, t, es]);
}

export type I18n = ReturnType<typeof useI18n>;
