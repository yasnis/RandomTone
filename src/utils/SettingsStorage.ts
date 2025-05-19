// 設定保存のためのキー
const STORAGE_KEY = 'randomtone_settings';

// 保存する設定のインターフェース
export interface StoredSettings {
  bpm: number;
  timeSignature: number;
  measureCount: number;
  metronomeType: string;
  useAttackSound: boolean;
}

// デフォルト設定
export const defaultSettings: StoredSettings = {
  bpm: 60,
  timeSignature: 4,
  measureCount: 1,
  metronomeType: 'type1',
  useAttackSound: true
};

/**
 * 設定をLocalStorageに保存する
 */
export const saveSettings = (settings: StoredSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    console.log('設定を保存しました:', settings);
  } catch (error) {
    console.error('設定の保存に失敗しました:', error);
  }
};

/**
 * LocalStorageから設定を読み込む
 */
export const loadSettings = (): StoredSettings => {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings) as StoredSettings;
      // console.log('保存された設定を読み込みました:', parsedSettings);
      return parsedSettings;
    }
  } catch (error) {
    console.error('設定の読み込みに失敗しました:', error);
  }
  
  // 保存された設定がない場合やエラー時はデフォルト値を返す
  console.log('デフォルト設定を使用します');
  return defaultSettings;
};