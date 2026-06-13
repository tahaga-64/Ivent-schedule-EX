/**
 * 工程2/3: DataSpace 環境シーン
 *
 * 工程3 で preset + position props を追加。同じコンポーネントを
 * 色・パラメータを変えて複数の座標に並べられる。
 *
 *   <EnvironmentDataSpace />
 *     → ENV_DATASPACE（シアン）、原点
 *
 *   <EnvironmentDataSpace preset={ENV_DATASPACE_2} position={[0, 0, -60]} />
 *     → マゼンタ版を 60 ユニット奥に配置
 *
 * ★ 別の世界観（サイバー都市・SF自然など）に差し替えたい場合:
 *   constants.ts の ENV_DATASPACE_2 の色・速度定数を書き換えるだけ。
 *   このコンポーネントには触れなくてよい。
 *
 * ── useFrame と delta ──────────────────────────────────────────
 * useFrame((_state, delta) => { ... }) の delta は「前フレームからの秒数」。
 * これを乗算することで 30fps/60fps/120fps どの端末でも
 * 同じ速度でアニメーションする（フレームレート非依存）。
 * ─────────────────────────────────────────────────────────────
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';

import {
  ENV_DATASPACE,
  EnvPreset,
  GRID_SIZE,
  GRID_CELL_COLOR,
  GRID_SECTION_COLOR,
  GRID_FADE_DISTANCE,
  GRID_FADE_STRENGTH,
} from '../constants';

// ─── 型 ───────────────────────────────────────────────────────

interface GeoObject {
  position: [number, number, number];
  /** ボブ位相オフセット（オブジェクトごとにずらして不規則感を出す）*/
  phase: number;
  scale: number;
  rotAxis: THREE.Vector3;
  type: 'icosa' | 'octa' | 'tetra' | 'dodeca' | 'torus';
}

interface EnvironmentDataSpaceProps {
  /** 色・速度プリセット。省略時は ENV_DATASPACE（シアン）を使う */
  preset?: EnvPreset;
  /** グループの世界座標。省略時は原点 */
  position?: [number, number, number];
}

// ─── 浮遊オブジェクトの配置設定（グループのローカル座標）────────

const GEO_CONFIGS: GeoObject[] = [
  { position: [-3.5, 2.2, -2.0], phase: 0.0,           scale: 0.55, rotAxis: new THREE.Vector3(1, 1, 0).normalize(),     type: 'icosa'  },
  { position: [ 3.2, 1.8, -3.5], phase: Math.PI * 0.4, scale: 0.45, rotAxis: new THREE.Vector3(0, 1, 1).normalize(),     type: 'octa'   },
  { position: [ 0.2, 3.0, -5.0], phase: Math.PI * 0.8, scale: 0.65, rotAxis: new THREE.Vector3(1, 0.5, 1).normalize(),   type: 'dodeca' },
  { position: [-2.0, 1.5, -6.5], phase: Math.PI * 1.2, scale: 0.40, rotAxis: new THREE.Vector3(0.5, 1, 0.5).normalize(), type: 'tetra'  },
  { position: [ 4.5, 2.6, -1.5], phase: Math.PI * 1.6, scale: 0.50, rotAxis: new THREE.Vector3(1, 1, 1).normalize(),     type: 'torus'  },
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

// ─── 粒子コンポーネント ────────────────────────────────────────

function ParticleField({ preset }: { preset: EnvPreset }) {
  /**
   * THREE.Points の仕組み:
   *   - BufferGeometry に position 属性（Float32Array）を渡す
   *   - PointsMaterial でサイズ・色・ブレンドを設定
   *   - GPU が各頂点をスプライト（四角形ビルボード）として描く
   *   - 全頂点が 1 draw call なので非常に軽量
   */
  const {
    PARTICLE_COUNT,
    PARTICLE_SPREAD,
    PARTICLE_SIZE,
    PARTICLE_COLOR,
    PARTICLE_DRIFT_SPEED,
  } = preset;

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
    // 初期座標をコピーしてドリフト計算の基準にする（Y だけ動かし X/Z は固定）
    return [geo, positions.slice()];
    // [] で初回マウント時のみ生成。preset は mount 後に変わらないので安全
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

interface FloatingObjectProps extends GeoObject {
  preset: EnvPreset;
}

function FloatingObject({ position, phase, scale, rotAxis, type, preset }: FloatingObjectProps) {
  const {
    GEO_COLOR,
    GEO_METALNESS,
    GEO_ROUGHNESS,
    GEO_EMISSIVE,
    GEO_EMISSIVE_INTENSITY,
    GEO_ROTATE_SPEED,
    GEO_BOB_AMPLITUDE,
    GEO_BOB_FREQUENCY,
  } = preset;

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
    <mesh ref={meshRef} geometry={geometry} position={position} scale={scale} castShadow>
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

export default function EnvironmentDataSpace({
  preset = ENV_DATASPACE,
  position = [0, 0, 0],
}: EnvironmentDataSpaceProps) {
  return (
    /**
     * position prop でグループごと移動するため、
     * 内部の粒子・グリッド・オブジェクトは全てローカル座標で定義するだけでよい。
     */
    <group position={position}>
      {/* 1. 粒子の地平 */}
      <ParticleField preset={preset} />

      {/* 2. 発光グリッド床（各環境が独自の床を持つ）*/}
      <Grid
        args={[GRID_SIZE, GRID_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor={GRID_CELL_COLOR}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={GRID_SECTION_COLOR}
        fadeDistance={GRID_FADE_DISTANCE}
        fadeStrength={GRID_FADE_STRENGTH}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      {/* 3. 浮遊する幾何オブジェクト */}
      {GEO_CONFIGS.map((cfg, i) => (
        <FloatingObject key={i} {...cfg} preset={preset} />
      ))}
    </group>
  );
}
