// 型定義を単純化
// 音名の型定義
export type NoteName = string;

// 音名の配列（シャープとフラットを別々の要素として）
export const NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// メトロノームの音タイプ
export type SoundType = 'attack' | 'beat';

// コントロール用の状態の型
export interface ControlState {
  bpm: number;
  timeSignature: number;
  measureCount: number;
  metronomeType: string;
  useAttackSound: boolean;
}

// アプリケーションの設定
export interface AppConfig {
  debug: boolean;
}