/**
 * 3D Experience — デザイン定数
 *
 * 工程2以降で「環境ごとに差し替える」ために一箇所に集約。
 * 単位は特記なければ Three.js のワールド単位（1 ≒ 1メートル相当）。
 */

// ─── 背景・霧 ───────────────────────────────────────────────

/** シーン背景色：黒に近い濃紺 */
export const BG_COLOR = '#05060A';

/** 霧の色（背景と同系統で自然に溶け込む）*/
export const FOG_COLOR = '#0a0e1a';

/** 霧の開始距離（単位: ワールド単位）*/
export const FOG_NEAR = 10;

/** 霧の終端距離（単位: ワールド単位）—— ここで完全に不透明になる */
export const FOG_FAR = 45;

// ─── ライト ─────────────────────────────────────────────────

/** 環境光の強度（0=なし / 1=通常 / 2=強め）
 *  小さい値にして方向光によるシャドウ感を活かす */
export const AMBIENT_INTENSITY = 0.25;

/** 方向光の色：寒色寄りの青白 */
export const DIR_LIGHT_COLOR = '#8ab4f8';

/** 方向光の強度 */
export const DIR_LIGHT_INTENSITY = 2.0;

/** 方向光の位置 [x, y, z]（単位: ワールド単位）*/
export const DIR_LIGHT_POSITION = [5, 10, 4] as const;

// ─── 床グリッド（drei <Grid> コンポーネント用）──────────────

/** グリッドの一辺のサイズ（単位: ワールド単位）*/
export const GRID_SIZE = 30;

/** 細い補助線の色（控えめなシアン）*/
export const GRID_CELL_COLOR = '#0a3a50';

/** セクション（5マスごと）の太線色 */
export const GRID_SECTION_COLOR = '#0d5a7a';

/** グリッドが完全に消えるカメラからの距離（単位: ワールド単位）*/
export const GRID_FADE_DISTANCE = 30;

/** フェードの強さ（1=標準）*/
export const GRID_FADE_STRENGTH = 1.2;

// ─── 岩のマテリアル ─────────────────────────────────────────

/** 岩のベース色（暗いチャコール）*/
export const ROCK_COLOR = '#1e1e2e';

/** 金属質感（0=非金属 / 1=完全金属）—— 高めにしてエッジに光を走らせる */
export const ROCK_METALNESS = 0.88;

/** 表面の粗さ（0=鏡面 / 1=完全拡散）—— 低めで光沢感を出す */
export const ROCK_ROUGHNESS = 0.12;

/** エミッシブ（自己発光）色：青〜紫系でエッジがほんのり光る */
export const ROCK_EMISSIVE = '#1a0550';

/** エミッシブ強度（0=なし / 1=通常）—— 弱めが「未来感」として上品 */
export const ROCK_EMISSIVE_INTENSITY = 0.6;

/** 岩の半径（単位: ワールド単位）*/
export const ROCK_RADIUS = 1.0;

/** 岩の頂点ランダム変位量（大きいほど荒々しい形に）*/
export const ROCK_DEFORM_AMOUNT = 0.18;

/** 岩の床からの高さ（単位: ワールド単位）*/
export const ROCK_Y = 1.1;

// ─── カメラ ─────────────────────────────────────────────────

/** カメラの初期位置 [x, y, z]（単位: ワールド単位）*/
export const CAMERA_POSITION = [0, 3, 9] as const;

/** カメラの視野角（単位: 度）*/
export const CAMERA_FOV = 60;

// ─── 工程2/3: DataSpace 環境定数 ──────────────────────────────

/**
 * 環境プリセットの型。この形を満たすオブジェクトを
 * EnvironmentDataSpace の preset prop に渡せる。
 * 別の世界観を作るときはこの型で新しい定数を追加するだけでよい。
 */
export interface EnvPreset {
  PARTICLE_COUNT: number;
  PARTICLE_SPREAD: number;
  PARTICLE_SIZE: number;
  PARTICLE_COLOR: string;
  PARTICLE_DRIFT_SPEED: number;
  GEO_COLOR: string;
  GEO_METALNESS: number;
  GEO_ROUGHNESS: number;
  GEO_EMISSIVE: string;
  GEO_EMISSIVE_INTENSITY: number;
  GEO_ROTATE_SPEED: number;
  GEO_BOB_AMPLITUDE: number;
  GEO_BOB_FREQUENCY: number;
  AUTO_ROTATE_SPEED: number;
}

export const ENV_DATASPACE = {
  // --- 粒子の地平 (THREE.Points) ---
  /** 空間に散らす粒子数（多すぎると重い、3000 が draw call 1本で十分映える）*/
  PARTICLE_COUNT: 3000,
  /** 粒子が散らばる立方体の半辺長（単位: ワールド単位）*/
  PARTICLE_SPREAD: 20,
  /** 粒子のサイズ（points.size）*/
  PARTICLE_SIZE: 0.06,
  /** 粒子の色: シアン */
  PARTICLE_COLOR: '#00d4ff',
  /** 粒子のドリフト速度係数（delta 乗算）*/
  PARTICLE_DRIFT_SPEED: 0.08,

  // --- 浮遊する幾何オブジェクト ---
  /** オブジェクトのベース色 */
  GEO_COLOR: '#1a1a3e',
  /** 金属質感（高めでエッジに光を走らせる）*/
  GEO_METALNESS: 0.9,
  /** 表面の粗さ（低めで光沢）*/
  GEO_ROUGHNESS: 0.08,
  /** エミッシブ色: 青〜紫 */
  GEO_EMISSIVE: '#1a0540',
  /** エミッシブ強度 */
  GEO_EMISSIVE_INTENSITY: 0.8,
  /** 自転速度係数 */
  GEO_ROTATE_SPEED: 0.4,
  /** 上下ボブ振幅（単位: ワールド単位）*/
  GEO_BOB_AMPLITUDE: 0.18,
  /** ボブ周期（低いほどゆっくり）*/
  GEO_BOB_FREQUENCY: 0.5,

  // --- OrbitControls autoRotate（工程3で撤去済み。型統一のため保持）---
  AUTO_ROTATE_SPEED: 0.4,
} as const;

// ─── 工程3: 環境2プリセット（マゼンタ寄り）──────────────────────
/**
 * ※ここの色・速度定数を書き換えるだけで別の世界観（サイバー都市・SF自然など）に差し替えられる。
 *   コンポーネント側は変更不要。
 */
export const ENV_DATASPACE_2: EnvPreset = {
  PARTICLE_COUNT: 3000,         // 粒子数（環境1と合計 6000。重ければここを減らす）
  PARTICLE_SPREAD: 20,
  PARTICLE_SIZE: 0.06,
  PARTICLE_COLOR: '#ff40d0',    // 環境1=シアン、環境2=マゼンタ
  PARTICLE_DRIFT_SPEED: 0.07,   // ドリフトリズムを少し変えて個性を出す
  GEO_COLOR: '#1a0a2e',
  GEO_METALNESS: 0.9,
  GEO_ROUGHNESS: 0.08,
  GEO_EMISSIVE: '#50053a',      // 青紫 → マゼンタ
  GEO_EMISSIVE_INTENSITY: 0.8,
  GEO_ROTATE_SPEED: 0.35,       // 自転速度も微妙に変えて区別感を出す
  GEO_BOB_AMPLITUDE: 0.20,
  GEO_BOB_FREQUENCY: 0.45,
  AUTO_ROTATE_SPEED: 0.4,       // OrbitControls 撤去後は未使用。型統一のため保持
};

// ─── 工程3: スクロールカメラ定数 ─────────────────────────────

/**
 * ScrollControls の pages 数。
 * pages=3 → スクロール可能高さが 3×100vh になり、
 * 一番下まで到達したとき useScroll().offset = 1 になる。
 */
export const SCROLL_PAGES = 3;

/**
 * MathUtils.damp の λ（ラムダ）値。
 * 大きいほどカメラが目標値に速く追いつく（4〜8 が自然）。
 */
export const SCROLL_DAMPING = 5;

/**
 * 開発時だけ OrbitControls で自由視点確認したい場合に true に変える。
 * 本番では必ず false のまま。
 */
export const DEV_ORBIT = false;

/**
 * カメラ始点 — 環境1（z=0）を正面に捉える位置。
 * CAMERA_POSITION と同値にしておくと Canvas 初期カメラと一致する。
 */
export const CAMERA_START = {
  position: [0, 3, 9] as const,
  lookAt:   [0, 1.5, 0] as const,
} as const;

/**
 * カメラ終点 — 環境2（z=-60）を正面に捉える位置。
 * 環境間距離 60 > FOG_FAR 45 のため、移動中は霧で自然に切り替わる。
 */
export const CAMERA_END = {
  position: [0, 3, -51] as const,   // 環境2 の手前 9 ユニット（始点と同じオフセット）
  lookAt:   [0, 1.5, -60] as const,
} as const;
