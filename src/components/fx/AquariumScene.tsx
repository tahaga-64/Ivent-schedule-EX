/**
 * AquariumScene v3 — リアル系 three.js 水中シーン
 *
 * v3 改善点:
 *  - 3段脊椎進行波: bodyGroup(0.06) → caudalPivot(0.18) → tailPivot(0.42)
 *    でリアルな S カーブ泳ぎを実現
 *  - 上下に開く二股月形尾びれ（lunate tail）: ファン角度が泳ぎに連動
 *  - MeshPhysicalMaterial: clearcoat + iridescence で「濡れた鱗」質感
 *  - 胸びれが Z + Y 2軸で3Dはばたき
 *  - 尾柄（peduncle）メッシュで体→尾の自然なつながり
 *  - 肛門びれ追加（腹側）
 *  - 目 + 瞳孔（別メッシュで立体感）
 *  - 腹側ハイライトメッシュ（背が濃く腹が明るい自然なグラデ）
 *  - 魚の大きさに反比例して尾びれ頻度を調整（小魚は速くはばたく）
 *  - 旋回量に応じてスピードアップ
 *  - 2レイヤーコースティクス（逆向きスクロール）
 *  - 海底岩礁 + 珊瑚デコレーション
 *  - アンダーライト（底からの反射光）の揺らぎ
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
  group: THREE.Group;
  bodyGroup: THREE.Group;
  caudalPivot: THREE.Group;
  tailPivot: THREE.Group;
  tailTopMesh: THREE.Mesh;
  tailBotMesh: THREE.Mesh;
  pecL: THREE.Mesh | null;
  pecR: THREE.Mesh | null;
  t: number;
  phase: number;
  wagFreq: number;
  baseSpeed: number;
  speed: number;
  ax: number; ay: number; az: number;
  px: number; py: number; pz: number;
  ly: number; lz: number;
  scale: number;
  prevPos: THREE.Vector3;
  heading: number;
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
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
    });

    // ── Scene / fog ───────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a4f73, isFull ? 0.040 : 0.056);

    // ── Lights ────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0xbfefff, 0x06324a, 0.9));
    scene.add(new THREE.AmbientLight(0x4fb8e6, 0.4));
    const sun = new THREE.DirectionalLight(0xdff6ff, 2.0);
    sun.position.set(-3, 12, 5);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.65);
    rim.position.set(5, 2, -7);
    scene.add(rim);
    // 底からの反射光（コースティクス演出）
    const underLight = new THREE.PointLight(0x4dd4ff, 0.85, 14);
    underLight.position.set(0, -2.2, 0);
    scene.add(underLight);

    // ── Camera ────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 1.2, 9.5);
    camera.lookAt(0, 0.3, 0);

    // ── Caustics canvas texture ───────────────────────────────
    function makeCausticsTexture(seed: number): THREE.CanvasTexture {
      const size = 512;
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = size;
      const ctx = cvs.getContext('2d')!;
      ctx.fillStyle = '#08506e';
      ctx.fillRect(0, 0, size, size);
      // seeded pseudo-random for reproducible but varied patterns
      const rng = (s: number) => { const v = Math.sin(s * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
      // Multi-scale voronoi-like blobs
      for (const [count, scale] of [[80, 0.13], [60, 0.07], [40, 0.04]] as [number, number][]) {
        for (let i = 0; i < count; i++) {
          const x = rng(i * 7.1) * size;
          const y = rng(i * 13.3 + 1) * size;
          const r = size * (scale * 0.5 + rng(i * 2.7) * scale);
          const a = 0.07 + rng(i * 4.1) * 0.20;
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(200,248,255,${a})`);
          g.addColorStop(0.5, `rgba(160,230,255,${a * 0.3})`);
          g.addColorStop(1, 'rgba(160,230,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x, y, r, r * 0.65, rng(i * 5.3) * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(cvs);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      return tex;
    }

    // ── Floor / seabed ────────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(60, 40);
    const caus1 = makeCausticsTexture(1.0);
    const caus2 = makeCausticsTexture(4.3);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b6080, roughness: 0.95, metalness: 0,
      map: caus1, transparent: true, opacity: 0.97,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3.2;
    scene.add(floor);

    // 2枚目コースティクス（逆スクロール・加算合成）
    const floor2Mat = new THREE.MeshBasicMaterial({
      map: caus2, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const floor2 = new THREE.Mesh(floorGeo, floor2Mat);
    floor2.rotation.copy(floor.rotation);
    floor2.position.set(0, -3.195, 0);
    scene.add(floor2);

    // ── 海底装飾: 岩 + 珊瑚 ─────────────────────────────────
    const decorMeshes: THREE.Mesh[] = [];
    const rockGeo = new THREE.SphereGeometry(1, 7, 5);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a6b8a, roughness: 0.92 });
    const coralGeo = new THREE.CylinderGeometry(0.06, 0.18, 1.4, 6);
    const coralMat = new THREE.MeshStandardMaterial({ color: 0xff6b8a, roughness: 0.55 });

    for (const [x, z, sx, sy, sz] of [
      [-7, -2.5, 2.0, 0.65, 1.5], [7.5, -1.5, 1.6, 0.55, 1.2],
      [-3, 3, 1.2, 0.75, 1.0], [5.5, 3, 1.4, 0.50, 1.1],
      [1, -3.5, 1.1, 0.6, 0.9],
    ] as [number, number, number, number, number][]) {
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, -3.2 + sy * 0.5, z);
      scene.add(m);
      decorMeshes.push(m);
    }
    if (isFull) {
      for (const [x, z, h] of [[-5, -1.2, 1.5], [3.5, -2, 1.1], [-2, 3.5, 1.8], [6.5, 0.5, 1.0]] as [number, number, number][]) {
        for (let i = 0; i < 4; i++) {
          const m = new THREE.Mesh(coralGeo, coralMat);
          m.scale.y = h * (0.6 + Math.random() * 0.6);
          m.position.set(x + (Math.random() - 0.5) * 0.7, -3.2 + m.scale.y * 0.7, z + (Math.random() - 0.5) * 0.5);
          scene.add(m);
          decorMeshes.push(m);
        }
      }
    }

    // ── God rays ──────────────────────────────────────────────
    const rayMeshes: THREE.Mesh[] = [];
    let rayTex: THREE.CanvasTexture | null = null;
    let rayGeo: THREE.PlaneGeometry | null = null;
    let rayMat: THREE.MeshBasicMaterial | null = null;
    if (isFull) {
      const rc = document.createElement('canvas');
      rc.width = 64; rc.height = 256;
      const rctx = rc.getContext('2d')!;
      const grad = rctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, 'rgba(220,248,255,0.65)');
      grad.addColorStop(0.55, 'rgba(180,235,255,0.18)');
      grad.addColorStop(1, 'rgba(180,235,255,0)');
      rctx.fillStyle = grad;
      rctx.fillRect(0, 0, 64, 256);
      rayTex = new THREE.CanvasTexture(rc);
      rayGeo = new THREE.PlaneGeometry(1.4, 13);
      rayMat = new THREE.MeshBasicMaterial({
        map: rayTex, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(rayGeo, rayMat);
        m.position.set(-6 + i * 2.5 + Math.random() * 0.5, 3.8, -3 - Math.random() * 3);
        m.rotation.z = (Math.random() - 0.5) * 0.45;
        scene.add(m);
        rayMeshes.push(m);
      }
    }

    // ── Plankton ──────────────────────────────────────────────
    const PLK = isFull ? 280 : 80;
    const plkPos = new Float32Array(PLK * 3);
    for (let i = 0; i < PLK; i++) {
      plkPos[i * 3] = (Math.random() - 0.5) * 24;
      plkPos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      plkPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const plkGeo = new THREE.BufferGeometry();
    plkGeo.setAttribute('position', new THREE.BufferAttribute(plkPos, 3));
    const plkMat = new THREE.PointsMaterial({ size: 0.03, color: 0xcdeffd, transparent: true, opacity: 0.5, depthWrite: false });
    const plankton = new THREE.Points(plkGeo, plkMat);
    scene.add(plankton);

    // ── Bubbles ───────────────────────────────────────────────
    const BUB = isFull ? 80 : 35;
    const bPos = new Float32Array(BUB * 3);
    const bSpeed = new Float32Array(BUB);
    const bPhase = new Float32Array(BUB);
    for (let i = 0; i < BUB; i++) {
      bPos[i * 3] = (Math.random() - 0.5) * 20;
      bPos[i * 3 + 1] = (Math.random() - 0.5) * 9 - 2;
      bPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      bSpeed[i] = 0.38 + Math.random() * 0.75;
      bPhase[i] = Math.random() * Math.PI * 2;
    }
    const bGeo = new THREE.BufferGeometry();
    const bAttr = new THREE.BufferAttribute(bPos, 3);
    bGeo.setAttribute('position', bAttr);
    const bMat = new THREE.PointsMaterial({
      size: 0.11, color: 0xeafdff, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const bubbles = new THREE.Points(bGeo, bMat);
    scene.add(bubbles);

    // ── 共有魚ジオメトリ ──────────────────────────────────────
    // ボディ: より魚らしく長い楕円体
    const bodyGeo = new THREE.SphereGeometry(0.5, 20, 14);
    bodyGeo.scale(1.7, 0.58, 0.35);

    // 尾柄（peduncle）: ボディと尾の間の細い部分
    const peduncleGeo = new THREE.SphereGeometry(0.2, 8, 6);
    peduncleGeo.scale(0.55, 0.38, 0.22);

    // 尾びれローブ: 月形（lunate）尾びれの片ヒレ
    const tailLobeGeo = new THREE.ConeGeometry(0.28, 0.55, 7);
    tailLobeGeo.scale(0.6, 1, 0.13);
    tailLobeGeo.rotateZ(-Math.PI / 2);
    tailLobeGeo.translate(-0.22, 0, 0);

    // 背びれ
    const dorsalGeo = new THREE.ConeGeometry(0.22, 0.45, 5);
    dorsalGeo.scale(1.2, 1, 0.09);
    dorsalGeo.translate(0.12, 0.40, 0);

    // 胸びれ
    const pecGeo = new THREE.ConeGeometry(0.15, 0.36, 5);
    pecGeo.scale(1.1, 1, 0.08);

    // 肛門びれ（腹側）
    const analGeo = new THREE.ConeGeometry(0.13, 0.30, 4);
    analGeo.scale(1, 1, 0.09);
    analGeo.translate(-0.22, -0.30, 0);

    // 目（白目）+ 瞳孔
    const eyeGeo = new THREE.SphereGeometry(0.068, 10, 10);
    const pupilGeo = new THREE.SphereGeometry(0.042, 8, 8);
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.1, metalness: 0.08 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x040408, roughness: 0.0, metalness: 0.5 });

    const fishStates: FishState[] = [];
    let matPool: THREE.Material[] = [];

    function makeFish(color: number, scale: number): FishState {
      const fishColor = new THREE.Color(color);
      const bellyColor = fishColor.clone().lerp(new THREE.Color(0xffffff), 0.62);
      const finColor = fishColor.clone().lerp(new THREE.Color(0xffffff), 0.28);

      const bodyMat = isFull
        ? new THREE.MeshPhysicalMaterial({
            color: fishColor,
            roughness: 0.26,
            metalness: 0.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.10,
            iridescence: 0.50,
            iridescenceIOR: 1.45,
            iridescenceThicknessRange: [100, 480] as [number, number],
            sheen: 0.3,
            sheenRoughness: 0.45,
            sheenColor: finColor,
          })
        : new THREE.MeshLambertMaterial({ color: fishColor });

      const finMat = isFull
        ? new THREE.MeshPhysicalMaterial({
            color: finColor,
            roughness: 0.38,
            metalness: 0.0,
            clearcoat: 0.55,
            clearcoatRoughness: 0.22,
            transparent: true,
            opacity: 0.82,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshLambertMaterial({ color: finColor, side: THREE.DoubleSide });

      // 腹側ハイライトマテリアル（半透明で重ねて腹を明るく）
      const bellyMat = isFull
        ? new THREE.MeshPhysicalMaterial({
            color: bellyColor,
            roughness: 0.38,
            metalness: 0.0,
            clearcoat: 0.6,
            clearcoatRoughness: 0.20,
            transparent: true,
            opacity: 0.62,
          })
        : null;

      matPool.push(bodyMat, finMat);
      if (bellyMat) matPool.push(bellyMat);

      // ─── 魚の骨格階層 ───────────────────────────────────────
      // group (ワールド位置・全体向き)
      //   bodyGroup (体幹うねり: 小)
      //     bodyMesh + bellyMesh + dorsalFin + analFin
      //     pecL, pecR (はばたく)
      //     eyeL, eyeR (目)
      //     caudalPivot (x=-0.68: 中程度のうねり)
      //       peduncle mesh
      //       tailPivot (x=-0.55: 大きなうねり)
      //         tailTopMesh, tailBotMesh (二股尾びれ)

      const group = new THREE.Group();
      group.scale.setScalar(scale);

      const bodyGroup = new THREE.Group();
      group.add(bodyGroup);

      // ボディ本体
      bodyGroup.add(new THREE.Mesh(bodyGeo, bodyMat));

      // 腹側ハイライト
      if (bellyMat) {
        const belly = new THREE.Mesh(bodyGeo, bellyMat);
        belly.scale.set(0.97, 0.48, 1.06);
        belly.position.y = -0.15;
        bodyGroup.add(belly);
      }

      // 背びれ・肛門びれ
      bodyGroup.add(new THREE.Mesh(dorsalGeo, finMat));
      if (isFull) bodyGroup.add(new THREE.Mesh(analGeo, finMat));

      // 胸びれ（両側）
      let pecL: THREE.Mesh | null = null;
      let pecR: THREE.Mesh | null = null;
      if (isFull) {
        pecL = new THREE.Mesh(pecGeo, finMat);
        pecL.position.set(0.05, -0.11, 0.21);
        pecL.rotation.set(0.65, 0.2, -0.72);
        pecR = new THREE.Mesh(pecGeo, finMat);
        pecR.position.set(0.05, -0.11, -0.21);
        pecR.rotation.set(-0.65, -0.2, -0.72);
        bodyGroup.add(pecL, pecR);
      }

      // 目 + 瞳孔
      if (isFull) {
        for (const side of [1, -1] as const) {
          const eye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
          eye.position.set(0.60, 0.10, side * 0.155);
          const pupil = new THREE.Mesh(pupilGeo, pupilMat);
          pupil.position.set(0.035, 0, side * 0.026);
          eye.add(pupil);
          bodyGroup.add(eye);
        }
      }

      // 尾柄ピボット（胴体レベル: 中程度うねり）
      const caudalPivot = new THREE.Group();
      caudalPivot.position.x = -0.68;
      bodyGroup.add(caudalPivot);

      // 尾柄メッシュ
      const peduncle = new THREE.Mesh(peduncleGeo, bodyMat);
      peduncle.position.x = -0.14;
      caudalPivot.add(peduncle);

      // テールピボット（最大うねり）
      const tailPivot = new THREE.Group();
      tailPivot.position.x = -0.54;
      caudalPivot.add(tailPivot);

      // 二股尾びれ（上ローブ + 下ローブ）
      const tailTopMesh = new THREE.Mesh(tailLobeGeo, finMat);
      tailTopMesh.position.y = 0.17;
      tailTopMesh.rotation.z = -0.30;
      const tailBotMesh = new THREE.Mesh(tailLobeGeo, finMat);
      tailBotMesh.position.y = -0.17;
      tailBotMesh.rotation.z = 0.30;
      tailPivot.add(tailTopMesh, tailBotMesh);

      // 小さい魚ほど速く尾びれを振る
      const wagFreq = 5.5 + (1.2 / Math.max(scale, 0.5)) * 1.8;

      const initX = Math.random() * Math.PI * 2;
      return {
        group, bodyGroup, caudalPivot, tailPivot,
        tailTopMesh, tailBotMesh, pecL, pecR,
        t: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        wagFreq,
        baseSpeed: 0.26 + Math.random() * 0.30,
        speed: 0.3,
        ax: 5.0 + Math.random() * 2.5,
        ay: 0.48 + Math.random() * 0.56,
        az: 0.48 + Math.random() * 0.65,
        px: initX,
        py: Math.random() * Math.PI * 2,
        pz: Math.random() * Math.PI * 2,
        ly: 0, lz: 0, scale,
        prevPos: new THREE.Vector3(Math.sin(initX) * (5 + Math.random() * 2.5), 0, 0),
        heading: 0,
      };
    }

    function clearFish() {
      for (const fs of fishStates) scene.remove(fs.group);
      fishStates.length = 0;
      for (const m of matPool) m.dispose();
      matPool = [];
    }

    function spawnFish(color: number, ly: number, lz: number, scale: number) {
      const fs = makeFish(color, scale);
      fs.ly = ly; fs.lz = lz;
      fs.prevPos.set(fs.prevPos.x, ly, lz);
      fs.group.position.copy(fs.prevPos);
      scene.add(fs.group);
      fishStates.push(fs);
    }

    function syncFish(items: FishItem[]) {
      clearFish();
      const maxFish = isFull ? MAX_FISH_FULL : MAX_FISH_LITE;

      const speciesCount = new Map<string, number>();
      for (const item of items) speciesCount.set(item.name, (speciesCount.get(item.name) ?? 0) + (item.count || 1));
      const speciesNames = [...speciesCount.keys()];
      let total = 0;

      for (let si = 0; si < speciesNames.length && total < maxFish; si++) {
        const count = speciesCount.get(speciesNames[si]) ?? 1;
        const color = FISH_COLORS[si % FISH_COLORS.length];
        const cap = Math.max(1, Math.min(count, Math.ceil(maxFish / speciesNames.length)));
        const laneY = -1.4 + (si / Math.max(speciesNames.length - 1, 1)) * 2.8;
        const laneZ = -1.8 + (si % 3) * 1.6;
        for (let j = 0; j < cap && total < maxFish; j++) {
          spawnFish(color, laneY + (Math.random() - 0.5) * 0.75, laneZ + (Math.random() - 0.5) * 0.9, 0.62 + Math.random() * 0.58);
          total++;
        }
      }

      if (fishStates.length === 0) {
        for (let i = 0; i < 4; i++) {
          spawnFish(FISH_COLORS[i % FISH_COLORS.length], (i - 1.5) * 1.1, (i % 2 === 0 ? -1 : 1) * 1.2, 0.82 + Math.random() * 0.38);
        }
      }
    }

    syncFishRef.current = syncFish;
    syncFish(fishItemsRef.current);

    // ── Animation loop ────────────────────────────────────────
    let prevTime = performance.now();
    let rafId = 0;
    let elapsed = 0;
    const tmpVec = new THREE.Vector3();

    function animate() {
      rafId = requestAnimationFrame(animate);
      if (!activeRef.current || document.hidden) { prevTime = performance.now(); return; }

      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      elapsed += dt;

      for (const fs of fishStates) {
        fs.t += dt * fs.speed;

        // Lissajous 軌道
        const x = Math.sin(fs.t + fs.px) * fs.ax;
        const y = fs.ly + Math.sin(fs.t * 0.58 + fs.py) * fs.ay;
        const z = fs.lz + Math.sin(fs.t * 0.41 + fs.pz) * fs.az;
        tmpVec.set(x, y, z);

        // 進行方向
        const vx = x - fs.prevPos.x;
        const vy = y - fs.prevPos.y;
        const targetHeading = Math.atan2(-(z - fs.prevPos.z), vx);

        // 向き補間（急旋回を抑制）
        let dh = targetHeading - fs.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        fs.heading += dh * Math.min(1, dt * 5.0);

        fs.group.position.copy(tmpVec);
        fs.group.rotation.y = fs.heading;
        // ピッチ（上下速度に連動して頭を上げ下げ）
        fs.group.rotation.z = THREE.MathUtils.clamp(vy * 5.5, -0.44, 0.44);
        // バンク（旋回でロール）
        fs.group.rotation.x = THREE.MathUtils.clamp(-dh * 3.0, -0.70, 0.70);

        // ── 3段脊椎進行波 ─────────────────────────────────
        const wag = Math.sin(fs.t * fs.wagFreq + fs.phase);

        // Stage 1: 体幹（最小うねり）
        fs.bodyGroup.rotation.y = wag * 0.055;

        // Stage 2: 尾柄ピボット（中程度 + 位相遅延 0.55 rad）
        fs.caudalPivot.rotation.y = Math.sin(fs.t * fs.wagFreq + fs.phase + 0.55) * 0.17;

        // Stage 3: テールピボット（最大 + 位相遅延 1.1 rad）
        fs.tailPivot.rotation.y = Math.sin(fs.t * fs.wagFreq + fs.phase + 1.1) * 0.44;

        // 尾びれファン: うねりが大きいときに上下に開く
        const fanAngle = 0.28 + Math.abs(Math.sin(fs.t * fs.wagFreq * 2.0 + fs.phase)) * 0.18;
        fs.tailTopMesh.rotation.z = -fanAngle;
        fs.tailBotMesh.rotation.z = fanAngle;

        // 胸びれ 3D はばたき（Z + Y 2軸）
        if (fs.pecL && fs.pecR) {
          const flap = Math.sin(fs.t * fs.wagFreq * 0.72 + fs.phase) * 0.30;
          fs.pecL.rotation.z = -0.58 + flap;
          fs.pecR.rotation.z = -0.58 - flap;
          fs.pecL.rotation.y = 0.22 + flap * 0.45;
          fs.pecR.rotation.y = -0.22 - flap * 0.45;
        }

        // 旋回時スピードアップ
        const turnRate = Math.abs(dh) / (dt + 0.001);
        fs.speed = fs.baseSpeed + Math.min(turnRate * 0.07, 0.22);

        fs.prevPos.copy(tmpVec);
      }

      // ── 泡の上昇 + 横揺れ ─────────────────────────────────
      for (let i = 0; i < BUB; i++) {
        let yy = bAttr.getY(i) + dt * bSpeed[i];
        if (yy > 5.5) yy = -4.5;
        bAttr.setY(i, yy);
        bAttr.setX(i, bAttr.getX(i) + Math.sin(elapsed * 1.85 + bPhase[i]) * dt * 0.14);
      }
      bAttr.needsUpdate = true;

      // ── プランクトンドリフト ──────────────────────────────
      plankton.rotation.y = elapsed * 0.010;
      plankton.rotation.x = Math.sin(elapsed * 0.045) * 0.018;

      // ── コースティクス 2レイヤースクロール ───────────────
      caus1.offset.x = (elapsed * 0.021) % 1;
      caus1.offset.y = Math.sin(elapsed * 0.12) * 0.055;
      caus2.offset.x = (-elapsed * 0.014) % 1;
      caus2.offset.y = (-Math.sin(elapsed * 0.16) * 0.055);

      // ── アンダーライト（底からの反射光）揺らぎ ─────────
      underLight.intensity = 0.65 + Math.sin(elapsed * 1.15) * 0.22;
      underLight.position.x = Math.sin(elapsed * 0.48) * 2.2;

      // ── God rays 揺らぎ ───────────────────────────────────
      for (let i = 0; i < rayMeshes.length; i++) {
        const m = rayMeshes[i];
        m.rotation.z = Math.sin(elapsed * 0.27 + i * 1.05) * 0.15 + (i - 2.5) * 0.09;
        (m.material as THREE.MeshBasicMaterial).opacity = 0.10 + Math.abs(Math.sin(elapsed * 0.33 + i * 0.65)) * 0.09;
      }

      // ── カメラ アイドルドリフト ───────────────────────────
      camera.position.x = Math.sin(elapsed * 0.17) * 0.55;
      camera.position.y = 1.2 + Math.sin(elapsed * 0.12) * 0.28;
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
      bodyGeo.dispose(); peduncleGeo.dispose(); tailLobeGeo.dispose();
      dorsalGeo.dispose(); pecGeo.dispose(); analGeo.dispose();
      eyeGeo.dispose(); pupilGeo.dispose();
      eyeWhiteMat.dispose(); pupilMat.dispose();
      floorGeo.dispose(); floorMat.dispose(); floor2Mat.dispose();
      caus1.dispose(); caus2.dispose();
      rockGeo.dispose(); rockMat.dispose();
      coralGeo.dispose(); coralMat.dispose();
      plkGeo.dispose(); plkMat.dispose();
      bGeo.dispose(); bMat.dispose();
      rayTex?.dispose(); rayGeo?.dispose(); rayMat?.dispose();
      for (const m of decorMeshes) scene.remove(m);
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
