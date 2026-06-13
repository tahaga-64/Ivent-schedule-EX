/**
 * Theatre.js プロジェクト定義
 *
 * AquariumScene のカメライントロシーケンス（0→2.5秒）を
 * Theatre.js のキーフレームアニメーションとして管理。
 *
 * State JSON に ease-out cubic 相当のハンドル値を埋め込み済み。
 * @theatre/studio（開発用）でエディタを開けばリアルタイム調整可能。
 */
import { getProject, onChange, val } from '@theatre/core';

// ─── プロジェクト状態（ベイクされたキーフレーム） ──────────────────────────
const AQUARIUM_STATE = {
  sheetsById: {
    AquariumIntro: {
      staticOverrides: { byObject: {} },
      sequence: {
        type: 'PositionalSequence' as const,
        length: 2.5,
        subUnitsPerUnit: 30,
        tracksByObject: {
          Camera: {
            trackIdByPropPath: {
              posY: 't0',
              posZ: 't1',
              fov:  't2',
            },
            trackData: {
              t0: {
                type: 'BasicKeyframedTrack' as const,
                keyframes: [
                  // ease-out cubic: handles ≈ CSS [0.22, 1, 0.36, 1]
                  { id: 'k0a', position: 0,   value: 8,    handles: [0.5, 0.5, 0.22, 1] as [number,number,number,number], connectedRight: true },
                  { id: 'k0b', position: 2.5, value: 1.2,  handles: [0.64, 0, 0.5, 0.5] as [number,number,number,number], connectedRight: false },
                ],
              },
              t1: {
                type: 'BasicKeyframedTrack' as const,
                keyframes: [
                  { id: 'k1a', position: 0,   value: 15.5, handles: [0.5, 0.5, 0.22, 1] as [number,number,number,number], connectedRight: true },
                  { id: 'k1b', position: 2.5, value: 9.5,  handles: [0.64, 0, 0.5, 0.5] as [number,number,number,number], connectedRight: false },
                ],
              },
              t2: {
                type: 'BasicKeyframedTrack' as const,
                keyframes: [
                  { id: 'k2a', position: 0,   value: 70,   handles: [0.5, 0.5, 0.22, 1] as [number,number,number,number], connectedRight: true },
                  { id: 'k2b', position: 2.5, value: 55,   handles: [0.64, 0, 0.5, 0.5] as [number,number,number,number], connectedRight: false },
                ],
              },
            },
          },
        },
      },
    },
  },
  definitionVersion: '0.4.0',
  revisionHistory: ['baked-v1'],
};

// ─── プロジェクト・シート・オブジェクト ──────────────────────────────────
export const aquariumProject = getProject('AquariumCamera', {
  state: AQUARIUM_STATE,
});

export const introSheet = aquariumProject.sheet('AquariumIntro');

export const cameraObj = introSheet.object('Camera', {
  posY: 8,
  posZ: 15.5,
  fov:  70,
});

// ─── カメラコールバック登録型 ──────────────────────────────────────────
export type CameraValues = { posY: number; posZ: number; fov: number };
type Unsubscribe = () => void;

/**
 * カメラオブジェクトの変化を購読し、Three.js カメラを更新するためのコールバックを返す。
 * AquariumScene の useEffect 内で呼び出し、クリーンアップ時に unsub() すること。
 */
export function subscribeCameraIntro(
  callback: (values: CameraValues) => void
): Unsubscribe {
  return onChange(cameraObj.props, callback);
}

/** 現在のカメラ値をワンショットで読む（初期値設定用） */
export function getCameraValues(): CameraValues {
  return val(cameraObj.props);
}

/** イントロシーケンスを再生して Promise を返す */
export function playIntro(): Promise<boolean> {
  return introSheet.sequence.play({ range: [0, 2.5] });
}
