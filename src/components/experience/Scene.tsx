/**
 * 3D Experience — メインシーン
 *
 * ── <Canvas> が裏でやっていること（初学者向け）──────────────────
 * 1. THREE.WebGLRenderer を生成し、canvas 要素をマウント
 * 2. THREE.Scene（物体の入れ物）と THREE.PerspectiveCamera を自動設定
 * 3. requestAnimationFrame ループを内部で回し続け、毎フレーム描画
 * 4. React のコンポーネントツリーが「仮想 Three.js グラフ」として
 *    JSX → Three.js オブジェクト に変換される（react-reconciler 経由）
 * ────────────────────────────────────────────────────────────────
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';

import {
  BG_COLOR,
  FOG_COLOR,
  FOG_NEAR,
  FOG_FAR,
  AMBIENT_INTENSITY,
  DIR_LIGHT_COLOR,
  DIR_LIGHT_INTENSITY,
  DIR_LIGHT_POSITION,
  GRID_SIZE,
  GRID_CELL_COLOR,
  GRID_SECTION_COLOR,
  GRID_FADE_DISTANCE,
  GRID_FADE_STRENGTH,
  CAMERA_POSITION,
  CAMERA_FOV,
  ENV_DATASPACE,
} from './constants';
import EnvironmentDataSpace from './environments/EnvironmentDataSpace';

// ─── シーン全体コンポーネント ─────────────────────────────────────
function SceneContents() {
  return (
    <>
      {/**
       * fog: カメラから一定距離を超えた物体を霧で隠す。
       * FogExp2 より Fog（線形）の方が制御しやすい。
       * 背景と同系統の色にすると自然に溶け込む。
       */}
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />

      {/**
       * color を scene.background に直接アタッチする書き方。
       * Canvas の background prop より確実にシーン背景色が設定される。
       */}
      <color attach="background" args={[BG_COLOR]} />

      {/**
       * ambientLight: 全方向から均等に照らす環境光。
       * 影のない「底上げ」照明。intensity を低めにして方向光の陰影を活かす。
       */}
      <ambientLight intensity={AMBIENT_INTENSITY} />

      {/**
       * directionalLight: 太陽光に相当する平行光源。
       * position は光の方向ベクトル（originへ向かう）。
       * 寒色（青白）にして近未来感を演出。
       */}
      <directionalLight
        color={DIR_LIGHT_COLOR}
        intensity={DIR_LIGHT_INTENSITY}
        position={DIR_LIGHT_POSITION}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/**
       * Grid (drei): 床のグリッド表示。
       * PlaneGeometry + wireframe より綺麗にフェードアウトできる。
       *   - cellSize: 1マスのサイズ
       *   - sectionSize: 太線で区切るマス数
       *   - fadeDistance: ここを超えると透明になる
       *   - infiniteGrid: false にして fadeDistance 外は消す
       */}
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

      {/* 工程2: DataSpace 環境（粒子 + 浮遊オブジェクト）*/}
      <EnvironmentDataSpace />

      {/**
       * OrbitControls (drei): autoRotate で視点をゆっくり周回する。
       * ⚠️ 暫定: 工程3 でカメラアニメーションパスに差し替え予定。
       */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.05}
        autoRotate
        autoRotateSpeed={ENV_DATASPACE.AUTO_ROTATE_SPEED}
      />
    </>
  );
}

// ─── エクスポート（Canvas ラッパー）──────────────────────────────
export default function Scene() {
  return (
    /**
     * Canvas は 100% × 100% で親要素を埋める。
     * experience/index.html 側で html/body を 100dvh にしているので
     * 自動的にブラウザいっぱいになる。
     *
     * camera: Three.js PerspectiveCamera の初期設定。
     *   - position: カメラの初期座標
     *   - fov: 視野角（度）
     * gl.antialias: エッジのギザギザを滑らかにする（重くなければ有効推奨）
     * shadows: directionalLight の castShadow を有効にする
     */
    <Canvas
      style={{ width: '100vw', height: '100dvh', display: 'block' }}
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      gl={{ antialias: true, alpha: false }}
      shadows
    >
      <SceneContents />

      {/**
       * Stats (drei): 画面左上にFPSを常時表示するデバッグパネル。
       * r3f-perf より軽量で React 19 との互換リスクがない。
       * 工程完了後に削除するか、開発モードのみ表示に切り替えること。
       */}
      <Stats />
    </Canvas>
  );
}
