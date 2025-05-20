// 使用可能なメトロノーム音のタイプ
export const METRONOME_TYPES = ['type1', 'type2'];

// グローバルAudioContextとインスタンス数のカウンター
let sharedAudioContext: AudioContext | null = null;
let instanceCount = 0;
let isClosing = false;

// AudioPlayerクラス - MP3ファイルを再生するためのクラス
export class AudioPlayer {
  private soundBuffers: Record<string, AudioBuffer> = {};
  private gainNode: GainNode | null = null;
  private metronomeType: string = 'type1'; // デフォルト値
  private volume: number = 0.7; // デフォルトの音量 (0-1)
  private lookaheadTime: number = 0.1; // 先読み時間（秒）
  private scheduleAheadTime: number = 0.2; // スケジューリング先読み時間（秒）
  private lastScheduledTime: number = 0; // 最後にスケジュールした時間
  private nextBeatTime: number = 0; // 次の拍の時間
  private timerID: number | null = null; // スケジューリング用タイマーID
  private initializationPromise: Promise<boolean> | null = null; // 初期化プロミスを保持
  private instanceId: number;
  private closed = false;

  constructor() {
    // インスタンスをカウントして一意のIDを割り当て
    this.instanceId = ++instanceCount;
    console.log(`AudioPlayer インスタンス作成 (ID: ${this.instanceId}, 合計: ${instanceCount})`);
    // AudioContextはユーザーアクションの後に初期化する必要があるため、constructorでは初期化しない
  }

  // AudioContextを取得（共有）
  private get audioContext(): AudioContext | null {
    return sharedAudioContext;
  }

  // AudioContextを初期化
  async initialize(): Promise<boolean> {
    // すでに初期化中の場合は既存のプロミスを返す
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 新しい初期化プロミスを作成
    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  // 実際の初期化ロジック（privateメソッド）
  private async _initialize(): Promise<boolean> {
    try {
      if (!sharedAudioContext) {
        console.log('新しいAudioContextを作成しています');
        // AudioContextの作成を明示的にtry-catchで囲む
        try {
          sharedAudioContext = new AudioContext();
        } catch (err) {
          console.error('AudioContextの作成に失敗しました:', err);
          throw err;
        }
      }
      
      if (sharedAudioContext.state === 'suspended') {
        console.log('AudioContextを再開しています...');
        await sharedAudioContext.resume();
        console.log('AudioContext再開完了:', sharedAudioContext.state);
      }
      
      // GainNodeを作成
      if (!this.gainNode && sharedAudioContext) {
        this.gainNode = sharedAudioContext.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(sharedAudioContext.destination);
      }
      
      // 現在時刻を設定
      if (sharedAudioContext) {
        this.nextBeatTime = sharedAudioContext.currentTime;
      }
      
      console.log('AudioContextの初期化が完了しました。状態:', sharedAudioContext?.state);
      return true;
    } catch (error) {
      console.error('AudioContextの初期化に失敗しました:', error);
      this.initializationPromise = null; // エラー時にプロミスをリセット
      return false;
    }
  }

  // メトロノーム音声ファイルをロード
  async loadSounds(type: string = 'type1'): Promise<boolean> {
    if (!this.audioContext) {
      console.error('AudioContextが初期化されていないため、音声をロードできません');
      return false;
    }
    
    try {
      this.metronomeType = type;
      
      // AudioContextの状態を確認
      if (this.audioContext.state !== 'running') {
        console.log('AudioContextが実行状態ではありません。状態:', this.audioContext.state);
        try {
          await this.audioContext.resume();
          console.log('AudioContextを再開しました。状態:', this.audioContext.state);
        } catch (err) {
          console.error('AudioContextの再開に失敗しました:', err);
        }
      }
      
      console.log('音声ファイルのロードを開始します');
      
      // 前回のロード結果をクリア
      this.soundBuffers = {};
      
      // パスを修正: Viteでは public フォルダがルートとなる
      const [attackBuffer, beatBuffer] = await Promise.all([
        this.loadSound(`/assets/sounds/metronome/${type}/attack.mp3`),
        this.loadSound(`/assets/sounds/metronome/${type}/beat.mp3`)
      ]);
      
      this.soundBuffers = {
        attack: attackBuffer,
        beat: beatBuffer
      };
      
      console.log('メトロノーム音声のロードに成功しました:', Object.keys(this.soundBuffers));
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
    
    console.log(`音声ファイルのロード開始: ${url}`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`音声ファイルのロード失敗: ${url}`, response.status, response.statusText);
        throw new Error(`音声ファイルのロードに失敗しました: ${url} (${response.status} ${response.statusText})`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`音声ファイルのデコード開始: ${url}, サイズ: ${arrayBuffer.byteLength} bytes`);
      
      // decodeAudioDataをPromise化して明示的にエラーハンドリング
      const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
        this.audioContext!.decodeAudioData(
          arrayBuffer,
          buffer => resolve(buffer),
          error => reject(new Error(`音声データのデコードに失敗しました: ${error}`))
        );
      });
      
      console.log(`音声ファイルのデコード完了: ${url}, 長さ: ${audioBuffer.duration.toFixed(2)}秒`);
      return audioBuffer;
    } catch (error) {
      console.error(`音声ファイル処理中にエラーが発生しました (${url}):`, error);
      throw error;
    }
  }

  // 音声バッファが正常にロードされているかチェック
  soundBuffersExist(): boolean {
    return !!this.soundBuffers['attack'] && !!this.soundBuffers['beat'];
  }

  // 音声を特定の時間にスケジュール
  scheduleSound(type: 'attack' | 'beat', time: number): void {
    if (!this.audioContext || !this.gainNode) {
      console.error('AudioContextまたはGainNodeが初期化されていません');
      return;
    }
    
    if (!this.soundBuffers[type]) {
      console.error(`サウンドバッファが見つかりません: ${type}`);
      console.log('利用可能なバッファ:', Object.keys(this.soundBuffers));
      return;
    }
    
    try {
      // 再生中にAudioContextが一時停止された場合に備えてチェック
      if (this.audioContext.state !== 'running') {
        console.log('AudioContextが実行状態ではありません。再開を試みます...');
        this.audioContext.resume().catch(err => {
          console.error('AudioContext再開中にエラーが発生しました:', err);
        });
      }
      
      const source = this.audioContext.createBufferSource();
      source.buffer = this.soundBuffers[type];
      source.connect(this.gainNode);
      
      // 指定した時間が過去の場合は、現在時刻に調整
      const actualTime = time < this.audioContext.currentTime 
        ? this.audioContext.currentTime 
        : time;
      
      // 音を鳴らす
      source.start(actualTime);
      console.log(`音声再生開始: タイプ=${type}, 時間=${actualTime.toFixed(3)}`);
    } catch (error) {
      console.error('音声再生中にエラーが発生しました:', error);
    }
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
    if (!this.audioContext) {
      console.warn('AudioContextがありません。現在時刻を0として返します。');
      return 0;
    }
    return this.audioContext.currentTime;
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
  async suspend(): Promise<void> {
    if (!this.audioContext) {
      console.warn('AudioContextが初期化されていません');
      return Promise.resolve();
    }
    
    try {
      await this.audioContext.suspend();
      console.log('AudioContextを一時停止しました');
      return Promise.resolve();
    } catch (err) {
      console.error('AudioContextの一時停止中にエラーが発生しました:', err);
      return Promise.reject(err);
    }
  }

  // オーディオコンテキストを再開
  async resume(): Promise<void> {
    if (!this.audioContext) {
      console.warn('AudioContextが初期化されていません');
      return Promise.resolve();
    }
    
    try {
      await this.audioContext.resume();
      console.log('AudioContextを再開しました');
      return Promise.resolve();
    } catch (err) {
      console.error('AudioContextの再開中にエラーが発生しました:', err);
      return Promise.reject(err);
    }
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

  // AudioContextの状態をデバッグ出力
  debugState(): Record<string, any> {
    return {
      contextExists: !!this.audioContext,
      contextState: this.audioContext?.state,
      gainNodeExists: !!this.gainNode,
      buffers: {
        attackExists: !!this.soundBuffers['attack'],
        beatExists: !!this.soundBuffers['beat'],
        attackLength: this.soundBuffers['attack']?.length || 0,
        beatLength: this.soundBuffers['beat']?.length || 0
      },
      volume: this.volume,
      metronomeType: this.metronomeType
    };
  }

  // AudioContextを閉じる
  async close(): Promise<void> {
    if (this.closed) {
      console.log(`AudioPlayer(ID: ${this.instanceId})は既に閉じられています`);
      return;
    }
    
    this.closed = true;
    // インスタンスカウントを減らす
    instanceCount--;
    console.log(`AudioPlayer(ID: ${this.instanceId})を閉じます。残りのインスタンス数: ${instanceCount}`);
    
    // GainNodeを切断
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    // すべてのサウンドバッファをクリア
    this.soundBuffers = {};
    this.initializationPromise = null;
    
    // すべてのインスタンスが終了した場合にのみAudioContextを閉じる
    if (instanceCount <= 0 && sharedAudioContext && !isClosing) {
      try {
        isClosing = true;
        console.log('すべてのインスタンスが閉じられたため、共有AudioContextを閉じます');
        await sharedAudioContext.close();
        console.log('AudioContextを閉じました');
        sharedAudioContext = null;
      } catch (err) {
        console.error('AudioContextを閉じる際にエラーが発生しました:', err);
      } finally {
        isClosing = false;
      }
    }
  }
}