/**
 * AquariumScene — three.js リアル系 水中シーン
 *
 * リアリティ要素:
 *  - 体をうねらせて泳ぐ多ヒレの魚（尾びれ・背びれ・胸びれ＋目）
 *  - 進行方向へのバンク（旋回時の傾き）と滑らかな向き補間
 *  - 海底の動くコースティクス（CanvasTexture を UV スクロール）
 *  - 上方からの光芒（god rays / 加算合成）の揺らぎ
 *  - 深度フォグ（遠景がブルーに沈む）
 *  - 漂うプランクトン粒子と立ち上る泡
 *  - カメラの微小アイドルドリフト
 *
 * パフォーマンス:
 *  - fxLevel 'full' / 'lite' で魚数・粒子・光芒を段階制御
 *  - active=false / document.hidden で rAF 停止
 *  - ジオメトリ/マテリアルは共有＆アンマウントで dispose
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { FishItem } from '../../types';
import { cachedFxLevel } from '../../lib/deviceTier';

interface Props {
  fishItems: FishItem[];
  active?: boolean;
}

const FISH_COLORS = [0x06b6d4, 0xf97316, 0xfbbf24, 0x8b5cf6, 0x22d3ee, 0xec4899, 0x34d399, 0xf43f5e];
const MAX_FISH_FULL = 40;
const MAX_FISH_LITE = 14;

interface FishState {
  group: THREE.Group;        // 位置・全体向き
  body: THREE.Group;         // うねり用（yaw 振動）
  tail: THREE.Mesh;
  t: number;
  speed: number;
  ax: number; ay: number; az: number;
  px: number; py: number; pz: number;
  ly: number; lz: number;
  scale: number;
  prev: THREE.Vector3;
  heading: number;           // 現在の向き（補間用）
}

export default function AquariumScene({ fishItems, active = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const syncFishRef = useRef<((items: FishItem[]) => void) | null>(null);
  const fishItemsRef = useRef(fishItems);

  activeRef.current = active;
  fishItemsRef.current = fishItems;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const level = cachedFxLevel();
    const isFull = level === 'full';

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: isFull });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isFull ? 2 : 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
    });

    // ── Scene / fog ───────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a4f73, isFull ? 0.045 : 0.06);

    // ── Lights ────────────────────────────────────────────────
    const hemi = new THREE.HemisphereLight(0xbfefff, 0x06324a, 0.85);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0x4fb8e6, 0.35);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xdff6ff, 1.5);
    sun.position.set(-3, 10, 4);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.5);
    rim.position.set(4, 2, -6);
    scene.add(rim);

    // ── Camera ────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.2, 9.5);
    camera.lookAt(0, 0.3, 0);

    // ── Caustics canvas texture ───────────────────────────────
    function makeCausticsTexture(): THREE.CanvasTexture {
      const size = 256;
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = size;
      const ctx = cvs.getContext('2d')!;
      ctx.fillStyle = '#0a4f73';
      ctx.fillRect(0, 0, size, size);
      // 明るいうねり模様
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const r = 12 + Math.random() * 34;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.10 + Math.random() * 0.22;
        g.addColorStop(0, `rgba(190,245,255,${a})`);
        g.addColorStop(1, 'rgba(190,245,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(cvs);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      return tex;
    }
    const caustics = makeCausticsTexture();

    // ── Seabed ────────────────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(60, 40, 1, 1);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c5b80, roughness: 1, metalness: 0,
      map: caustics, transparent: true, opacity: 0.95,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.2;
    scene.add(floor);

    // ── God rays（上方からの光芒）──────────────────────────────
    const rayMeshes: THREE.Mesh[] = [];
    let rayGeo: THREE.PlaneGeometry | null = null;
    let rayMat: THREE.MeshBasicMaterial | null = null;
    let rayTex: THREE.CanvasTexture | null = null;
    if (isFull) {
      const rc = document.createElement('canvas');
      rc.width = 64; rc.height = 256;
      const rctx = rc.getContext('2d')!;
      const grad = rctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, 'rgba(220,248,255,0.55)');
      grad.addColorStop(1, 'rgba(220,248,255,0)');
      rctx.fillStyle = grad;
      rctx.fillRect(0, 0, 64, 256);
      rayTex = new THREE.CanvasTexture(rc);
      rayGeo = new THREE.PlaneGeometry(1.6, 11);
      rayMat = new THREE.MeshBasicMaterial({
        map: rayTex, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(rayGeo, rayMat);
        m.position.set(-5 + i * 2.6 + Math.random(), 3.5, -4 - Math.random() * 2);
        m.rotation.z = (Math.random() - 0.5) * 0.4;
        scene.add(m);
        rayMeshes.push(m);
      }
    }

    // ── Plankton particles ────────────────────────────────────
    let plankton: THREE.Points | null = null;
    let plkGeo: THREE.BufferGeometry | null = null;
    let plkMat: THREE.PointsMaterial | null = null;
    const PLK = isFull ? 220 : 70;
    {
      const pos = new Float32Array(PLK * 3);
      for (let i = 0; i < PLK; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 22;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 9;
      }
      plkGeo = new THREE.BufferGeometry();
      plkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      plkMat = new THREE.PointsMaterial({
        size: 0.035, color: 0xcdeffd, transparent: true, opacity: 0.55, depthWrite: false,
      });
      plankton = new THREE.Points(plkGeo, plkMat);
      scene.add(plankton);
    }

    // ── Bubbles ───────────────────────────────────────────────
    const BUB = isFull ? 70 : 30;
    const bPos = new Float32Array(BUB * 3);
    const bSpeed = new Float32Array(BUB);
    for (let i = 0; i < BUB; i++) {
      bPos[i * 3] = (Math.random() - 0.5) * 18;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 8 - 2;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 7;
      bSpeed[i] = 0.4 + Math.random() * 0.7;
    }
    const bGeo = new THREE.BufferGeometry();
    const bAttr = new THREE.BufferAttribute(bPos, 3);
    bGeo.setAttribute('position', bAttr);
    const bMat = new THREE.PointsMaterial({
      size: 0.12, color: 0xeafdff, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const bubbles = new THREE.Points(bGeo, bMat);
    scene.add(bubbles);

    // ── Shared fish geometry ──────────────────────────────────
    // ボディ: 扁平楕円体 / 尾びれ・背びれ・胸びれ / 目
    const bodyGeo = new THREE.SphereGeometry(0.5, 14, 10);
    bodyGeo.scale(1.0, 0.55, 0.32);
    const tailGeo = new THREE.ConeGeometry(0.28, 0.5, 5);
    tailGeo.scale(1, 1, 0.16);
    tailGeo.rotateZ(-Math.PI / 2);
    tailGeo.translate(-0.62, 0, 0);
    const dorsalGeo = new THREE.ConeGeometry(0.16, 0.34, 4);
    dorsalGeo.scale(1, 1, 0.14);
    dorsalGeo.translate(0.02, 0.34, 0);
    const pecGeo = new THREE.ConeGeometry(0.12, 0.26, 4);
    pecGeo.scale(1, 1, 0.1);
    const eyeGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.1 });

    const fishStates: FishState[] = [];
    let matPool: THREE.Material[] = [];

    function makeFish(color: number, scale: number): { group: THREE.Group; body: THREE.Group; tail: THREE.Mesh } {
      const bodyMat = isFull
        ? new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.2, emissive: new THREE.Color(color).multiplyScalar(0.04) })
        : new THREE.MeshLambertMaterial({ color });
      const finColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25);
      const finMat = isFull
        ? new THREE.MeshStandardMaterial({ color: finColor, roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
        : new THREE.MeshLambertMaterial({ color: finColor, side: THREE.DoubleSide });
      matPool.push(bodyMat, finMat);

      const body = new THREE.Group();
      body.add(new THREE.Mesh(bodyGeo, bodyMat));
      const tail = new THREE.Mesh(tailGeo, finMat);
      body.add(tail);
      const dorsal = new THREE.Mesh(dorsalGeo, finMat);
      body.add(dorsal);
      if (isFull) {
        const pecL = new THREE.Mesh(pecGeo, finMat);
        pecL.position.set(0.05, -0.12, 0.18);
        pecL.rotation.set(0.5, 0, -0.6);
        const pecR = pecL.clone();
        pecR.position.z = -0.18;
        pecR.rotation.set(-0.5, 0, -0.6);
        body.add(pecL, pecR);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.36, 0.08, 0.13);
        const eyeR = eyeL.clone();
        eyeR.position.z = -0.13;
        body.add(eyeL, eyeR);
      }

      const group = new THREE.Group();
      group.scale.setScalar(scale);
      group.add(body);
      return { group, body, tail };
    }

    function clearFish() {
      for (const fs of fishStates) scene.remove(fs.group);
      fishStates.length = 0;
      for (const m of matPool) m.dispose();
      matPool = [];
    }

    function spawnFish(color: number, ly: number, lz: number, scale: number) {
      const { group, body, tail } = makeFish(color, scale);
      scene.add(group);
      fishStates.push({
        group, body, tail,
        t: Math.random() * Math.PI * 2,
        speed: 0.32 + Math.random() * 0.3,
        ax: 5 + Math.random() * 2.5,
        ay: 0.5 + Math.random() * 0.5,
        az: 0.5 + Math.random() * 0.6,
        px: Math.random() * Math.PI * 2,
        py: Math.random() * Math.PI * 2,
        pz: Math.random() * Math.PI * 2,
        ly, lz, scale,
        prev: new THREE.Vector3(0, ly, lz),
        heading: 0,
      });
    }

    function syncFish(items: FishItem[]) {
      clearFish();
      const maxFish = isFull ? MAX_FISH_FULL : MAX_FISH_LITE;

      const speciesCount = new Map<string, number>();
      for (const item of items) {
        speciesCount.set(item.name, (speciesCount.get(item.name) ?? 0) + (item.count || 1));
      }
      const speciesNames = [...speciesCount.keys()];
      let total = 0;

      for (let si = 0; si < speciesNames.length && total < maxFish; si++) {
        const count = speciesCount.get(speciesNames[si]) ?? 1;
        const color = FISH_COLORS[si % FISH_COLORS.length];
        const per = Math.max(1, Math.min(count, Math.ceil(maxFish / speciesNames.length)));
        const laneY = -1.4 + (si / Math.max(speciesNames.length - 1, 1)) * 2.8;
        const laneZ = -1.8 + (si % 3) * 1.6;
        for (let j = 0; j < per && total < maxFish; j++) {
          spawnFish(color, laneY + (Math.random() - 0.5) * 0.6, laneZ + (Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 0.5);
          total++;
        }
      }

      // 空水槽: 装飾の魚
      if (fishStates.length === 0) {
        for (let i = 0; i < 4; i++) {
          spawnFish(FISH_COLORS[i % FISH_COLORS.length], (i - 1.5) * 1.1, (i % 2 === 0 ? -1 : 1) * 1.2, 0.85 + Math.random() * 0.4);
        }
      }
    }

    syncFishRef.current = syncFish;
    syncFish(fishItemsRef.current);

    // ── Animation loop ────────────────────────────────────────
    let prevTime = performance.now();
    let rafId = 0;
    let elapsed = 0;
    const tmp = new THREE.Vector3();

    function animate() {
      rafId = requestAnimationFrame(animate);
      if (!activeRef.current || document.hidden) { prevTime = performance.now(); return; }

      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      elapsed += dt;

      for (const fs of fishStates) {
        fs.t += dt * fs.speed;
        const x = Math.sin(fs.t + fs.px) * fs.ax;
        const y = fs.ly + Math.sin(fs.t * 0.6 + fs.py) * fs.ay;
        const z = fs.lz + Math.sin(fs.t * 0.42 + fs.pz) * fs.az;
        tmp.set(x, y, z);

        // 進行方向ベクトル
        const vx = x - fs.prev.x;
        const vy = y - fs.prev.y;
        const targetHeading = Math.atan2(-(z - fs.prev.z), vx); // y軸まわり
        // 滑らかに向き補間
        let dh = targetHeading - fs.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        fs.heading += dh * Math.min(1, dt * 6);

        fs.group.position.copy(tmp);
        fs.group.rotation.y = fs.heading;
        // ピッチ（上下動に応じて頭を上げ下げ）
        fs.group.rotation.z = THREE.MathUtils.clamp(vy * 6, -0.5, 0.5);
        // バンク（旋回でロール）
        fs.group.rotation.x = THREE.MathUtils.clamp(-dh * 2.5, -0.6, 0.6);

        // 体のうねり＋尾びれ振り
        const wag = Math.sin(fs.t * 7);
        fs.body.rotation.y = wag * 0.12;
        fs.tail.rotation.y = Math.sin(fs.t * 7 + 0.6) * 0.5;

        fs.prev.copy(tmp);
      }

      // 泡: 上昇＋横揺れ
      for (let i = 0; i < BUB; i++) {
        let yy = bAttr.getY(i) + dt * bSpeed[i];
        if (yy > 5) yy = -4.5;
        bAttr.setY(i, yy);
        bAttr.setX(i, bAttr.getX(i) + Math.sin(elapsed * 2 + i) * dt * 0.12);
      }
      bAttr.needsUpdate = true;

      // プランクトン: ゆるやかドリフト
      if (plankton) plankton.rotation.y = elapsed * 0.012;

      // コースティクス UV スクロール
      caustics.offset.x = (elapsed * 0.02) % 1;
      caustics.offset.y = (Math.sin(elapsed * 0.15) * 0.05);

      // god rays 揺らぎ
      for (let i = 0; i < rayMeshes.length; i++) {
        const m = rayMeshes[i];
        m.rotation.z = Math.sin(elapsed * 0.3 + i) * 0.12 + (i - 2) * 0.08;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.abs(Math.sin(elapsed * 0.4 + i)) * 0.08;
      }

      // カメラ アイドルドリフト
      camera.position.x = Math.sin(elapsed * 0.18) * 0.5;
      camera.position.y = 1.2 + Math.sin(elapsed * 0.13) * 0.25;
      camera.lookAt(0, 0.3, 0);

      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // ── Cleanup ───────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      clearFish();
      bodyGeo.dispose(); tailGeo.dispose(); dorsalGeo.dispose(); pecGeo.dispose(); eyeGeo.dispose();
      eyeMat.dispose();
      floorGeo.dispose(); floorMat.dispose(); caustics.dispose();
      bGeo.dispose(); bMat.dispose();
      plkGeo?.dispose(); plkMat?.dispose();
      rayGeo?.dispose(); rayMat?.dispose(); rayTex?.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      syncFishRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncFishRef.current?.(fishItems);
  }, [fishItems]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, #0e7490 0%, #075985 45%, #082f49 100%)',
      }}
    />
  );
}
