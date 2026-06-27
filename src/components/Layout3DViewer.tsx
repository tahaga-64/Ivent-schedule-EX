/**
 * Layout3DViewer — フロアレイアウトの3D再現ビュー
 *
 * 【スケール】1 world unit ≈ 0.5m（壁の高さ 5 units = 2.5m）
 * 【操作】ドラッグで360度回転 / ピンチ・ホイールでズーム
 *
 * アイテムごとに現実のイベント備品を模した専用モデルを構築する:
 * - 丸机/長机/着座SP: 白天板の会議テーブル + スチール脚
 * - 水槽: 黒キャビネット台 + ガラス水槽（大人がしゃがんで見る高さ ≈ 1.25m）
 * - 体験水槽: 床置きの低いタッチプール（ドクターフィッシュ等）
 * - 砂場: 木枠 + 砂
 * - ヨーヨー・SB: プラスチック製の丸プール + カラフルなボール
 * - 柱: 建造物の構造柱（少し大きめ・天井高）
 * - 景品お渡し: 長机 + ノベルティ/ティッシュ箱
 * - 仕切り: 大人が背伸びで覗ける高さ（≈1.8m）の薄いパネル
 * - 入口: 3Dでは何も描画しない
 * - カスタム: デフォルトの色付きボックス
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { LayoutItemData, CustomCatalogItem } from './LayoutView';

/** 高品質モード（PC/大画面のみ透過ガラス等の重い表現を有効化。モバイルは反射のみで軽量化） */
const HIGH_QUALITY = typeof window !== 'undefined' && window.innerWidth >= 820;

interface Props {
  items: LayoutItemData[];
  customItems: CustomCatalogItem[];
}

// ─── 共通定数（world units） ──────────────────────────────────────────────
const TABLE_H = 1.4;      // 机の高さ ≈ 0.7m
const TOP_T = 0.12;       // 天板の厚み
const WALL_H = 5;         // 壁 ≈ 2.5m

const COLOR = {
  tableTop: 0xf8fafc,
  tableLeg: 0x64748b,
  tankStand: 0x1e293b,
  glass: 0xbfdbfe,
  water: 0x38bdf8,
  waterDeep: 0x0ea5e9,
  woodFrame: 0xa07855,
  sand: 0xeed9a4,
  poolPlastic: 0x3b82f6,
  poolRim: 0xdbeafe,
  pillar: 0xd6dde6,
  partition: 0x94a3b8,
  fishOrange: 0xfb923c,
};

const BALL_COLORS = [0xef4444, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xec4899, 0x8b5cf6];

function lambert(color: number, opts: { transparent?: boolean; opacity?: number } = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function standard(
  color: number,
  opts: { transparent?: boolean; opacity?: number; roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number; envMapIntensity?: number } = {},
) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08, envMapIntensity: 1.0, ...opts });
}

/** ガラス（高品質: 物理ベースの透過＋クリアコート / 軽量: 環境反射する半透明） */
function glassMaterial(): THREE.Material {
  if (HIGH_QUALITY) {
    return new THREE.MeshPhysicalMaterial({
      color: 0xecf7ff, metalness: 0, roughness: 0.04,
      transmission: 1, thickness: 0.6, ior: 1.5,
      transparent: true, opacity: 1,
      clearcoat: 1, clearcoatRoughness: 0.04,
      envMapIntensity: 1.5,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0xbfdbfe, transparent: true, opacity: 0.24,
    roughness: 0.05, metalness: 0.1, envMapIntensity: 1.6,
  });
}

/** 水（高品質: 透過＋屈折＋クリアコート / 軽量: 光沢のある半透明） */
function waterMaterial(deep = true): THREE.Material {
  const color = deep ? 0x0ea5e9 : 0x38bdf8;
  if (HIGH_QUALITY) {
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: 0.08,
      transmission: 0.55, thickness: 1.4, ior: 1.33,
      transparent: true, opacity: 0.92,
      clearcoat: 0.7, clearcoatRoughness: 0.08,
      emissive: 0x0369a1, emissiveIntensity: 0.08,
      envMapIntensity: 1.3,
    });
  }
  return new THREE.MeshStandardMaterial({
    color, transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.05,
    emissive: 0x0369a1, emissiveIntensity: 0.12, envMapIntensity: 1.2,
  });
}

function addMesh(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ─── アイテム別モデルビルダー ──────────────────────────────────────────────

/** 長机（白天板の会議テーブル + スチール脚）。着座SPも同一デザイン */
function buildLongTable(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  addMesh(g, new THREE.BoxGeometry(w, TOP_T, d), standard(COLOR.tableTop, { roughness: 0.35 }), 0, TABLE_H - TOP_T / 2, 0);
  const legGeo = new THREE.BoxGeometry(0.12, TABLE_H - TOP_T, 0.12);
  const legMat = standard(COLOR.tableLeg, { metalness: 0.35, roughness: 0.4 });
  const lx = Math.max(0.2, w / 2 - 0.25);
  const lz = Math.max(0.15, d / 2 - 0.2);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    addMesh(g, legGeo, legMat, sx * lx, (TABLE_H - TOP_T) / 2, sz * lz);
  }
  return g;
}

/** 丸机（白い円天板 + 中央ペデスタル脚） */
function buildRoundTable(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const r = Math.min(w, d) / 2;
  addMesh(g, new THREE.CylinderGeometry(r, r, TOP_T, 48), standard(COLOR.tableTop, { roughness: 0.32 }), 0, TABLE_H - TOP_T / 2, 0);
  addMesh(g, new THREE.CylinderGeometry(0.12, 0.16, TABLE_H - TOP_T, 24), standard(COLOR.tableLeg, { metalness: 0.4 }), 0, (TABLE_H - TOP_T) / 2, 0);
  addMesh(g, new THREE.CylinderGeometry(r * 0.45, r * 0.5, 0.08, 32), standard(COLOR.tableLeg, { metalness: 0.35 }), 0, 0.04, 0);
  return g;
}

/** 水槽（黒キャビネット台 + ガラス水槽。総高さ ≈ 1.25m = しゃがんで観賞） */
function buildFishTank(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const standH = 1.3;
  const tankH = 1.2;
  // 台（キャビネット）
  addMesh(g, new THREE.BoxGeometry(w, standH, d), standard(COLOR.tankStand, { roughness: 0.45 }), 0, standH / 2, 0);
  // ガラス
  addMesh(
    g, new THREE.BoxGeometry(w * 0.96, tankH, d * 0.9),
    glassMaterial(),
    0, standH + tankH / 2, 0,
  );
  // 水
  addMesh(
    g, new THREE.BoxGeometry(w * 0.9, tankH * 0.72, d * 0.82),
    waterMaterial(true),
    0, standH + tankH * 0.4, 0,
  );
  // 上部フレーム
  addMesh(g, new THREE.BoxGeometry(w * 0.98, 0.08, d * 0.92), lambert(COLOR.tankStand), 0, standH + tankH + 0.04, 0);
  return g;
}

/** 体験水槽（床置きの低いタッチプール。中にドクターフィッシュ） */
function buildTouchTank(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const tankH = 0.8;
  addMesh(
    g, new THREE.BoxGeometry(w, tankH, d),
    glassMaterial(),
    0, tankH / 2, 0,
  );
  addMesh(
    g, new THREE.BoxGeometry(w * 0.94, 0.5, d * 0.94),
    waterMaterial(false),
    0, 0.3, 0,
  );
  addMesh(g, new THREE.BoxGeometry(w * 1.02, 0.07, d * 1.02), lambert(COLOR.tankStand), 0, tankH + 0.035, 0);
  // 小さな魚（ドクターフィッシュ）
  const fishGeo = new THREE.SphereGeometry(0.09, 10, 10);
  const fishMat = lambert(COLOR.fishOrange);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.399;
    const fish = addMesh(g, fishGeo, fishMat, Math.cos(a) * w * 0.28, 0.45, Math.sin(a) * d * 0.28);
    fish.scale.set(1.7, 0.7, 0.7);
    fish.rotation.y = a;
  }
  return g;
}

/** 砂場（木枠 + 砂） */
function buildSandbox(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const frameH = 0.5;
  const t = 0.35; // 枠の太さ
  const frameMat = lambert(COLOR.woodFrame);
  addMesh(g, new THREE.BoxGeometry(w, frameH, t), frameMat, 0, frameH / 2, -(d - t) / 2);
  addMesh(g, new THREE.BoxGeometry(w, frameH, t), frameMat, 0, frameH / 2, (d - t) / 2);
  addMesh(g, new THREE.BoxGeometry(t, frameH, d - t * 2), frameMat, -(w - t) / 2, frameH / 2, 0);
  addMesh(g, new THREE.BoxGeometry(t, frameH, d - t * 2), frameMat, (w - t) / 2, frameH / 2, 0);
  addMesh(g, new THREE.BoxGeometry(w - t * 2, 0.3, d - t * 2), lambert(COLOR.sand), 0, 0.18, 0);
  return g;
}

/** ヨーヨー・スーパーボールすくい（プラスチック製の丸プール + カラフルボール） */
function buildPool(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const wallH = 0.9;
  // プール本体（楕円にスケール）
  const pool = addMesh(g, new THREE.CylinderGeometry(0.5, 0.46, wallH, 32), lambert(COLOR.poolPlastic), 0, wallH / 2, 0);
  pool.scale.set(w, 1, d);
  // 白いリム
  const rim = addMesh(g, new THREE.TorusGeometry(0.49, 0.05, 10, 32), lambert(COLOR.poolRim), 0, wallH, 0);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(w, d, 1);
  // 水面
  const water = addMesh(
    g, new THREE.CylinderGeometry(0.44, 0.44, 0.05, 32),
    waterMaterial(false),
    0, wallH - 0.18, 0,
  );
  water.scale.set(w, 1, d);
  // 浮かぶヨーヨー・スーパーボール
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399; // 黄金角で均等散布（再レンダリングでも安定）
    const rr = 0.34 * Math.sqrt((i + 1) / 10);
    addMesh(
      g, new THREE.SphereGeometry(i % 3 === 0 ? 0.13 : 0.1, 12, 12),
      lambert(BALL_COLORS[i % BALL_COLORS.length]),
      Math.cos(a) * rr * w, wallH - 0.1, Math.sin(a) * rr * d,
    );
  }
  return g;
}

/** 柱（建造物の構造柱。少し大きめ・壁より高い） */
function buildPillar(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = WALL_H + 1.5;
  const pw = w * 1.3;
  const pd = d * 1.3;
  addMesh(g, new THREE.BoxGeometry(pw, h, pd), lambert(COLOR.pillar), 0, h / 2, 0);
  // 巾木（下部の濃い帯）
  addMesh(g, new THREE.BoxGeometry(pw * 1.06, 0.5, pd * 1.06), lambert(0x94a3b8), 0, 0.25, 0);
  return g;
}

/** 景品お渡し（長机 + ノベルティ・ティッシュ箱） */
function buildPrizeDesk(w: number, d: number): THREE.Group {
  const g = buildLongTable(w, d);
  const topY = TABLE_H;
  // ティッシュ箱（白）
  const tissueGeo = new THREE.BoxGeometry(0.55, 0.22, 0.3);
  const tissueMat = lambert(0xffffff);
  addMesh(g, tissueGeo, tissueMat, -w * 0.28, topY + 0.11, -d * 0.12);
  addMesh(g, tissueGeo, tissueMat, -w * 0.28, topY + 0.33, -d * 0.12);
  // ノベルティ（カラフルな箱）
  const giftColors = [0xf472b6, 0xfbbf24, 0x818cf8];
  giftColors.forEach((c, i) => {
    addMesh(g, new THREE.BoxGeometry(0.32, 0.32, 0.32), lambert(c), w * (0.05 + i * 0.16), topY + 0.16, d * 0.1 * (i % 2 === 0 ? 1 : -1));
  });
  return g;
}

/** 仕切り（大人が背伸びで覗ける高さ ≈ 1.8m。かなり薄いパネル） */
function buildPartition(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const h = 3.6;
  const t = Math.min(Math.max(d, 0.12), 0.3);
  addMesh(g, new THREE.BoxGeometry(w, h, t), lambert(COLOR.partition), 0, h / 2, 0);
  // 足（転倒防止ベース）
  const footGeo = new THREE.BoxGeometry(0.15, 0.1, 1.0);
  const footMat = lambert(0x475569);
  addMesh(g, footGeo, footMat, -w * 0.4, 0.05, 0);
  addMesh(g, footGeo, footMat, w * 0.4, 0.05, 0);
  return g;
}

/** カスタムアイテム（デフォルトの色付きボックス） */
function buildDefaultBox(w: number, d: number, colorHex: string): THREE.Group {
  const g = new THREE.Group();
  const h = 1.0;
  const c = new THREE.Color(colorHex || '#6366f1');
  addMesh(g, new THREE.BoxGeometry(w, h, d), lambert(c.getHex()), 0, h / 2, 0);
  return g;
}

/** type → { モデル, ラベルを置く高さ }。入口は null（3Dでは描画しない） */
function buildItem(item: LayoutItemData): { group: THREE.Group; height: number } | null {
  const w = Math.max(0.5, (item.wPct / 100) * 48);
  const d = Math.max(0.5, (item.hPct / 100) * 48);
  switch (item.type) {
    case 'entrance':    return null;
    case 'round_table': return { group: buildRoundTable(w, d), height: TABLE_H };
    case 'long_table':
    case 'seating':     return { group: buildLongTable(w, d), height: TABLE_H };
    case 'fish_tank':   return { group: buildFishTank(w, d), height: 2.6 };
    case 'touch_tank':  return { group: buildTouchTank(w, d), height: 0.9 };
    case 'sandbox':     return { group: buildSandbox(w, d), height: 0.5 };
    case 'yoyo':        return { group: buildPool(w, d), height: 0.9 };
    case 'pillar':      return { group: buildPillar(w, d), height: WALL_H + 1.5 };
    case 'prize_desk':  return { group: buildPrizeDesk(w, d), height: TABLE_H + 0.6 };
    case 'partition':   return { group: buildPartition(w, d), height: 3.6 };
    default:            return { group: buildDefaultBox(w, d, item.color), height: 1.0 };
  }
}

// ─── ラベルスプライト ─────────────────────────────────────────────────────
function makeLabelSprite(text: string): THREE.Sprite {
  const measure = document.createElement('canvas').getContext('2d')!;
  const fontSize = 52;
  measure.font = `900 ${fontSize}px sans-serif`;
  const tw = Math.ceil(measure.measureText(text).width);
  const cw = tw + 44;
  const ch = 72;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const r = 22;
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(cw, 0, cw, ch, r);
  ctx.arcTo(cw, ch, 0, ch, r);
  ctx.arcTo(0, ch, 0, 0, r);
  ctx.arcTo(0, 0, cw, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cw / 2, ch / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  const s = 0.018;
  sprite.scale.set(cw * s, ch * s, 1);
  return sprite;
}

// ─── メインコンポーネント ─────────────────────────────────────────────────
export default function Layout3DViewer({ items }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    rotX: 0.5,   // 初期チルト
    rotY: 0.6,
    zoom: 1,
    pinchDist: 0,
  });

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    // ─── Scene setup ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0xdce5ee);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdce5ee, 85, 165);

    // ─── 環境マップ（IBL）— ガラス/水/金属にリアルな反射を与える ──────────────
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 280);

    // ─── Lighting（IBL を主体に、直接光で陰影とハイライトを補強） ─────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa3b8, 0.45));
    const sun = new THREE.DirectionalLight(0xfff7ed, 1.25);
    sun.position.set(14, 28, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.02;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.radius = 4; // 影のエッジを柔らかく
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7d2fe, 0.45);
    fill.position.set(-10, 12, -8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.55);
    rim.position.set(0, 8, -18);
    scene.add(rim);

    // ─── Floor（環境反射でわずかに磨きのあるタイル床） ───────────────────────
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 52),
      standard(0xe7ecf2, { roughness: 0.62, metalness: 0.12, envMapIntensity: 0.7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(52, 26, 0xc3cfdd, 0xd5dde8));

    // ─── 会場の壁（薄い半透明） ──────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xbcc8d6,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.02,
    });
    ([
      { pos: [0, WALL_H / 2, -25], rot: [0, 0, 0] },
      { pos: [0, WALL_H / 2, 25], rot: [0, Math.PI, 0] },
      { pos: [-25, WALL_H / 2, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [25, WALL_H / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ] as { pos: [number, number, number]; rot: [number, number, number] }[]).forEach(({ pos, rot }) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(50, WALL_H), wallMat);
      wall.position.set(...pos);
      wall.rotation.set(...rot);
      scene.add(wall);
    });

    // ─── アイテム配置 ─────────────────────────────────────────────────────
    // 2Dキャンバスの 0–100% を world の -24..+24 にマップ
    const toWorld = (pct: number, range = 48) => (pct / 100) * range - range / 2;

    items.forEach(item => {
      const built = buildItem(item);
      if (!built) return; // 入口は3Dでは描画しない
      const { group, height } = built;
      group.position.set(toWorld(item.x), 0, toWorld(item.y));
      group.rotation.y = -(item.rotation * Math.PI) / 180;
      scene.add(group);

      // 名前ラベル（回転の影響を受けないようシーン直下に配置）
      const label = makeLabelSprite(item.label);
      label.position.set(toWorld(item.x), height + 0.95, toWorld(item.y));
      scene.add(label);
    });

    // ─── カメラ操作（原点を中心に回転） ────────────────────────────────────
    function updateCamera() {
      const s = stateRef.current;
      const radius = 36 / s.zoom;
      camera.position.x = radius * Math.sin(s.rotY) * Math.cos(s.rotX);
      camera.position.y = radius * Math.sin(s.rotX) + 4;
      camera.position.z = radius * Math.cos(s.rotY) * Math.cos(s.rotX);
      // 縦方向に1回転（360°）しても上下が破綻しないよう、極を越えたら up を反転
      camera.up.set(0, Math.cos(s.rotX) >= 0 ? 1 : -1, 0);
      camera.lookAt(0, 1.5, 0);
    }
    updateCamera();

    // ─── Resize ───────────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);
    renderer.setSize(container.clientWidth, Math.max(1, container.clientHeight));
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();

    // ─── Render loop ──────────────────────────────────────────────────────
    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // ─── Mouse / Touch interaction ────────────────────────────────────────
    const el = renderer.domElement;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      stateRef.current.isDragging = true;
      const p = 'touches' in e ? e.touches[0] : e;
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
    }

    function onPointerMove(e: MouseEvent | TouchEvent) {
      if ('touches' in e && e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (stateRef.current.pinchDist > 0) {
          stateRef.current.zoom = Math.max(0.3, Math.min(5, stateRef.current.zoom * (d / stateRef.current.pinchDist)));
        }
        stateRef.current.pinchDist = d;
        updateCamera();
        return;
      }
      stateRef.current.pinchDist = 0;
      if (!stateRef.current.isDragging) return;
      const p = 'touches' in e ? e.touches[0] : e;
      const dx = p.clientX - stateRef.current.lastX;
      const dy = p.clientY - stateRef.current.lastY;
      stateRef.current.rotY += dx * 0.008;
      // 縦方向も制限なしで360°自由に回転できるようにする
      stateRef.current.rotX += dy * 0.006;
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
      updateCamera();
    }

    function onPointerUp() {
      stateRef.current.isDragging = false;
      stateRef.current.pinchDist = 0;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      stateRef.current.zoom = Math.max(0.3, Math.min(5, stateRef.current.zoom * (e.deltaY > 0 ? 0.93 : 1.07)));
      updateCamera();
    }

    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('mousemove', onPointerMove);
    el.addEventListener('mouseup', onPointerUp);
    el.addEventListener('mouseleave', onPointerUp);
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    el.addEventListener('touchmove', onPointerMove, { passive: true });
    el.addEventListener('touchend', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      el.removeEventListener('mousedown', onPointerDown);
      el.removeEventListener('mousemove', onPointerMove);
      el.removeEventListener('mouseup', onPointerUp);
      el.removeEventListener('mouseleave', onPointerUp);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove', onPointerMove);
      el.removeEventListener('touchend', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      // ジオメトリ/マテリアル/テクスチャを解放
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach(x => x.dispose());
          else m.dispose();
        }
        if (obj instanceof THREE.Sprite) {
          obj.material.map?.dispose();
          obj.material.dispose();
        }
      });
      // 環境マップ（IBL）リソースの解放
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(el)) container.removeChild(el);
    };
  }, [items]);

  return <div ref={canvasRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
}
