/**
 * AquariumScene — three.js ローポリ魚水槽シーン
 *
 * - 透過レンダラ（alpha:true）+ CSS背景グラデ
 * - 魚データは fishItems prop から受け取り、命令的 syncFish() で差分更新
 * - active=false / document.hidden で rAF ループを完全停止
 * - Layout3DViewer のライフサイクル骨格を踏襲（pixelRatio≤2、ResizeObserver、dispose）
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { FishItem } from '../../types';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Props {
  fishItems: FishItem[];
  active?: boolean;
}

const FISH_COLORS = [0x06b6d4, 0xf97316, 0xfbbf24, 0x8b5cf6, 0x22d3ee, 0xec4899];
const MAX_FISH_FULL = 36;
const MAX_FISH_LITE = 12;
const BUBBLE_COUNT  = 50;

interface FishState {
  mesh: THREE.Group;
  t: number;
  speed: number;
  ax: number; ay: number; az: number;  // amplitudes
  px: number; py: number; pz: number;  // phases
  ly: number; lz: number;              // lane base
  prevX: number;
}

export default function AquariumScene({ fishItems, active = true }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const activeRef      = useRef(active);
  const syncFishRef    = useRef<((items: FishItem[]) => void) | null>(null);
  const fishItemsRef   = useRef(fishItems);

  activeRef.current  = active;
  fishItemsRef.current = fishItems;

  // ── Main setup (runs once) ───────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
    });

    // Scene
    const scene = new THREE.Scene();

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xb3e5fc, 1.3);
    sun.position.set(2, 6, 4);
    scene.add(sun);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 80);
    camera.position.set(0, 1.5, 9);
    camera.lookAt(0, 0, 0);

    // Shared geometry (disposed on cleanup)
    const bodyGeo = new THREE.SphereGeometry(0.28, 6, 4);
    const tailGeo = new THREE.ConeGeometry(0.14, 0.30, 4);
    tailGeo.rotateZ(Math.PI / 2);
    tailGeo.translate(-0.40, 0, 0);

    function makeFishMesh(color: number): THREE.Group {
      const mat  = new THREE.MeshLambertMaterial({ color });
      const g    = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, mat));
      g.add(new THREE.Mesh(tailGeo, mat));
      return g;
    }

    // Bubbles
    const bPos = new Float32Array(BUBBLE_COUNT * 3);
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bPos[i * 3]     = (Math.random() - 0.5) * 18;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 8 - 3;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const bGeo = new THREE.BufferGeometry();
    const bAttr = new THREE.BufferAttribute(bPos, 3);
    bGeo.setAttribute('position', bAttr);
    const bMat = new THREE.PointsMaterial({ size: 0.07, color: 0x67e8f9, transparent: true, opacity: 0.45 });
    const bubbles = new THREE.Points(bGeo, bMat);
    scene.add(bubbles);

    // Fish state array
    const fishStates: FishState[] = [];
    let matPool: THREE.MeshLambertMaterial[] = [];

    function clearFish() {
      for (const fs of fishStates) scene.remove(fs.mesh);
      fishStates.length = 0;
      for (const m of matPool) m.dispose();
      matPool = [];
    }

    function syncFish(items: FishItem[]) {
      clearFish();

      const level   = cachedFxLevel();
      const maxFish = level === 'full' ? MAX_FISH_FULL : MAX_FISH_LITE;

      // Group counts by species name
      const speciesCount = new Map<string, number>();
      for (const item of items) {
        speciesCount.set(item.name, (speciesCount.get(item.name) ?? 0) + (item.count || 1));
      }

      const speciesNames = [...speciesCount.keys()];
      let totalFish = 0;

      for (let si = 0; si < speciesNames.length && totalFish < maxFish; si++) {
        const name    = speciesNames[si];
        const count   = speciesCount.get(name) ?? 1;
        const color   = FISH_COLORS[si % FISH_COLORS.length];
        const perSpecies = Math.max(1, Math.min(count, Math.ceil(maxFish / speciesNames.length)));
        const laneY   = -1.2 + (si / Math.max(speciesNames.length - 1, 1)) * 2.4;
        const laneZ   = -1.5 + (si % 3) * 1.5;

        for (let j = 0; j < perSpecies && totalFish < maxFish; j++) {
          const mat  = new THREE.MeshLambertMaterial({ color });
          matPool.push(mat);
          const mesh = new THREE.Group();
          const body = new THREE.Mesh(bodyGeo, mat);
          const tail = new THREE.Mesh(tailGeo, mat);
          mesh.add(body, tail);
          scene.add(mesh);

          fishStates.push({
            mesh,
            t:     Math.random() * Math.PI * 2,
            speed: 0.38 + Math.random() * 0.28,
            ax: 5  + Math.random() * 2.5,
            ay: 0.45 + Math.random() * 0.35,
            az: 0.35 + Math.random() * 0.25,
            px: Math.random() * Math.PI * 2,
            py: Math.random() * Math.PI * 2,
            pz: Math.random() * Math.PI * 2,
            ly: laneY,
            lz: laneZ,
            prevX: 0,
          });
          totalFish++;
        }
      }

      // Empty aquarium: 3 decorative fish
      if (fishStates.length === 0) {
        for (let i = 0; i < 3; i++) {
          const mat  = new THREE.MeshLambertMaterial({ color: FISH_COLORS[i] });
          matPool.push(mat);
          const mesh = new THREE.Group();
          mesh.add(new THREE.Mesh(bodyGeo, mat));
          mesh.add(new THREE.Mesh(tailGeo, mat));
          scene.add(mesh);
          fishStates.push({
            mesh, t: (i / 3) * Math.PI * 2, speed: 0.35,
            ax: 4.5, ay: 0.55, az: 0.4,
            px: i * 1.3, py: i * 0.9, pz: i * 0.6,
            ly: (i - 1) * 1.3, lz: (i - 1) * 0.9,
            prevX: 0,
          });
        }
      }
    }

    syncFishRef.current = syncFish;
    syncFish(fishItemsRef.current);

    // ── Animation loop ─────────────────────────────────────────────────────
    let prevTime = performance.now();
    let rafId = 0;

    function animate() {
      rafId = requestAnimationFrame(animate);
      if (!activeRef.current || document.hidden) return;

      const now = performance.now();
      const dt  = Math.min((now - prevTime) / 1000, 0.05);
      prevTime  = now;

      // Fish movement
      for (const fs of fishStates) {
        fs.t += dt * fs.speed;
        const x = Math.sin(fs.t + fs.px) * fs.ax;
        const y = fs.ly + Math.sin(fs.t * 0.55 + fs.py) * fs.ay;
        const z = fs.lz + Math.sin(fs.t * 0.38 + fs.pz) * fs.az;
        fs.mesh.position.set(x, y, z);

        // Face direction of travel
        const dx = x - fs.prevX;
        if (Math.abs(dx) > 0.001) fs.mesh.rotation.y = dx > 0 ? 0 : Math.PI;
        fs.prevX = x;

        // Tail wag
        const tail = fs.mesh.children[1] as THREE.Mesh | undefined;
        if (tail) tail.rotation.y = Math.sin(fs.t * 4.5) * 0.28;
      }

      // Bubble rise
      for (let i = 0; i < BUBBLE_COUNT; i++) {
        const y = bAttr.getY(i) + dt * (0.25 + (i % 4) * 0.08);
        bAttr.setY(i, y > 5 ? -5 : y);
      }
      bAttr.needsUpdate = true;

      renderer.render(scene, camera);
    }

    animate();

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      clearFish();
      bodyGeo.dispose();
      tailGeo.dispose();
      bGeo.dispose();
      bMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      syncFishRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync fish when data changes ──────────────────────────────────────────
  useEffect(() => {
    syncFishRef.current?.(fishItems);
  }, [fishItems]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, #082f49 0%, #0e7490 50%, #0891b2 100%)',
      }}
    />
  );
}
