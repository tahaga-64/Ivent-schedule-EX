/**
 * 3D Experience — メインシーン（工程3: スクロール駆動カメラ）
 *
 * ── <Canvas> が裏でやっていること ──────────────────────────────
 * 1. THREE.WebGLRenderer を生成し canvas 要素をマウント
 * 2. THREE.PerspectiveCamera を自動設定
 * 3. requestAnimationFrame ループを回し続け毎フレーム描画
 * 4. React コンポーネントツリー → 仮想 Three.js グラフ（react-reconciler 経由）
 * ────────────────────────────────────────────────────────────────
 *
 * ── Lenis について ──────────────────────────────────────────────
 * /experience は独立した Vite MPA エントリ（experience/index.html）のため、
 * メインアプリ側で Lenis を使っていてもここには影響しない。
 * さらに ScrollControls は独自のスクロールコンテナを Canvas に重ねるため、
 * Lenis と併用すると二重スクロールが競合する。ここでは使用しない。
 * ────────────────────────────────────────────────────────────────
 */
import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ScrollControls, useScroll, OrbitControls, Stats, Scroll } from '@react-three/drei';
import * as THREE from 'three';

import {
  BG_COLOR,
  FOG_COLOR,
  FOG_NEAR,
  FOG_FAR,
  AMBIENT_INTENSITY,
  DIR_LIGHT_COLOR,
  DIR_LIGHT_INTENSITY,
  DIR_LIGHT_POSITION,
  CAMERA_POSITION,
  CAMERA_FOV,
  ENV_DATASPACE,
  ENV_DATASPACE_2,
  SCROLL_PAGES,
  SCROLL_DAMPING,
  CAMERA_START,
  CAMERA_END,
  DEV_ORBIT,
} from './constants';
import EnvironmentDataSpace from './environments/EnvironmentDataSpace';
import { ProjectOverlay, OverlayController } from './ProjectOverlay';

// ─── カメラリグ（スクロール連動）────────────────────────────────

function CameraRig() {
  /**
   * useScroll() は ScrollControls の子孫コンポーネントでのみ呼べる。
   * scroll.offset: 0（ページ上端）〜 1（ページ下端）の正規化スクロール進捗。
   *
   * ── なぜ「Canvas 固定・背後の高さでスクロール」させるのか ──────
   * Canvas は CSS で viewport に固定する。ScrollControls はその上に
   * 透明な div を重ね、pages×100vh の高さを与える。
   * ユーザーがスクロールしてもその div が動くだけで Canvas は動かない。
   * useScroll().offset がその scroll 量を 0〜1 で渡してくれるので、
   * useFrame の中でカメラを動かせば「自分が移動している」ように見える。
   * ─────────────────────────────────────────────────────────────
   */
  const scroll = useScroll();
  const { camera } = useThree();

  // lookAt の現在値を ref で追跡（毎フレーム damp で目標値に近づける）
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA_START.lookAt));

  // Vector3 を毎フレーム new すると GC プレッシャーになるため ref で使い回す
  const targetPos  = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());
  const vStart = useRef(new THREE.Vector3(...CAMERA_START.position));
  const vEnd   = useRef(new THREE.Vector3(...CAMERA_END.position));
  const lStart = useRef(new THREE.Vector3(...CAMERA_START.lookAt));
  const lEnd   = useRef(new THREE.Vector3(...CAMERA_END.lookAt));

  useFrame((_state, delta) => {
    const t = scroll.offset; // 0〜1

    /**
     * Easing（緩急）: offset をそのまま lerp に入れると等速で機械的に見える。
     * cubic ease-in-out を通すと開始・終了時がゆっくり・中間が速い自然な加減速。
     *   t=0 → eased=0（始点）、t=0.5 → eased=0.5（中点）、t=1 → eased=1（終点）
     */
    const eased = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // eased 値でターゲット位置・視線方向を線形補間（始点→終点）
    targetPos.current.lerpVectors(vStart.current, vEnd.current, eased);
    targetLook.current.lerpVectors(lStart.current, lEnd.current, eased);

    /**
     * MathUtils.damp(current, target, λ, delta):
     *   毎フレーム「current → target へ λ の速さで指数的に近づく」。
     *   delta（前フレームからの経過秒数）を組み込むため、
     *   60fps でも 30fps でも同じ追従速度になる（フレームレート非依存）。
     *
     *   lerp との違い: lerp(cur, tgt, 0.1) はフレームレートが落ちると
     *   動きが遅くなる。damp は delta があるため速度が常に一定。
     */
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.current.x, SCROLL_DAMPING, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.current.y, SCROLL_DAMPING, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.current.z, SCROLL_DAMPING, delta);

    // lookAt も damp で滑らかに追従（currentLookAt ref に現在値を保持）
    currentLookAt.current.x = THREE.MathUtils.damp(currentLookAt.current.x, targetLook.current.x, SCROLL_DAMPING, delta);
    currentLookAt.current.y = THREE.MathUtils.damp(currentLookAt.current.y, targetLook.current.y, SCROLL_DAMPING, delta);
    currentLookAt.current.z = THREE.MathUtils.damp(currentLookAt.current.z, targetLook.current.z, SCROLL_DAMPING, delta);

    camera.lookAt(currentLookAt.current);
  });

  return null;
}

// ─── シーン全体コンポーネント ─────────────────────────────────────

function SceneContents() {
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />
      <color attach="background" args={[BG_COLOR]} />
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight
        color={DIR_LIGHT_COLOR}
        intensity={DIR_LIGHT_INTENSITY}
        position={DIR_LIGHT_POSITION}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/**
       * ScrollControls (drei):
       *   - pages: スクロール可能高さ = pages × 100vh
       *   - damping: ScrollControls 内部の慣性係数（独自のスムーズスクロール）。
       *     CameraRig 側の MathUtils.damp と合わさって2段階の滑らかさになる。
       *
       * CameraRig は ScrollControls の子孫として配置する必要がある
       * （useScroll() がコンテキストを参照するため）。
       */}
      <ScrollControls pages={SCROLL_PAGES} damping={0.1}>
        {/* 環境1: DataSpace（シアン）— 原点 */}
        <EnvironmentDataSpace preset={ENV_DATASPACE} position={[0, 0, 0]} />

        {/* 環境2: DataSpace（マゼンタ）— 60 ユニット奥
            ※ここのプリセットを差し替えれば「サイバー都市」「SF自然」等の別テーマに変更できる。
              constants.ts の ENV_DATASPACE_2 の色・速度定数を書き換えるだけでよい。 */}
        <EnvironmentDataSpace preset={ENV_DATASPACE_2} position={[0, 0, -60]} />

        {/* スクロール連動カメラ制御（ScrollControls の子孫である必要がある）*/}
        <CameraRig />

        {/*
         * OverlayController: Canvas 内コンポーネント。
         * useScroll() + useFrame() で panelRefs の opacity / pointer-events を毎フレーム更新する。
         * ScrollControls の子孫である必要がある（useScroll が context を参照するため）。
         */}
        <OverlayController />

        {/**
         * <Scroll html>: HTML を 3D Canvas と同期させるラッパー。
         *
         * ScrollControls が管理する offset を使い、内部の div に
         * translateY を毎フレーム適用してスクロール量をHTMLに反映する。
         * CameraRig も同じ offset を読んでいるため、3D カメラと HTML パネルは
         * 追加の同期コードなしに自然に連動する（Canvas 外に別の div を置く場合は
         * この同期を自前で作る必要があり、ズレが生じやすい）。
         *
         * パネルは <Scroll html> コンテナ内で position:absolute + top:Nvh で配置し、
         * offset=0 → 0vh（環境1）、offset=1 → 200vh（環境2）がビューポート中央になる。
         * 表示/非表示は OverlayController が opacity で制御する（DOM の付け外しより軽い）。
         */}
        <Scroll html>
          <ProjectOverlay />
        </Scroll>
      </ScrollControls>

      {/* DEV_ORBIT=true のときだけ OrbitControls で自由視点を有効化（本番: false）
          スクロールカメラとの競合を避けるため、本番では必ず外す */}
      {DEV_ORBIT && (
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={3}
          maxDistance={80}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      )}
    </>
  );
}

// ─── エクスポート（Canvas ラッパー）──────────────────────────────

export default function Scene() {
  return (
    /**
     * Canvas を 100vw × 100dvh の固定サイズにする。
     * ScrollControls が Canvas の上に透明な div を重ねてスクロール領域を作るため、
     * Canvas 自体は動かず、スクロール量だけが CameraRig に届く構造になる。
     */
    <Canvas
      style={{ width: '100vw', height: '100dvh', display: 'block' }}
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      gl={{ antialias: true, alpha: false }}
      shadows
    >
      <SceneContents />
      <Stats />
    </Canvas>
  );
}
