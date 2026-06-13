/**
 * 工程2: DataSpace 環境シーン
 *
 * 3つの構成要素を1つの <group> にまとめる:
 *   1. 粒子の地平  — THREE.Points × 1 draw call
 *   2. 発光グリッド床 — 工程1 Grid をそのまま活用（Scene 側で維持）
 *   3. 浮遊する幾何オブジェクト — 低ポリ形状 5 個
 *
 * ── useFrame と delta ──────────────────────────────────────────
 * useFrame((_state, delta) => { ... }) の delta は「前フレームからの秒数」。
 * これを乗算することで 30fps/60fps/120fps どの端末でも
 * 同じ速度でアニメーションする（フレームレート非依存）。
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ENV_DATASPACE } from '../constants';

// ─── 型 ───────────────────────────────────────────────────────

interface GeoObject {
  position: [number, number, number];
  /** ボブ位相オフセット（オブジェクトごとにずらして不規則感を出す）*/
  phase: number;
  scale: number;
  rotAxis: THREE.Vector3;
  /** IcosahedronGeometry の detail、または OctahedronGeometry */
  type: 'icosa' | 'octa' | 'tetra' | 'dodeca' | 'torus';
}

// ─── 定数を局所変数に展開 ──────────────────────────────────────

const {
  PARTICLE_COUNT,
  PARTICLE_SPREAD,
  PARTICLE_SIZE,
  PARTICLE_COLOR,
  PARTICLE_DRIFT_SPEED,
  GEO_COLOR,
  GEO_METALNESS,
  GEO_ROUGHNESS,
  GEO_EMISSIVE,
  GEO_EMISSIVE_INTENSITY,
  GEO_ROTATE_SPEED,
  GEO_BOB_AMPLITUDE,
  GEO_BOB_FREQUENCY,
} = ENV_DATASPACE;

// ─── 粒子コンポーネント ────────────────────────────────────────

function ParticleField() {
  /**
   * THREE.Points の仕組み:
   *   - BufferGeometry に position 属性（Float32Array）を渡す
   *   - PointsMaterial でサイズ・色・ブレンドを設定
   *   - GPU が各頂点をスプライト（四角形ビルボード）として描く
   *   - 全頂点が 1 draw call なので非常に軽量
   */
  const pointsRef = useRef<THREE.Points>(null!);

  const [geometry, initialPositions] = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const s = PARTICLE_SPREAD;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * s * 2;
      positions[i3 + 1] = (Math.random() - 0.5) * s * 1.2; // 縦方向はやや狭く
      positions[i3 + 2] = (Math.random() - 0.5) * s * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // 初期座標をコピーしてドリフト計算の基準にする
    return [geo, positions.slice()];
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;

    const pos = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = _state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // サイン波で上下にゆっくりドリフト（粒子ごとに位相をずらす）
      const phase = initialPositions[i3] * 0.7 + initialPositions[i3 + 2] * 0.3;
      pos.setY(
        i,
        initialPositions[i3 + 1] + Math.sin(t * PARTICLE_DRIFT_SPEED + phase) * 1.5,
      );
    }

    pos.needsUpdate = true;
    void delta; // delta は将来の速度スケールに使える（現状は時刻基準で十分）
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      {/**
       * PointsMaterial:
       *   - sizeAttenuation: true → カメラ距離で粒子サイズが変わる（遠近感）
       *   - blending: AdditiveBlending → 重なるほど明るくなる（発光感）
       *   - depthWrite: false → 不透明オブジェクトの前でも正しく描画される
       *   - transparent: true → blending を有効にするために必要
       */}
      <pointsMaterial
        color={PARTICLE_COLOR}
        size={PARTICLE_SIZE}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
        opacity={0.7}
      />
    </points>
  );
}

// ─── 浮遊する幾何オブジェクト ──────────────────────────────────

const GEO_CONFIGS: GeoObject[] = [
  { position: [-3.5, 2.2, -2.0], phase: 0.0,              scale: 0.55, rotAxis: new THREE.Vector3(1, 1, 0).normalize(),  type: 'icosa'  },
  { position: [ 3.2, 1.8, -3.5], phase: Math.PI * 0.4,    scale: 0.45, rotAxis: new THREE.Vector3(0, 1, 1).normalize(),  type: 'octa'   },
  { position: [ 0.2, 3.0, -5.0], phase: Math.PI * 0.8,    scale: 0.65, rotAxis: new THREE.Vector3(1, 0.5, 1).normalize(), type: 'dodeca' },
  { position: [-2.0, 1.5, -6.5], phase: Math.PI * 1.2,    scale: 0.40, rotAxis: new THREE.Vector3(0.5, 1, 0.5).normalize(), type: 'tetra' },
  { position: [ 4.5, 2.6, -1.5], phase: Math.PI * 1.6,    scale: 0.50, rotAxis: new THREE.Vector3(1, 1, 1).normalize(),  type: 'torus'  },
];

function makeGeometry(type: GeoObject['type']) {
  switch (type) {
    case 'icosa':  return new THREE.IcosahedronGeometry(1, 1);
    case 'octa':   return new THREE.OctahedronGeometry(1, 0);
    case 'tetra':  return new THREE.TetrahedronGeometry(1, 0);
    case 'dodeca': return new THREE.DodecahedronGeometry(1, 0);
    case 'torus':  return new THREE.TorusGeometry(1, 0.32, 8, 24);
  }
}

interface FloatingObjectProps extends GeoObject {}

function FloatingObject({ position, phase, scale, rotAxis, type }: FloatingObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(() => makeGeometry(type), [type]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    const t = _state.clock.elapsedTime;

    // 自転: rotAxis の周りを delta 乗算で回す（フレームレート非依存）
    meshRef.current.rotateOnAxis(rotAxis, delta * GEO_ROTATE_SPEED);

    // 上下ボブ: 初期 Y + サイン波
    meshRef.current.position.y =
      position[1] + Math.sin(t * GEO_BOB_FREQUENCY + phase) * GEO_BOB_AMPLITUDE;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      scale={scale}
      castShadow
    >
      <meshStandardMaterial
        color={GEO_COLOR}
        metalness={GEO_METALNESS}
        roughness={GEO_ROUGHNESS}
        emissive={GEO_EMISSIVE}
        emissiveIntensity={GEO_EMISSIVE_INTENSITY}
      />
    </mesh>
  );
}

// ─── エクスポート ─────────────────────────────────────────────

export default function EnvironmentDataSpace() {
  return (
    <group>
      {/* 1. 粒子の地平 */}
      <ParticleField />

      {/* 3. 浮遊する幾何オブジェクト（2. グリッド床は Scene.tsx 側で維持）*/}
      {GEO_CONFIGS.map((cfg, i) => (
        <FloatingObject key={i} {...cfg} />
      ))}
    </group>
  );
}
