/**
 * BeatManagerクラス
 * アプリケーション全体でBPMを管理し、一定間隔でビートイベントを発火する
 * インスタンス化された時点でビート処理を開始する
 * インスタンスの外部からはBPMを変更することができるが、再生停止を行うことはできない
 * ビートイベントはリスナーを登録することで受け取ることができる
 */
export class BeatManager {
  private bpm: number;
  private intervalID: number | null = null;
  private lastBeatTime: number = 0;
  private listeners: Array<() => void> = [];

  // デバッグモード
  private debug: boolean = false;

  /**
   * コンストラクタ
   * @param bpm テンポ (beats per minute)
   * @param debug デバッグモードの有無
   */
  constructor(bpm: number = 120, debug: boolean = false) {
    this.bpm = bpm;
    this.debug = debug;
    
    // インスタンス化時に自動的にビート処理を開始
    this.start();
  }

  /**
   * BPMを設定する
   * @param bpm 新しいBPM値
   */
  setBpm(bpm: number): void {

    this.bpm = bpm;
    this.start(); // BPM変更時にビート処理を再起動

    if (this.debug) {
      console.trace(`BPM changed to ${bpm}`);
    }
  }

  /**
   * 現在のBPMを取得する
   */
  getBpm(): number {
    return this.bpm;
  }

  /**
   * ビート処理を開始する
   */
  private start(): void {
    if (this.intervalID !== null) {
      window.cancelAnimationFrame(this.intervalID);
      this.intervalID = null;
      this.start(); // 再帰的に開始
      return;
    }
    
    // 現在時刻を記録
    this.lastBeatTime = performance.now();
    
    // BPMに基づいてミリ秒単位のインターバルを計算
    const intervalMs = this.calculateIntervalMs();
    
    // Web Audioのような高精度タイミングを実現するためのスケジューリング処理
    const scheduleBeats = () => {
      // 現在時刻
      const now = performance.now();
      // 前回のビートからの経過時間
      const elapsedTime = now - this.lastBeatTime;
      
      // 次のビート時刻をスケジュール
      if (elapsedTime >= intervalMs) {
        // リスナーに通知
        this.notifyListeners();
        
        // 時間を調整（タイマーのドリフトを防止）
        this.lastBeatTime += intervalMs;
        
        // 現在時刻と前回のビート時刻との差が大きすぎる場合（アプリがバックグラウンドに行った場合など）
        // リセットして現在時刻を基準にする
        if (now - this.lastBeatTime > intervalMs * 2) {
          this.lastBeatTime = now;
        }
      }
      
      // 次のスケジューリング
      this.intervalID = window.requestAnimationFrame(scheduleBeats);
    };
    
    // スケジューリングを開始
    this.intervalID = window.requestAnimationFrame(scheduleBeats);

    if (this.debug) {
      console.log(`Beat manager started - BPM: ${this.bpm}`);
    }
  }


  /**
   * ビートイベントのリスナーを追加する
   * @param listener ビートイベントが発生したときに呼び出される関数
   * @returns リスナーを削除するための関数
   */
  addBeatListener(listener: () => void): () => void {
    this.listeners.push(listener);
    
    // リスナーを削除するための関数を返す
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 登録されたすべてのリスナーに通知する
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Beat listener error:', error);
      }
    }
  }

  /**
   * BPMに基づいてミリ秒単位のインターバルを計算する
   */
  private calculateIntervalMs(): number {
    // BPMから1ビートあたりの時間（ミリ秒）を計算
    return (60 / this.bpm) * 1000;
  }

  /**
   * デバッグモードの設定
   */
  setDebug(debug: boolean): void {
    this.debug = debug;
  }

}