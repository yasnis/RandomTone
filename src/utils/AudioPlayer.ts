// 使用可能なメトロノーム音のタイプ
export const METRONOME_TYPES = ['type1', 'type2'];

// AudioPlayerクラス - MP3ファイルを再生するためのクラス
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private soundBuffers: Record<string, AudioBuffer> = {};
  private gainNode: GainNode | null = null;
  private metronomeType: string = 'type1'; // デフォルト値
  private volume: number = 0.7; // デフォルトの音量 (0-1)
  private lookaheadTime: number = 0.1; // 先読み時間（秒）
  private scheduleAheadTime: number = 0.2; // スケジューリング先読み時間（秒）
  private lastScheduledTime: number = 0; // 最後にスケジュールした時間
  private nextBeatTime: number = 0; // 次の拍の時間
  private timerID: number | null = null; // スケジューリング用タイマーID

  constructor() {
    // AudioContextはユーザーアクションの後に初期化する必要があるため、constructorでは初期化しない
  }

  // AudioContextを初期化
  async initialize(): Promise<boolean> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.audioContext.destination);
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // 現在時刻を設定
      this.nextBeatTime = this.audioContext.currentTime;
      
      return true;
    } catch (error) {
      console.error('AudioContextの初期化に失敗しました:', error);
      return false;
    }
  }

  // メトロノーム音声ファイルをロード
  async loadSounds(type: string = 'type1'): Promise<boolean> {
    if (!this.audioContext) {
      return false;
    }
    
    try {
      this.metronomeType = type;
      
      // パスをViteの公開ディレクトリ構造に合わせて修正
      const attackBuffer = await this.loadSound(`./assets/sounds/metronome/${type}/attack.mp3`);
      const beatBuffer = await this.loadSound(`./assets/sounds/metronome/${type}/beat.mp3`);
      
      this.soundBuffers = {
        attack: attackBuffer,
        beat: beatBuffer
      };
      
      return true;
    } catch (error) {
      console.error(`メトロノーム音声(${type})のロードに失敗しました:`, error);
      return false;
    }
  }

  // 音声ファイルをロード
  private async loadSound(url: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContextが初期化されていません');
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`音声ファイルのロードに失敗しました: ${url}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  }

  // 音声を特定の時間にスケジュール
  scheduleSound(type: 'attack' | 'beat', time: number): void {
    if (!this.audioContext || !this.gainNode || !this.soundBuffers[type]) {
      return;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = this.soundBuffers[type];
    source.connect(this.gainNode);
    // 指定した時間に音を鳴らす
    source.start(time);
  }

  // 指定したBPMで次の拍のタイミングを取得
  nextBeat(bpm: number): number {
    // 秒単位での拍の間隔を計算
    const beatDuration = 60.0 / bpm;
    // 次の拍の時間を計算
    this.nextBeatTime += beatDuration;
    
    return this.nextBeatTime;
  }

  // 現在の時刻を取得
  getCurrentTime(): number {
    return this.audioContext?.currentTime || 0;
  }

  // 音量を設定
  setVolume(value: number): void {
    if (!this.gainNode) return;
    
    // 0-1の範囲に正規化
    const normalizedVolume = Math.max(0, Math.min(1, value));
    this.volume = normalizedVolume;
    this.gainNode.gain.value = normalizedVolume;
  }

  // オーディオコンテキストの状態を取得
  getState(): string {
    return this.audioContext?.state || 'closed';
  }

  // オーディオコンテキストを一時停止
  suspend(): Promise<void> {
    return this.audioContext?.suspend() || Promise.resolve();
  }

  // オーディオコンテキストを再開
  resume(): Promise<void> {
    return this.audioContext?.resume() || Promise.resolve();
  }

  // スケジューリングをリセット
  resetScheduling(): void {
    if (this.audioContext) {
      this.nextBeatTime = this.audioContext.currentTime;
    }
  }

  // メトロノームタイプを変更
  async changeMetronomeType(type: string): Promise<boolean> {
    if (!METRONOME_TYPES.includes(type)) {
      console.error(`無効なメトロノームタイプ: ${type}`);
      return false;
    }
    
    return await this.loadSounds(type);
  }

  // AudioContextを閉じる
  close(): void {
    this.audioContext?.close();
    this.audioContext = null;
    this.soundBuffers = {};
    this.gainNode = null;
  }
}