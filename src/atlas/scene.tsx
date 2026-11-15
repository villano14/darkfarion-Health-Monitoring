import {useEffect, useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import type {Atlas, Part, SystemId} from './anatomy';
import type {StagePreset} from './environments';

export type ViewDirection = 'angle' | 'front' | 'side' | 'back';
const DIRECTIONS: Record<ViewDirection, T.Vector3> = {
  angle: new T.Vector3(0.35, 0.06, 1).normalize(),
  front: new T.Vector3(0, 0.03, 1).normalize(),
  side: new T.Vector3(1, 0.03, 0).normalize(),
  back: new T.Vector3(0, 0.03, -1).normalize(),
};

export interface Insets {top: number; right: number; bottom: number; left?: number}
/** Parts painted over the base body (an affected organ or zone). */
/** `label` annotates the zone on the chart: the system's name and the reading behind its state. */
export interface Highlight {ids: string[]; color: string; pulse: boolean; label?: {name: string; value: string}}

export interface SceneProps {
  atlas: Atlas;
  /** Systems rendered (and pickable). */
  visible: SystemId[];
  /** Color per system. Missing systems use the neutral color. */
  colors: Partial<Record<SystemId, string>>;
  /** Opacity per system (default 1). Translucent systems let inner organs show through and are picked last. */
  opacity?: Partial<Record<SystemId, number>>;
  /** Affected organs or zones, painted on top of their system's base color. */
  highlights: Highlight[];
  /** Part ids to frame. Null frames the whole body. */
  focus: string[] | null;
  /** Pixels covered by overlays (panels, sheets); the body is framed in the free area. */
  insets?: Insets;
  /** Camera direction; bump `n` to re-apply the same direction (reset). */
  view: {direction: ViewDirection; n: number};
  /** Called on tap: the tapped part, or null for empty space. */
  onPick: (part: Part | null) => void;
  /** Called while the mouse hovers parts. */
  onHover?: (part: Part | null) => void;
  /** Background, ground, lights and starfield of the current mission environment. */
  stage: StagePreset;
  onProgress: (percent: number) => void;
  onError: (message: string) => void;
}

const NEUTRAL = '#dfe4ea';
/** Bones sit in front of most organs; prefer anything else when both are hit. */
const LOW_PRIORITY: SystemId[] = ['skeletal'];
/** Outer layers: picked only when nothing inside was hit. */
const OUTER: SystemId[] = ['muscular', 'connective'];

export default function AnatomyScene(props: SceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = host.current!;
    const {atlas} = latest.current;
    const abort = new AbortController();
    let disposed = false, frame = 0, dirty = true;

    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'});
    } catch {
      latest.current.onError('WebGL is not available in this browser.');
      return;
    }
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute('aria-label', 'Interactive body. Drag to rotate, scroll or pinch to zoom, tap a system to inspect it.');
    el.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const background = new T.Color(latest.current.stage.background);
    scene.background = background;
    const camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.12;
    controls.maxDistance = 12;
    // Keep the camera above the floor.
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener('change', () => { dirty = true; });

    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    const hemi = new T.HemisphereLight(0x8fb8ff, 0x1a2433, 1.05);
    scene.add(hemi);
    const key = new T.DirectionalLight(0xfff4e6, 2.6);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0x7fb6ff, 2.0);
    rim.position.set(2, 2, -3);
    scene.add(rim);

    // --- Stage: floor, platform with rings, and a starfield -------------------
    const stageMaterials: T.Material[] = [], stageGeometries: T.BufferGeometry[] = [];
    const add = <M extends T.Material>(geometry: T.BufferGeometry, m: M, place: (o: T.Object3D) => void) => {
      const mesh = new T.Mesh(geometry, m);
      place(mesh);
      scene.add(mesh);
      stageMaterials.push(m);
      stageGeometries.push(geometry);
      return m;
    };
    const flat = (y: number) => (o: T.Object3D) => { o.rotation.x = -Math.PI / 2; o.position.y = y; };
    // Unlit floor: it holds the exact night tone of the environment instead of catching the room light.
    const groundMaterial = add(new T.CircleGeometry(30, 96), new T.MeshBasicMaterial(), flat(-0.019));
    const platformMaterial = add(
      new T.CylinderGeometry(0.68, 0.7, 0.028, 100), new T.MeshStandardMaterial({metalness: 0.12, roughness: 0.8, envMapIntensity: 0.1}),
      o => { o.position.y = -0.016; },
    );
    const ringMaterial = add(
      new T.RingGeometry(0.63, 0.632, 128), new T.MeshBasicMaterial({transparent: true, opacity: 0.4, side: T.DoubleSide}), flat(0.001),
    );
    const innerRingMaterial = add(
      new T.RingGeometry(0.55, 0.551, 128), new T.MeshBasicMaterial({transparent: true, opacity: 0.16, side: T.DoubleSide}), flat(0.001),
    );

    const STARS = 1800, starPositions = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const radius = 14 + Math.random() * 22, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starGeometry = new T.BufferGeometry();
    starGeometry.setAttribute('position', new T.BufferAttribute(starPositions, 3));
    const starMaterial = new T.PointsMaterial({color: 0xdfe9ff, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false});
    const stars = new T.Points(starGeometry, starMaterial);
    stars.frustumCulled = false;
    scene.add(stars);
    stageMaterials.push(starMaterial);
    stageGeometries.push(starGeometry);

    const applyStage = (preset: StagePreset) => {
      background.setHex(preset.background);
      renderer.toneMappingExposure = preset.exposure;
      hemi.color.setHex(preset.hemiSky);
      hemi.groundColor.setHex(preset.hemiGround);
      hemi.intensity = preset.hemiIntensity;
      key.color.setHex(preset.keyColor);
      key.intensity = preset.keyIntensity;
      rim.color.setHex(preset.rimColor);
      rim.intensity = preset.rimIntensity;
      groundMaterial.color.setHex(preset.ground);
      platformMaterial.color.setHex(preset.platform);
      ringMaterial.color.setHex(preset.ring);
      innerRingMaterial.color.setHex(preset.ring);
      stars.visible = preset.stars;
      dirty = true;
    };

    // One material and one mesh list per anatomical system.
    const materials = new Map<SystemId, T.MeshStandardMaterial>();
    const meshes = new Map<SystemId, T.Mesh[]>();
    const opacityOf = (system: SystemId) => latest.current.opacity?.[system] ?? 1;
    const applyOpacity = (system: SystemId, m: T.MeshStandardMaterial) => {
      const o = opacityOf(system), transparent = o < 1;
      if (m.transparent !== transparent) m.needsUpdate = true;
      m.transparent = transparent;
      m.opacity = o;
      m.depthWrite = !transparent;
      meshes.get(system)?.forEach(mesh => { mesh.renderOrder = transparent ? 1 : 0; });
    };
    const material = (system: SystemId) => {
      let m = materials.get(system);
      if (!m) {
        m = new T.MeshStandardMaterial({color: latest.current.colors[system] ?? NEUTRAL, metalness: 0.06, roughness: 0.55, side: T.DoubleSide});
        materials.set(system, m);
        applyOpacity(system, m);
      }
      return m;
    };

    const bounds = atlas.parts.map(p => new T.Box3(new T.Vector3().fromArray(p.bounds[0]), new T.Vector3().fromArray(p.bounds[1])));
    const body = bounds.reduce((box, b) => box.union(b), new T.Box3());
    const pickers: (T.Mesh | undefined)[] = [];
    const indexOf = new Map(atlas.parts.map((p, i) => [p.id, i]));

    // Overlays reuse each part's own geometry with a polygon offset so they win the depth test.
    const overlays = new T.Group();
    scene.add(overlays);
    let overlayMaterials: {m: T.MeshStandardMaterial; pulse: boolean}[] = [];
    let overlaysDirty = true;
    const buildOverlays = () => {
      overlays.clear();
      overlayMaterials.forEach(o => o.m.dispose());
      overlayMaterials = [];
      const visible = new Set(latest.current.visible);
      reticle.visible = false;
      label.visible = false;
      for (const h of latest.current.highlights) {
        const m = new T.MeshStandardMaterial({
          color: h.color, metalness: 0.06, roughness: 0.5, side: T.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
          // Rendered in the transparent pass (opacity stays 1) so renderOrder puts it after translucent layers.
          transparent: true, depthWrite: true,
        });
        m.emissive.set(h.color);
        m.emissiveIntensity = 0;
        overlayMaterials.push({m, pulse: h.pulse});
        for (const id of h.ids) {
          const i = indexOf.get(id), base = i !== undefined ? pickers[i] : undefined;
          if (!base || !visible.has(atlas.parts[i!].system)) continue;
          const mesh = new T.Mesh(base.geometry, m);
          mesh.renderOrder = 2;
          mesh.frustumCulled = false;
          overlays.add(mesh);
        }
        // The first alert zone that is on screen gets the reticle.
        if (h.pulse && !reticle.visible) {
          const box = new T.Box3();
          for (const id of h.ids) {
            const i = indexOf.get(id);
            if (i !== undefined && pickers[i] && visible.has(atlas.parts[i].system)) box.union(bounds[i]);
          }
          if (!box.isEmpty()) {
            const size = box.getSize(new T.Vector3());
            box.getCenter(reticle.position);
            reticle.scale.setScalar(T.MathUtils.clamp(Math.max(size.x, size.y) * 1.9, 0.16, 0.42));
            reticle.visible = true;
            // Phones: the object index already carries the reading; the annotation would cover the body.
            if (h.label && el.clientWidth >= 700) {
              drawLabel(h.label.name, h.label.value);
              const height = Math.max(0.09, reticle.scale.x * 0.62);
              label.scale.set(height * (1024 / 192), height, 1);
              label.position.copy(reticle.position);
              // Anchor the label's left edge just outside the reticle's rim, in screen space, from any view.
              label.center.set(-(reticle.scale.x * 0.5) / label.scale.x, 0.5);
              label.visible = true;
            }
          }
        }
      }
      overlaysDirty = false;
      dirty = true;
    };
    const geometries: T.BufferGeometry[] = [];

    // The alert system sits under a star-chart reticle (ring, four ticks, center point).
    const reticleCanvas = document.createElement('canvas');
    reticleCanvas.width = reticleCanvas.height = 256;
    const rg = reticleCanvas.getContext('2d')!;
    rg.strokeStyle = rg.fillStyle = '#fc3d21';
    rg.lineWidth = 5;
    rg.beginPath(); rg.arc(128, 128, 74, 0, Math.PI * 2); rg.stroke();
    rg.lineWidth = 2;
    rg.beginPath(); rg.arc(128, 128, 96, 0, Math.PI * 2); rg.globalAlpha = 0.45; rg.stroke(); rg.globalAlpha = 1;
    rg.lineWidth = 5;
    for (const [x1, y1, x2, y2] of [[128, 8, 128, 58], [128, 198, 128, 248], [8, 128, 58, 128], [198, 128, 248, 128]]) {
      rg.beginPath(); rg.moveTo(x1, y1); rg.lineTo(x2, y2); rg.stroke();
    }
    rg.beginPath(); rg.arc(128, 128, 7, 0, Math.PI * 2); rg.fill();
    const reticleTexture = new T.CanvasTexture(reticleCanvas);
    reticleTexture.colorSpace = T.SRGBColorSpace;
    const reticleMaterial = new T.SpriteMaterial({map: reticleTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false});
    const reticle = new T.Sprite(reticleMaterial);
    reticle.renderOrder = 20;
    reticle.visible = false;
    scene.add(reticle);

    // Chart annotation beside the reticle: a leader line, the system's italic name, its reading.
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 1024;
    labelCanvas.height = 192;
    const labelTexture = new T.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = T.SRGBColorSpace;
    const labelMaterial = new T.SpriteMaterial({map: labelTexture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false});
    const label = new T.Sprite(labelMaterial);
    label.renderOrder = 21;
    label.visible = false;
    scene.add(label);
    let labelKey = '';
    const drawLabel = (name: string, value: string) => {
      const key = `${name}|${value}`;
      if (key === labelKey) return;
      labelKey = key;
      const g = labelCanvas.getContext('2d')!;
      g.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
      g.strokeStyle = '#fc3d21';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 96); g.lineTo(150, 96); g.lineTo(190, 60); g.stroke();
      g.fillStyle = '#f2f2e9';
      g.font = 'italic 500 64px "Source Serif 4 Variable", Georgia, serif';
      g.textBaseline = 'alphabetic';
      g.fillText(name, 205, 74);
      g.fillStyle = '#ff8069';
      g.font = '600 46px "Public Sans Variable", system-ui, sans-serif';
      g.fillText(value, 207, 138);
      labelTexture.needsUpdate = true;
    };
    // Canvas text needs the faces loaded; redraw once they are.
    document.fonts?.ready.then(() => { labelKey = ''; overlaysDirty = true; });

    // --- Loading -----------------------------------------------------------
    let loaded = 0;
    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci], compressed = !!chunk.gzip;
      const response = await fetch(compressed ? chunk.gzip! : chunk.url, {signal: abort.signal});
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed) return;
      const groups = new Map<SystemId, T.BufferGeometry[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3));
        g.setAttribute('normal', new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true));
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        pickers[i] = new T.Mesh(g);
        geometries.push(g);
        const list = groups.get(p.system) ?? [];
        list.push(g);
        groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const merged = mergeGeometries(gs, false);
        if (!merged) throw new Error('Could not assemble the anatomy geometry.');
        geometries.push(merged);
        const mesh = new T.Mesh(merged, material(system));
        mesh.frustumCulled = false;
        mesh.visible = latest.current.visible.includes(system);
        mesh.renderOrder = opacityOf(system) < 1 ? 1 : 0;
        scene.add(mesh);
        meshes.set(system, [...(meshes.get(system) ?? []), mesh]);
      });
      loaded++;
      overlaysDirty = true;
      latest.current.onProgress(Math.round((loaded / atlas.chunks.length) * 100));
      dirty = true;
    };
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(Array.from({length: 3}, async () => {
          while (cursor < atlas.chunks.length) await loadChunk(cursor++);
        }));
      } catch (e) {
        if (!disposed && (e as Error).name !== 'AbortError') latest.current.onError(e instanceof Error ? e.message : 'Could not load the model.');
      }
    })();

    // --- Camera framing with a smooth tween --------------------------------
    const goalTarget = new T.Vector3(), goalPosition = new T.Vector3();
    let direction = DIRECTIONS[latest.current.view.direction];
    let tweening = false;
    const frameBox = (box: T.Box3, instant: boolean) => {
      const size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
      // Shift the projection so the frame is centered in the area not covered by overlays.
      const w = el.clientWidth, h = el.clientHeight, i = latest.current.insets ?? {top: 0, right: 0, bottom: 0};
      const top = Math.min(i.top, h * 0.4), bottom = Math.min(i.bottom, h * 0.6);
      const right = Math.min(i.right, w * 0.45), left = Math.min(i.left ?? 0, w * 0.45);
      if (top || bottom || right || left) camera.setViewOffset(w, h, (right - left) / 2, (bottom - top) / 2, w, h);
      else camera.clearViewOffset();
      const usableW = Math.max(120, w - right - left), usableH = Math.max(120, h - top - bottom);
      // Never frame less than ~0.5 m so small organs keep their surroundings.
      const fit = Math.max(size.y, size.x / (usableW / usableH), 0.42) * 1.2 * (h / usableH);
      const distance = Math.max(0.25, fit / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) + size.z / 2);
      goalTarget.copy(center);
      goalPosition.copy(center).addScaledVector(direction, distance);
      if (instant) {
        controls.target.copy(goalTarget);
        camera.position.copy(goalPosition);
        controls.update();
      }
      tweening = !instant;
      dirty = true;
    };
    const focusBox = () => {
      const ids = latest.current.focus;
      if (!ids?.length) return body;
      const set = new Set(ids), box = new T.Box3();
      atlas.parts.forEach((p, i) => { if (set.has(p.id)) box.union(bounds[i]); });
      return box.isEmpty() ? body : box;
    };
    controls.addEventListener('start', () => { tweening = false; });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, w < 768 ? 1.5 : 2));
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameBox(focusBox(), true);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    // --- Picking -------------------------------------------------------------
    const raycaster = new T.Raycaster(), pointer = new T.Vector2(), tap = new PointerTap(), hit = new T.Vector3();
    const hitTest = (e: PointerEvent): Part | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const visible = new Set(latest.current.visible);
      const painted = new Set(latest.current.highlights.flatMap(h => h.ids));
      // Priority: painted (at-risk) zones, then solid parts, then translucent layers and bones.
      // Lower tier wins; distance breaks ties within a tier.
      const tierOf = (p: Part) => {
        if (painted.has(p.id)) return 0;
        const translucent = opacityOf(p.system) < 0.6;
        if (OUTER.includes(p.system)) return translucent ? 4 : 3;
        if (LOW_PRIORITY.includes(p.system)) return translucent ? 3 : 2;
        return translucent ? 2 : 1;
      };
      let index = -1, bestTier = Infinity, bestDistance = Infinity;
      atlas.parts.forEach((p, i) => {
        const mesh = pickers[i];
        if (!mesh || !visible.has(p.system) || !raycaster.ray.intersectBox(bounds[i], hit)) return;
        const d = raycaster.intersectObject(mesh, false)[0]?.distance;
        if (d === undefined) return;
        const tier = tierOf(p);
        if (tier < bestTier || (tier === bestTier && d < bestDistance)) { bestTier = tier; bestDistance = d; index = i; }
      });
      return index >= 0 ? atlas.parts[index] : null;
    };
    let lastHover = 0, hovered: Part | null = null;
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons || !loaded || !latest.current.onHover) return;
      const t = performance.now();
      if (t - lastHover < 70) return;
      lastHover = t;
      const part = hitTest(e);
      if (part !== hovered) { hovered = part; latest.current.onHover(part); }
    };
    const leave = () => { if (hovered) { hovered = null; latest.current.onHover?.(null); } };
    const canvas = renderer.domElement;
    const onDown = (e: PointerEvent) => tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5);
    const onMove = (e: PointerEvent) => { tap.move(e.pointerId, e.clientX, e.clientY); hover(e); };
    const onUp = (e: PointerEvent) => { if (tap.up(e.pointerId, e.clientX, e.clientY) && loaded > 0) latest.current.onPick(hitTest(e)); };
    const onCancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', leave);
    const onContextLost = (e: Event) => { e.preventDefault(); latest.current.onError('The 3D view was paused by your device. Reload to continue.'); };
    canvas.addEventListener('webglcontextlost', onContextLost);

    // --- Render loop -------------------------------------------------------
    const clock = new T.Clock();
    let last: SceneProps | null = null;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05), p = latest.current;

      if (!last || p.visible !== last.visible || p.colors !== last.colors || p.opacity !== last.opacity) {
        const visible = new Set(p.visible);
        meshes.forEach((list, system) => list.forEach(m => { m.visible = visible.has(system); }));
        materials.forEach((m, system) => { m.color.set(p.colors[system] ?? NEUTRAL); applyOpacity(system, m); });
        dirty = true;
      }
      if (!last || p.stage !== last.stage) applyStage(p.stage);
      if (overlaysDirty || !last || p.highlights !== last.highlights || p.visible !== last.visible) buildOverlays();
      if (last && p.view !== last.view) direction = DIRECTIONS[p.view.direction];
      if (!last || p.focus !== last.focus || p.view !== last.view || p.insets !== last.insets) frameBox(focusBox(), !last);
      last = p;

      if (tweening) {
        const k = 1 - Math.exp(-6 * dt);
        controls.target.lerp(goalTarget, k);
        camera.position.lerp(goalPosition, k);
        if (camera.position.distanceTo(goalPosition) < 0.002) tweening = false;
        dirty = true;
      }

      // High-risk zones breathe with a soft emissive glow.
      const glow = 0.1 + 0.14 * Math.sin(clock.elapsedTime * 3.2);
      overlayMaterials.forEach(o => {
        if (!o.pulse) return;
        o.m.emissiveIntensity = glow;
        dirty = true;
      });

      controls.update();
      if (dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    animate();

    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      overlayMaterials.forEach(o => o.m.dispose());
      reticleMaterial.dispose();
      reticleTexture.dispose();
      labelMaterial.dispose();
      labelTexture.dispose();
      stageMaterials.forEach(m => m.dispose());
      stageGeometries.forEach(g => g.dispose());
      env.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [props.atlas]);

  return <div className="scene" ref={host} />;
}
