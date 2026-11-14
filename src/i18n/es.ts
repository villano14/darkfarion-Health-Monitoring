import type {ActionKey, EnvironmentId, GroupId, Hazard, IndicatorId, Tier} from '../health/model';

/** Spanish health content. English lives in health/model.ts. */

interface IndicatorText {
  label: string;
  how: string;
  device: string;
  why: string;
  space: string;
  steps: string[];
  actions: Partial<Record<ActionKey, string[]>>;
  risks: Partial<Record<ActionKey, string>>;
  source?: string;
  unit?: string;
}

export const ES_INDICATORS: Record<IndicatorId, IndicatorText> = {
  bp: {
    label: 'Presión arterial',
    how: 'Sentado, brazo a la altura del corazón, tras 5 min de reposo.',
    device: 'Tensiómetro automático de brazo',
    why: 'Detecta sobrecarga del corazón y los vasos antes de que dé síntomas.',
    space: 'En ingravidez los fluidos suben hacia la cabeza, y el corazón y los vasos se adaptan.',
    steps: ['Siéntate quieto 5 minutos', 'Coloca el brazalete en el brazo descubierto', 'Apoya el brazo a la altura del corazón', 'Pulsa inicio y no hables'],
    actions: {
      normal: ['30 min en el cicloergómetro', 'Mantén bajo el sodio'],
      'watch-high': ['Vuelve a medir en 15 min', 'Reduce el sodio hoy', 'Mantén el ejercicio aeróbico diario'],
      'alert-high': ['Vuelve a medir ahora, en ambos brazos', 'Detén la actividad intensa', 'Avisa a un compañero'],
      'alert-low': ['Acuéstate con las piernas elevadas', 'Bebe 500 mL de líquido', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Presión arterial elevada', 'alert-high': 'Riesgo de hipertensión', 'alert-low': 'Presión arterial baja'},
  },
  hr: {
    label: 'Frecuencia cardíaca en reposo',
    how: 'En reposo, antes del café o el ejercicio. Cuenta 60 s.',
    device: 'Tensiómetro o banda pectoral',
    why: 'Una frecuencia en reposo que sube puede indicar fatiga, deshidratación o enfermedad.',
    space: 'Sin gravedad el corazón trabaja menos y puede perder forma física en unos meses.',
    steps: ['Mide antes de levantarte', 'Busca el pulso en la muñeca', 'Cuenta los latidos durante 60 segundos'],
    actions: {
      normal: ['Mantén sesiones aeróbicas 5 días por semana'],
      'watch-high': ['Descansa 10 min y vuelve a medir', 'Hidrátate'],
      'watch-low': ['Vuelve a medir tras 2 min de pie'],
      'alert-high': ['Detén la actividad y siéntate', 'Registra un ECG', 'Avisa a un compañero'],
      'alert-low': ['Registra un ECG', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Frecuencia en reposo elevada', 'alert-high': 'Taquicardia', 'watch-low': 'Frecuencia cardíaca baja', 'alert-low': 'Bradicardia'},
  },
  glucose: {
    label: 'Glucosa en sangre',
    how: 'En ayunas, con glucómetro de punción.',
    device: 'Glucómetro de punción digital',
    why: 'Muestra qué tan bien convierte el cuerpo los alimentos en energía.',
    space: 'Menos movimiento y un menú fijo pueden empeorar el manejo del azúcar.',
    steps: ['Mide antes del desayuno', 'Limpia la yema del dedo y deja secar', 'Pincha el costado del dedo', 'Toca la tira con la gota'],
    actions: {
      normal: ['Reparte las comidas durante el día', 'Camina o pedalea tras las comidas'],
      'watch-high': ['Revisa el horario de comidas', 'Añade una sesión de bicicleta tras comer'],
      'alert-high': ['Vuelve a medir en 1 h', 'Avisa a un compañero'],
      'watch-low': ['Come un refrigerio ahora', 'Vuelve a medir en 15 min'],
      'alert-low': ['Toma 15 g de azúcar rápido ahora', 'Vuelve a medir en 15 min', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Rango de prediabetes', 'alert-high': 'Hiperglucemia', 'watch-low': 'Glucosa baja', 'alert-low': 'Hipoglucemia'},
  },
  water: {
    label: 'Ingesta de líquidos',
    how: 'Total de bebidas registradas desde que despertaste.',
    device: 'Contador de bolsas de bebida',
    why: 'Beber poco concentra la orina y favorece los cálculos renales.',
    space: 'En ingravidez los huesos liberan calcio y la sed es menor, así que los cálculos se forman con más facilidad.',
    steps: ['Cuenta cada bolsa de bebida', 'Suma sopas y comidas rehidratadas', 'Registra el total en litros'],
    actions: {
      normal: ['Ten una bolsa de bebida a mano'],
      'watch-low': ['Bebe 500 mL en la próxima hora', 'Programa un recordatorio para beber'],
      'alert-low': ['Bebe 1 L en 2 horas', 'Atento a dolor en el costado', 'Avisa a un compañero'],
      'watch-high': ['Reparte las bebidas durante el día'],
    },
    risks: {'watch-low': 'Ingesta baja de líquidos', 'alert-low': 'Deshidratación · riesgo de cálculos renales', 'watch-high': 'Ingesta alta de líquidos'},
  },
  temp: {
    label: 'Temperatura corporal',
    how: 'Termómetro oral, 15 min después de comer o beber.',
    device: 'Termómetro oral digital',
    why: 'La fiebre es la primera señal de una infección.',
    space: 'El estrés y la radiación debilitan la inmunidad, y los microbios se propagan fácilmente en una cabina cerrada.',
    steps: ['Espera 15 min tras comer o beber', 'Coloca la punta bajo la lengua', 'Cierra la boca hasta que suene'],
    actions: {
      normal: ['Lávate las manos antes de comer', 'Duerme 7 h o más'],
      'watch-high': ['Hidrátate y descansa', 'Vuelve a medir en 2 h'],
      'alert-high': ['Limita el contacto con la tripulación', 'Vuelve a medir en 1 h', 'Avisa a un compañero'],
      'watch-low': ['Abrígate y toma algo caliente', 'Vuelve a medir en 1 h'],
      'alert-low': ['Entra en calor ahora', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Febrícula', 'alert-high': 'Fiebre · posible infección', 'watch-low': 'Temperatura baja', 'alert-low': 'Riesgo de hipotermia'},
  },
  radiation: {
    label: 'Dosis de radiación',
    how: 'Total desde el lanzamiento, leído de tu dosímetro.',
    device: 'Dosímetro personal',
    why: 'La dosis total define el riesgo de cáncer a largo plazo y limita el tiempo de misión.',
    space: 'Fuera del escudo de la Tierra, los rayos cósmicos y las tormentas solares suman dosis cada día.',
    steps: ['Lleva el dosímetro siempre', 'Conéctalo a diario para sincronizar', 'Refúgiate si suena la alerta de tormenta solar'],
    actions: {
      normal: ['Duerme en los camarotes blindados'],
      'watch-high': ['Limita el tiempo en módulos poco blindados', 'Revisa el plan de dosis con la tripulación'],
      'alert-high': ['Ve al refugio contra tormentas', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Dosis acumulada alta', 'alert-high': 'Riesgo de superar el límite de dosis'},
  },
  sleep: {
    label: 'Sueño',
    how: 'Horas realmente dormidas anoche.',
    device: 'Registro de sueño o actígrafo de muñeca',
    why: 'Dormir poco enlentece los reflejos y aumenta el riesgo de errores.',
    space: 'Dieciséis amaneceres al día, ruido y estrés alteran el reloj biológico.',
    steps: ['Anota la hora en que te dormiste', 'Anota la hora en que despertaste', 'Resta el tiempo que pasaste despierto'],
    actions: {
      normal: ['Mantén el mismo horario de sueño', 'Baja la luz 1 h antes de dormir'],
      'watch-low': ['Baja la luz 1 h antes de dormir', 'Mantén un horario fijo de sueño', 'Sin pantallas en el camarote'],
      'alert-low': ['Pide un cambio de horario', 'Avisa a un compañero'],
      'watch-high': ['Revisa si hay fatiga o enfermedad'],
    },
    risks: {'watch-low': 'Déficit de sueño', 'alert-low': 'Pérdida grave de sueño', 'watch-high': 'Exceso de sueño'},
  },
  mood: {
    label: 'Estado de ánimo',
    how: '¿Cómo te sientes hoy, en general?',
    device: 'Autoevaluación',
    why: 'Un ánimo bajo durante días afecta el sueño, el trabajo en equipo y la seguridad.',
    space: 'El aislamiento, el confinamiento y la distancia de casa pesan en el ánimo.',
    steps: ['Haz una pausa', 'Piensa en el día completo', 'Elige la cara que encaja'],
    actions: {
      normal: ['Comparte una comida con la tripulación', 'Mantén una llamada semanal a casa'],
      'watch-low': ['Agenda una llamada privada a casa', 'Dedica tiempo a un pasatiempo', 'Comparte una comida con la tripulación'],
      'alert-low': ['Habla con el equipo de salud conductual', 'Cuéntale a un compañero cómo te sientes'],
    },
    risks: {'watch-low': 'Ánimo bajo', 'alert-low': 'Riesgo de salud conductual'},
  },
  bone: {
    label: 'Densidad ósea',
    how: 'Cambio respecto a la línea base previa al vuelo.',
    device: 'Ecografía semanal',
    why: 'Los huesos débiles se rompen con más facilidad tras el aterrizaje.',
    space: 'Sin carga, los huesos de la cadera y la columna pierden 1–1,5 % de masa al mes.',
    steps: ['La programa cada semana el médico de vuelo', 'Explora talón y cadera con la sonda', 'Los resultados se sincronizan solos'],
    actions: {
      normal: ['Sesión diaria de resistencia', 'Calcio y vitamina D con las comidas'],
      'watch-low': ['Aumenta la carga en las sesiones de resistencia', 'Calcio y vitamina D con las comidas'],
      'alert-low': ['Revisa el plan de ejercicio', 'Avisa a un compañero'],
    },
    risks: {'watch-low': 'Pérdida ósea', 'alert-low': 'Riesgo de osteoporosis'},
  },
  muscle: {
    label: 'Masa muscular',
    how: 'Cambio respecto a la línea base previa al vuelo.',
    device: 'Ecografía semanal',
    why: 'Unos músculos fuertes te protegen en las caminatas espaciales y en el aterrizaje.',
    space: 'Piernas y espalda se reducen rápido cuando ya no sostienen el cuerpo.',
    steps: ['La programa cada semana el médico de vuelo', 'Explora muslo y pantorrilla con la sonda', 'Los resultados se sincronizan solos'],
    actions: {
      normal: ['Entrenamiento de resistencia 6 días por semana', 'Proteína en cada comida'],
      'watch-low': ['Añade una sesión de resistencia', 'Proteína en cada comida'],
      'alert-low': ['Revisa el plan de ejercicio', 'Avisa a un compañero'],
    },
    risks: {'watch-low': 'Pérdida muscular', 'alert-low': 'Atrofia muscular grave'},
  },
  calcium: {
    label: 'Calcio en sangre',
    how: 'Control semanal de sangre.',
    device: 'Analizador de sangre portátil',
    why: 'El calcio que liberan los huesos aumenta el riesgo de cálculos renales.',
    space: 'Sin carga, los huesos liberan calcio a la sangre y a la orina.',
    steps: ['Limpia la yema del dedo y deja secar', 'Llena el cartucho del analizador con una gota', 'Los resultados se sincronizan solos'],
    actions: {
      normal: ['Mantén más de 2 L de líquidos al día'],
      'watch-high': ['Bebe 500 mL más hoy', 'Limita la sal y la proteína animal'],
      'alert-high': ['Vuelve a medir con el analizador', 'Atento a dolor en el costado', 'Avisa a un compañero'],
      'watch-low': ['Calcio y vitamina D con las comidas'],
      'alert-low': ['Vuelve a medir con el analizador', 'Avisa a un compañero'],
    },
    risks: {'watch-high': 'Calcio alto · riesgo de cálculos renales', 'alert-high': 'Hipercalcemia', 'watch-low': 'Calcio bajo', 'alert-low': 'Hipocalcemia'},
  },
  creatinine: {
    label: 'Creatinina',
    how: 'Control semanal de sangre.',
    device: 'Analizador de sangre portátil',
    why: 'Muestra qué tan bien filtran la sangre los riñones.',
    space: 'La deshidratación y el desplazamiento de fluidos cambian cómo filtran los riñones.',
    steps: ['Limpia la yema del dedo y deja secar', 'Llena el cartucho del analizador con una gota', 'Los resultados se sincronizan solos'],
    actions: {
      normal: ['Mantén más de 2 L de líquidos al día'],
      'watch-high': ['Bebe 500 mL más hoy', 'Vuelve a medir la próxima semana'],
      'alert-high': ['Vuelve a medir con el analizador', 'Avisa a un compañero'],
      'watch-low': ['Revisa la tendencia de tu masa muscular'],
    },
    risks: {'watch-high': 'Filtrado renal reducido', 'alert-high': 'Alerta de función renal', 'watch-low': 'Creatinina baja'},
  },
  solar: {
    label: 'Eventos de partículas solares',
    unit: 'eventos',
    how: 'Datos en vivo, últimos 3 días.',
    device: 'Datos de clima espacial NASA DONKI',
    why: 'Una tormenta solar puede dar una dosis alta de radiación en pocas horas.',
    space: 'Fuera del campo magnético de la Tierra, los eventos de partículas solares son la mayor amenaza de radiación a corto plazo.',
    steps: ['Atento a la alerta de tormenta solar', 'Ve al refugio blindado contra tormentas', 'Quédate hasta que den el aviso de fin'],
    actions: {
      normal: ['Conoce tu ruta al refugio contra tormentas'],
      'alert-high': ['Ve al refugio contra tormentas ahora', 'Quédate hasta el aviso de fin', 'Avisa a un compañero'],
    },
    risks: {'alert-high': 'Evento de partículas solares · refúgiate ahora'},
  },
};

export const ES_SOURCES: Record<IndicatorId, string> = {
  bp: 'Guía de presión arterial AHA/ACC 2017',
  hr: 'American Heart Association, frecuencia en reposo en adultos',
  glucose: 'American Diabetes Association, glucosa en ayunas; comparada con NASA OSDR OSD-575 (Inspiration4)',
  water: 'Programa de Investigación Humana de la NASA, riesgo de cálculos renales',
  calcium: 'Rango de laboratorio de NASA OSDR OSD-575 (panel metabólico de Inspiration4)',
  creatinine: 'Rango de laboratorio de NASA OSDR OSD-575 (panel metabólico de Inspiration4)',
  temp: 'Rango clínico de temperatura oral',
  radiation: 'NASA-STD-3001 Vol. 1: límite de carrera 600 mSv (vigilar al 30 %, alerta al 60 %)',
  solar: 'Datos en vivo de NASA DONKI (CCMC). NASA-STD-3001: límite de 250 mSv por evento solar',
  sleep: 'National Sleep Foundation y AASM, horas de sueño en adultos',
  mood: 'Escala de autoevaluación',
  bone: 'Programa de Investigación Humana de la NASA, riesgo de osteoporosis temprana',
  muscle: 'Programa de Investigación Humana de la NASA, riesgo de pérdida de masa y fuerza muscular',
};

export const ES_GROUPS: Record<GroupId, {name: string; role: string}> = {
  heart: {name: 'Corazón', role: 'Bombea sangre a todos los tejidos.'},
  brain: {name: 'Cerebro', role: 'Controla el sueño, el ánimo y la concentración.'},
  metabolism: {name: 'Metabolismo', role: 'Convierte los alimentos en energía.'},
  kidneys: {name: 'Riñones', role: 'Filtran la sangre y equilibran los líquidos.'},
  immune: {name: 'Inmunidad', role: 'Defiende contra infecciones y daño por radiación.'},
  bones: {name: 'Huesos', role: 'Sostienen el cuerpo y almacenan minerales.'},
  muscles: {name: 'Músculos', role: 'Mueven y estabilizan el cuerpo.'},
};

export const ES_HAZARDS: Record<Hazard, string> = {
  Radiation: 'Radiación',
  Isolation: 'Aislamiento',
  Distance: 'Distancia',
  Gravity: 'Gravedad',
  'Closed environment': 'Entorno cerrado',
};

export const ES_ENVIRONMENTS: Record<EnvironmentId, string> = {
  iss: 'Estación espacial',
  orion: 'Nave de espacio profundo',
  moon: 'Base lunar',
  mars: 'Base en Marte',
};

export const ES_TASKS: Record<string, string> = {
  sleep: 'Registrar sueño',
  vitals: 'Presión arterial y pulso',
  glucose: 'Glucosa en ayunas',
  ared: 'Entrenamiento de resistencia, 60 min',
  cycle: 'Cicloergómetro, 30 min',
  temp: 'Temperatura corporal',
  water: 'Registrar líquidos',
  mood: 'Registro de ánimo',
};

export const ES_TIERS: Record<Exclude<Tier, 'none'>, {label: string; rule: string}> = {
  self: {label: 'Autocuidado', rule: 'Fuera de rango'},
  crew: {label: 'Tripulación', rule: 'Alerta'},
  surgeon: {label: 'Médico de vuelo', rule: 'Alerta 2 días seguidos'},
};

export const ES_ROLE = 'Ingeniería de vuelo';
