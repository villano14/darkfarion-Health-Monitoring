# Reto NASA · Atlas 3D

Visor 3D de anatomía humana extraído de [human-atlas](https://github.com/ashemag/human-atlas) (MIT).
Modelo: BodyParts3D 4.0, © DBCLS, **CC BY 4.0**. Mantén `public/ATTRIBUTION.md` si redistribuyes.

```sh
bun install
bun run dev      # http://localhost:3016
bun run build    # salida en dist/
```

## Estructura
- `src/atlas/scene.tsx` — escena Three.js (carga, render, picking, explosión, aislamiento).
- `src/atlas/anatomy.ts` — tipos, sistemas y colores.
- `src/App.tsx` — estado de la escena (`SceneState`) y overlay mínimo.
- `public/models/` — `atlas.json` + 15 chunks `.bin.gz` (~33 MB).

## Controlar la escena
Cambia `state` en `App.tsx`:
`explode` (0–1), `visible` (sistemas), `selected` (ids), `isolate`, `view` (`front|back|side|three-quarter`), `rotate`, `reset` (incrementar para recentrar).
