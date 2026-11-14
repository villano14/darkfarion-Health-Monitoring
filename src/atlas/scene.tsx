import {useEffect, useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import type {Atlas, Part, SystemId} from './anatomy';

export type ViewDirection = 'angle' | 'front' | 'side' | 'back';
const DIRECTIONS: Record<ViewDirection, T.Vector3> = {
  angle: new T.Vector3(0.35, 0.06, 1).normalize(),
  front: new T.Vector3(0, 0.03, 1).normalize(),
  side: new T.Vector3(1, 0.03, 0).normalize(),
  back: new T.Vector3(0, 0.03, -1).normalize(),
};

export interface Insets {top: number; right: number; bottom: number; left?: number}
/** Parts painted over the base body (an affected organ or zone). */
export interface Highlight {ids: string[]; color: string; pulse: boolean}

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
      renderer = new T.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'high-performance'});
    } catch {
      latest.current.onError('WebGL is not available in this browser.');
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute('aria-label', 'Interactive body. Drag to rotate, scroll or pinch to zoom, tap a system to inspect it.');
    el.appendChild(renderer.domElement);

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.005, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.12;
    controls.maxDistance = 12;
    controls.addEventListener('change', () => { dirty = true; });

    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight(0xffffff, 0xa7acb2, 1.05));
    const key = new T.DirectionalLight(0xfffaf4, 2.3);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0xe9f0ff, 1.8);
    rim.position.set(2, 2, -3);
    scene.add(rim);

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
      }
      overlaysDirty = false;
      dirty = true;
    };
    const geometries: T.BufferGeometry[] = [];

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
      env.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [props.atlas]);

  return <div className="scene" ref={host} />;
}
