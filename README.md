# Reto NASA · Atlas 3D

Visor 3D de anatomía humana extraído de [human-atlas](https://github.com/ashemag/human-atlas) (MIT).
Modelo: BodyParts3D 4.0, © DBCLS, **CC BY 4.0**. Mantén `public/ATTRIBUTION.md` si redistribuyes.

```sh
bun install
bun run dev      # http://localhost:3016
bun run build    # salida en dist/
```

## Estructura
- `src/atlas/` — escena Three.js (carga del modelo, color por sistema, pulso de alerta, encuadre animado, selección).
- `src/health/model.ts` — indicadores, umbrales, acciones, sistemas del cuerpo, entornos.
- `src/health/data.ts` — datos simulados de la misión + entradas del astronauta (localStorage).
- `src/components/` — TopBar, SystemList, DetailPanel, Sparkline, CheckInDialog, Timeline.
- `src/styles/` — `tokens.css` (paleta NASA), `base.css`, `layout.css` (responsive), `components.css`. Sin estilos inline.
- `public/models/` — `atlas.json` + 15 chunks `.bin.gz` (~33 MB).

Datos simulados con fines de demostración. No es un dispositivo médico.
