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

// ─── 工程2: DataSpace 環境定数 ───────────────────────────────

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

  // --- OrbitControls 暫定 autoRotate ---
  /** autoRotate 速度（暫定: 工程3でカメラパスに差し替え）*/
  AUTO_ROTATE_SPEED: 0.4,
} as const;
