# CrewHealth · Reto NASA

Monitoreo de salud para misiones de larga duración: los astronautas registran sus indicadores, ven el estado de cada sistema del cuerpo en 3D y saben cuándo actuar solos, avisar a la tripulación o llamar al médico de vuelo.

- **Frontend:** Vite + React + Three.js (`src/`), desplegado en Vercel.
- **Backend:** Go + PostgreSQL (`backend/`), desplegado en Railway. Las **migraciones corren solas al iniciar la API**.
- Modelo 3D: BodyParts3D 4.0, © DBCLS, **CC BY 4.0** (ver `public/ATTRIBUTION.md`). Visor basado en [human-atlas](https://github.com/ashemag/human-atlas) (MIT).

## Desarrollo local

```sh
# 1. Base de datos + API (Docker o Podman)
cd backend && docker compose up          # API en http://localhost:8080, con misión de demo

# o sin contenedor para la API:
cd backend && cp .env.example .env       # ajusta DATABASE_URL
go run ./cmd/api

# 2. Frontend
bun install
bun run dev                              # http://localhost:3016 (proxy /api → :8080)
```

Con `SEED_DEMO=true` la pantalla de inicio muestra las cuentas de demo (contraseña `demo1234`).

## Roles

| Rol | Puede |
|---|---|
| **Astronauta** | Ver y registrar solo sus datos, rutina, logros, Orbi |
| **Oficial médico de la tripulación** | Lo anterior + ver a toda su tripulación, atender alertas y dejar notas |
| **Médico de vuelo** | Ver las misiones asignadas, revisar alertas, dejar recomendaciones, reporte. No registra mediciones |
| **Control de misión** | Crear misiones y personas, asignar roles |

Los permisos se validan en el servidor: un astronauta recibe `403` si pide datos de otra persona.

## API (`/api`)

| Método | Ruta | Quién |
|---|---|---|
| POST | `/auth/login` | público |
| GET | `/config` | público (indica si hay cuentas de demo) |
| GET | `/me` · `/catalog` | todos |
| GET | `/readings?user=` | uno mismo, oficial médico, médico de vuelo, admin |
| POST | `/readings` | astronauta, oficial médico (genera alertas) |
| GET | `/routine` · `/progress` · `/report?lang=` | según acceso a la persona |
| POST | `/routine/{tarea}/toggle` | astronauta, oficial médico |
| GET | `/alerts?status=open` · POST `/alerts/{id}/notes` | según acceso |
| POST | `/alerts/{id}/ack` | oficial médico, médico de vuelo |
| GET | `/crew` | oficial médico, médico de vuelo, admin |
| GET | `/space-weather` · `/osdr/cmp` | todos |
| POST | `/chat` | astronauta, oficial médico (Orbi, streaming) |
| GET/POST | `/admin/users` · `/admin/missions` | admin |

El estado de cada sistema y el nivel de escalado (autocuidado → tripulación → médico de vuelo) se calculan en el servidor, así todos ven lo mismo.

## Datos

- **Catálogo** (indicadores, umbrales, pasos, acciones, riesgos, entornos, rutina y logros, en ES y EN): tablas `indicators`, `*_i18n`, etc., cargadas por la migración `000002_catalog`. Para cambiar un umbral o un texto, agrega una migración nueva en `backend/migrations/`.
- **NASA OSDR OSD-575** (Inspiration4, panel metabólico real): tablas `osdr_*`, migración `000003` (datos originales en `backend/scripts/inspiration4-cmp.json`).
- **NASA DONKI** (clima espacial): la API lo consulta cada 30 min, lo guarda en `external_cache` y registra los eventos solares del día como lectura `feed` de cada tripulante.
- **Misión de demo** (`SEED_DEMO=true`): 4 astronautas emparejados con los 4 tripulantes anónimos de Inspiration4. Su glucosa, calcio y creatinina parten de sus **valores reales previos al vuelo** (OSDR). La NASA no publica signos vitales, sueño ni ánimo diarios de astronautas, así que esos se generan con semilla fija (`source = seed`). `SEED_DEMO=reset` recrea la demo para que abra en el día 87.

## Despliegue

### Backend en Railway
1. **New Project → Deploy from GitHub repo** y elige este repositorio.
2. En el servicio: **Settings → Root Directory = `/backend`** (usa `backend/Dockerfile` y `backend/railway.toml`).
3. **+ New → Database → PostgreSQL**. En el servicio de la API agrega la variable `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
4. Variables: `JWT_SECRET` (32+ caracteres al azar), `CORS_ORIGINS` (URL de Vercel, p. ej. `https://tu-app.vercel.app`), `SEED_DEMO=true`, `NASA_API_KEY`, `GROQ_API_KEY`.
5. **Settings → Networking → Generate Domain**. Al desplegar, los logs muestran `migrations ready` y luego `CrewHealth API listening`.

### Frontend en Vercel
- Variable `VITE_API_URL` = dominio de Railway (p. ej. `https://crewhealth-api.up.railway.app`) y redepliega.

Herramienta educativa con datos de demostración. No es un dispositivo médico.
