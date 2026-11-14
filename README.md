# Reto NASA · Atlas 3D

Visor 3D de anatomía humana extraído de [human-atlas](https://github.com/ashemag/human-atlas) (MIT).
Modelo: BodyParts3D 4.0, © DBCLS, **CC BY 4.0**. Mantén `public/ATTRIBUTION.md` si redistribuyes.

```sh
bun install
cp .env.example .env   # agrega tu GROQ_API_KEY (para Orbi)
bun run api            # terminal 1: backend de Orbi en :8787
bun run dev            # terminal 2: app en http://localhost:3016 (proxy /api → :8787)
bun run build          # salida en dist/
```

### Despliegue en Vercel
El frontend (Vite) y el backend se despliegan juntos: `api/chat.ts` y `api/space-weather.ts` son funciones serverless que reutilizan `server/chat.ts` y `server/space-weather.ts` (los mismos handlers que usa `bun run api` en local).
1. Sube el proyecto (o redepliega) en Vercel; `vercel.json` ya define build (`bun run build`) y salida (`dist`).
2. En **Project → Settings → Environment Variables** agrega `GROQ_API_KEY` y `NASA_API_KEY`.
3. Redepliega para que las funciones lean las variables.

### Datos de la NASA
- **NASA DONKI** (clima espacial, en vivo): `GET /api/space-weather` en `server/index.ts` consulta eventos de partículas solares (SEP) y llamaradas (FLR) con caché de 30 min. Usa `NASA_API_KEY` (gratis en api.nasa.gov) o `DEMO_KEY`. Alimenta el indicador “Eventos de partículas solares” (Inmunidad). En la tarjeta de clima espacial hay un interruptor para simular una tormenta en la demo.
- **NASA OSDR OSD-575** (SpaceX Inspiration4, panel metabólico): `public/data/inspiration4-cmp.json` (derivado del CSV público). Compara glucosa, calcio y creatinina con una tripulación real en la pestaña Tendencias; los rangos de laboratorio definen los umbrales de calcio y creatinina.
- **NASA-STD-3001**: límite de carrera de 600 mSv (radiación) y 250 mSv por evento solar. Fuentes de cada umbral en la pestaña Aprender.
- **Pulso con cámara**: `src/components/CameraPulse.tsx` (fotopletismografía + autocorrelación) en Registrar signos.

### Orbi (asistente)
- `server/index.ts` — backend Bun con `groq-sdk` (`openai/gpt-oss-120b`, streaming, `reasoning_effort: medium`). La API key solo vive en el servidor.
- `src/components/Assistant.tsx` + `Orbi.tsx` — mascota flotante y chat; envía las lecturas y riesgos actuales como contexto.
- Da orientación general (prevención, autocuidado, tipos de medicamentos de botiquín); nunca dosis personalizadas: deriva al médico de vuelo.

## Estructura
- `src/atlas/` — escena Three.js: color por sistema, pulso de alerta, encuadre animado, vistas (front/side/back), hover y selección.
- `src/health/model.ts` — indicadores (umbrales, equipo de a bordo, por qué se mide, efecto del espacio, pasos, acciones), niveles de escalado, sistemas, entornos.
- `src/health/data.ts` — datos simulados de la misión, estado por sistema, rutina diaria, entradas del astronauta (localStorage).
- `src/health/report.ts` — reporte de texto para el médico de vuelo.
- `src/router.ts` — rutas por hash: `#/body`, `#/vitals`, `#/routine`.
- `src/pages/` — VitalsPage (registro + evaluación en vivo), RoutinePage.
- `src/components/` — NavBar (MET), AttentionList, DetailPanel (Status / Trends / Learn), Escalation, TrendChart, Routine, Toasts, Timeline.
- `src/styles/` — `tokens.css` (paleta NASA + colores de estado), `base.css`, `layout.css` (responsive), `components.css`. Sin estilos inline.
- `public/models/` — `atlas.json` + 15 chunks `.bin.gz` (~33 MB).

Datos simulados con fines de demostración. No es un dispositivo médico.
