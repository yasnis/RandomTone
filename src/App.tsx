import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BeatManager } from './BeatManager';

// 音名の配列（シャープとフラットを別々の要素として）
const NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// デバッグモード - デバッグ出力を確認するためにtrueに設定
const DEBUG = false;

// 条件付きログ出力ヘルパー関数
const logDebug = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// 使用可能なメトロノーム音のタイプ
const METRONOME_TYPES = ['type1', 'type2'];

// AudioPlayerクラス - MP3ファイルを再生するためのクラス
class AudioPlayer {
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
      
      // メトロノーム音声をロード
      const attackBuffer = await this.loadSound(`/assets/sounds/metronome/${type}/attack.mp3`);
      const beatBuffer = await this.loadSound(`/assets/sounds/metronome/${type}/beat.mp3`);
      
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
    
    // デバッグ用ログ
    const soundName = type === 'attack' ? 'アタック音' : 'ビート音';
    // logDebug(`スケジュールされた音: ${soundName}, 時間: ${time.toFixed(3)}`);
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

const App: React.FC = () => {
  // 状態変数
  const [bpm, setBpm] = useState<number>(60);
  const [timeSignature, setTimeSignature] = useState<number>(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [continuationTimeout, setContinuationTimeout] = useState<number | null>(null);
  // 明示的に初期値を設定して音名表示が確実に初期化されるようにする
  const [currentNote, setCurrentNote] = useState<string>('C');
  const [nextNote, setNextNote] = useState<string>('G');
  const [metronomeType, setMetronomeType] = useState<string>('type1');
  const [audioContextReady, setAudioContextReady] = useState<boolean>(false);
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // 音名を切り替える小節数を指定する状態変数を追加
  const [measureCount, setMeasureCount] = useState<number>(1);
  // アタック音の有無を設定する状態変数を追加
  const [useAttackSound, setUseAttackSound] = useState<boolean>(true);
  // 現在の小節カウンター
  const currentMeasureRef = useRef<number>(0);
  
  // オーディオプレーヤーの参照
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  // BeatManagerの参照を追加
  const beatManagerRef = useRef<BeatManager | null>(null);
  const eventIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  // ビートリスナーの削除用関数を保持する
  const beatListenerCleanupRef = useRef<(() => void) | null>(null);
  
  // ランダムな音名を取得する関数
  const getRandomNote = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * NOTES.length);
    return NOTES[randomIndex];
  }, []);
  
  // コンポーネントマウント時に音名を更新する - 初期値を上書きするようにする
  useEffect(() => {
    // コンポーネントマウント時に初期値をランダムに設定
    setCurrentNote(getRandomNote());
    setNextNote(getRandomNote());
    console.log('音名が初期化されました');
    
    // AudioPlayerインスタンスを作成
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioPlayer();
    }
    
    // BeatManagerインスタンスを作成
    if (!beatManagerRef.current) {
      // BPMを設定して初期化
      beatManagerRef.current = new BeatManager(bpm, DEBUG);
    }
    
    // コンポーネントのクリーンアップ
    return () => {
      // BeatManagerのリスナーをクリーンアップ
      if (beatListenerCleanupRef.current) {
        beatListenerCleanupRef.current();
        beatListenerCleanupRef.current = null;
      }
      
      // オーディオプレーヤーをクリーンアップ
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close();
        audioPlayerRef.current = null;
      }
      
      // BeatManagerの参照をクリア
      beatManagerRef.current = null;
    };
  }, []); // 空の依存配列で最初の一度だけ実行
  
  // 音名を更新する関数
  const updateNotes = useCallback(() => {
    // 現在の小節をインクリメント
    currentMeasureRef.current += 1;
    
    // 指定された小節数に達したときだけ音名を更新
    if (currentMeasureRef.current >= measureCount) {
      // バッチ更新を使用して両方の状態を一度に更新
      // これにより不要な再レンダリングを減らす
      const newCurrent = nextNote || getRandomNote();
      const newNext = getRandomNote();
      
      // フラグを使用して音名の更新を他のロジックから分離
      const isUpdatingNotes = true;
      
      // 状態更新をバッチ処理
      setCurrentNote(newCurrent);
      setNextNote(newNext);
      
      // カウンターをリセット
      currentMeasureRef.current = 0;
      
      if (DEBUG) {
        console.log(`音名を更新: 現在の音名=${newCurrent}, 次の音名=${newNext}`);
      }
    }
  }, [nextNote, getRandomNote, measureCount]);
  
  // AudioContextの初期化
  const initAudioContext = useCallback(async () => {
    try {
      logDebug('Initializing AudioContext after user gesture');
      
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new AudioPlayer();
      }
      
      // AudioContextを初期化
      const initSuccess = await audioPlayerRef.current.initialize();
      if (!initSuccess) {
        throw new Error('AudioContextの初期化に失敗しました');
      }
      
      // メトロノーム音声をロード
      const loadSuccess = await audioPlayerRef.current.loadSounds(metronomeType);
      if (!loadSuccess) {
        throw new Error('メトロノーム音声のロードに失敗しました');
      }
      
      logDebug('AudioContext state:', audioPlayerRef.current.getState());
      
      setAudioContextReady(true);
      setAudioInitialized(true);
      setAudioError(null);
      
      return true;
    } catch (error) {
      console.error('AudioContextの初期化に失敗しました:', error);
      setAudioError('音声の初期化中にエラーが発生しました。ページを再読み込みして再試行してください。');
      return false;
    }
  }, [metronomeType]);
  
  // 音名を更新する関数 - スケジューラー内で直接呼び出す
  const updateNotesDirectly = useCallback((newCurrent: string, newNext: string) => {
    console.log(`updateNotesDirectly呼び出し: newCurrent=${newCurrent}, newNext=${newNext}`);
    
    // setTimeout を使わず直接更新
    setCurrentNote(prevCurrent => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevCurrent === newCurrent) {
        console.log('現在の音名が同じため更新しません:', prevCurrent);
        return prevCurrent;
      }
      console.log(`現在の音名を更新: ${prevCurrent} -> ${newCurrent}`);
      return newCurrent;
    });
    
    setNextNote(prevNext => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevNext === newNext) {
        console.log('次の音名が同じため更新しません:', prevNext);
        return prevNext;
      }
      console.log(`次の音名を更新: ${prevNext} -> ${newNext}`);
      return newNext;
    });
    
    if (DEBUG) {
      console.log(`音名を直接更新: 現在の音名=${newCurrent}, 次の音名=${newNext}`);
    }
  }, []);

  // 改善されたメトロノームの実装
  const stopMetronome = useCallback(() => {
    // console.trace('\tメトロノームを停止します');
    // インターバルを停止
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // タイマーをクリア
    if (eventIdRef.current !== null) {
      window.clearTimeout(eventIdRef.current);
      eventIdRef.current = null;
    }
    
    // BeatManagerのリスナーをクリーンアップ
    if (beatListenerCleanupRef.current) {
      beatListenerCleanupRef.current();
      beatListenerCleanupRef.current = null;
    }
  }, []);
  
  // 継続確認タイマーをスタートする関数
  const startContinuationTimer = useCallback(() => {
    // 前のタイマーがあれば解除
    if (continuationTimeout) {
      clearTimeout(continuationTimeout);
    }
    
    // 5分後に確認ダイアログを表示するタイマーをセット（300000ミリ秒 = 5分）
    const timeout = setTimeout(() => {
      // 再生が進行中の場合のみダイアログを表示
      if (isPlaying) {
        // 再生を一時停止
        stopMetronome();
        setIsPlaying(false);
        setShowContinueDialog(true);
      }
    }, 300000);
    
    setContinuationTimeout(timeout);
  }, [continuationTimeout, isPlaying, stopMetronome]);
  
  // メトロノームを開始する関数
  const startMetronome = useCallback(() => {
    if (!audioContextReady || !audioPlayerRef.current) return;
    if (DEBUG) {
        console.trace('\tメトロノームを開始します');
    }
    try {
      // 既存のメトロノームを停止して完全に新しくする
      stopMetronome();
      
      // 小節カウンターをリセット
      currentMeasureRef.current = 0;
      
      // 音声コンテキストの再開を試みる
      audioPlayerRef.current.resume().catch(err => {
        console.error('オーディオコンテキスト再開中にエラーが発生しました:', err);
      });
      
      // BeatManagerが存在しない場合は新しく作成
      if (!beatManagerRef.current) {
        beatManagerRef.current = new BeatManager(bpm, DEBUG);
      } else {
        // 既存のBeatManagerのBPMを更新
        beatManagerRef.current.setBpm(bpm);
      }
      
      // 小節カウントと拍カウントを初期化
      let beatCount = timeSignature - 1; // 1小節内の拍カウント (0から始まり timeSignature - 1 まで)
      let localMeasureCount = 0;  // 名前を変更してグローバルなmeasureCountと競合しないようにする
      
      // 以前のリスナーが存在する場合はクリア
      if (beatListenerCleanupRef.current) {
        beatListenerCleanupRef.current();
        beatListenerCleanupRef.current = null;
      }
      
      // 現在の音名と次の音名を直接取得（クロージャの問題を回避）
      const currentNoteAtStart = currentNote;
      let nextNoteAtStart = nextNote;
      
      // BeatManagerにビートイベントリスナーを登録
      beatListenerCleanupRef.current = beatManagerRef.current.addBeatListener(() => {
        // ビートカウントを更新
        beatCount = (beatCount + 1) % timeSignature;

        // 小節の最初の拍かどうかを判定
        const isFirstBeatOfMeasure = beatCount === 0;
        
        // ビートカウントと小節判定のデバッグ出力
        if (DEBUG) {
          console.log(`ビートカウント: ${beatCount}, 小節の1拍目？: ${isFirstBeatOfMeasure}, 小節カウント: ${localMeasureCount}`);
        }

        // 小節の最初の拍のときに小節カウントを増加
        if (isFirstBeatOfMeasure) {
          // 小節カウントを増加
          localMeasureCount++;
          
          // 小節カウントのデバッグ出力
          if (DEBUG) {
            console.log(`小節カウント更新: ${localMeasureCount}`);
          }
          
          // 指定された小節数に達した場合に音名を更新
          if (localMeasureCount >= measureCount) {
            // 音名を更新
            const newCurrentNote = nextNoteAtStart || getRandomNote();
            const newNextNote = getRandomNote();
            nextNoteAtStart = newNextNote;

            // 直接状態を更新
            setCurrentNote(newCurrentNote);
            setNextNote(newNextNote);
            
            // カウンターをリセット
            localMeasureCount = 0;
          }
        }
        
        // アタック音を使用するかどうかの設定に基づいて音を選択
        const soundType = (isFirstBeatOfMeasure && useAttackSound) ? 'attack' : 'beat';
        
        // 音を再生
        if (audioPlayerRef.current) {
          audioPlayerRef.current.scheduleSound(soundType, audioPlayerRef.current.getCurrentTime());
        }
      });
      
    } catch (error) {
      console.error('メトロノーム開始中にエラーが発生しました:', error);
      setAudioError('メトロノームの開始中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }, [audioContextReady, bpm, timeSignature, useAttackSound, measureCount]);
  
  // コンポーネントのアンマウント時の処理
  useEffect(() => {
    return () => {
      stopMetronome();
      
      // オーディオプレーヤーをクリーンアップ
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close();
        audioPlayerRef.current = null;
      }
    };
  }, [stopMetronome]);
  
  // 再生/停止の切り替え
  const togglePlayback = useCallback(async () => {
    // 初回の再生時はオーディオコンテキストを初期化
    if (!audioInitialized) {
      const success = await initAudioContext();
      if (!success) return;
    } else if (!audioContextReady || (audioPlayerRef.current && audioPlayerRef.current.getState() !== 'running')) {
      try {
        if (audioPlayerRef.current) {
          await audioPlayerRef.current.resume();
        }
        setAudioContextReady(true);
      } catch (error) {
        console.error('AudioContextの再開に失敗しました:', error);
        setAudioError('音声の処理中にエラーが発生しました。再試行してください。');
        return;
      }
    }
    
    try {
      if (isPlaying) {
        // まず再生状態を更新してからメトロノームを停止
        setIsPlaying(false);
        stopMetronome();
        
        // 反復処理のタイムアウトをクリア
        if (continuationTimeout) {
          window.clearTimeout(continuationTimeout);
          setContinuationTimeout(null);
        }
      } else {
        // まず再生状態を更新してからメトロノームを開始
        setIsPlaying(true);
        // わずかな遅延を入れて状態更新が反映されるのを待つ
        setTimeout(() => {
          startMetronome();
          // 5分後に確認ダイアログを表示するタイマーをセット
          startContinuationTimer();
        }, 10);
      }
    } catch (error) {
      console.error('再生/停止中にエラーが発生しました:', error);
      setAudioError('音声処理中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }, [audioContextReady, audioInitialized, initAudioContext, isPlaying, startMetronome, stopMetronome, continuationTimeout, startContinuationTimer]);
  
  // 反復処理の継続を処理する関数
  const handleContinuePlayback = useCallback((shouldContinue: boolean) => {
    setShowContinueDialog(false);
    
    if (shouldContinue) {
      // 再生を継続し、新しいタイマーをセット
      setIsPlaying(true);
      startMetronome();
      startContinuationTimer();
    } else {
      // 再生を停止
      setIsPlaying(false);
      stopMetronome();
    }
  }, [setIsPlaying, startMetronome, stopMetronome, startContinuationTimer]);
  
  // 反復処理を続行する
  const handleContinue = () => {
    handleContinuePlayback(true);
  };

  // 反復処理を終了する
  const handleStop = () => {
    handleContinuePlayback(false);
  };
  
  // 拍子または小節数が変更された時の処理
  useEffect(() => {
    // 再生中なら、新しい設定でメトロノームを再スタート
    if (isPlaying && audioContextReady) {
    //   stopMetronome();
      // 少し遅延を入れてから再開する
      setTimeout(() => {
        startMetronome();
      }, 100);
    }
  }, [timeSignature, isPlaying, audioContextReady, stopMetronome, startMetronome]);

  // キーボードショートカットの設定
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      
      if (e.code === 'ArrowUp') {
        setBpm(prev => Math.min(prev + 5, 240));
      }
      if (e.code === 'ArrowDown') {
        setBpm(prev => Math.max(prev - 5, 20));
      }
      
      // 左右矢印キーで小節数を調整する機能を追加
      if (e.code === 'ArrowRight') {
        setMeasureCount(prev => Math.min(prev + 1, 8));
      }
      if (e.code === 'ArrowLeft') {
        setMeasureCount(prev => Math.max(prev - 1, 1));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayback]);
  
  // BPM調整ハンドラー
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBpm(value);
    
    // BeatManagerにもBPMを設定
    if (beatManagerRef.current) {
      beatManagerRef.current.setBpm(value);
    }
    
    // 再生中ならメトロノームを再起動（少し遅延を入れる）
    if (isPlaying && audioContextReady) {
      stopMetronome();
      // 少し遅延を入れてから再開する
      setTimeout(() => {
        startMetronome();
      }, 100);
    }
  };
  
  // 拍子調整ハンドラー
  const handleTimeSignatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setTimeSignature(value);
  };
  
  // 小節数調整ハンドラー
  const handleMeasureCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setMeasureCount(value);
  };
  
  // メトロノームタイプ変更ハンドラー
  const handleMetronomeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setMetronomeType(newType);
    
    if (!audioContextReady) {
      return;
    }
    
    try {
      // 音声を切り替え
      if (audioPlayerRef.current) {
        audioPlayerRef.current.changeMetronomeType(newType).then(success => {
          if (!success) {
            console.error(`メトロノームタイプの変更に失敗しました: ${newType}`);
          } else {
            logDebug(`メトロノームタイプを変更しました: ${newType}`);
          }
          
          // 再生中の場合はメトロノームを再起動して新しい音声を即座に反映
          if (isPlaying) {
            stopMetronome();
            setTimeout(() => {
              startMetronome();
            }, 100);
          }
        });
      }
    } catch (error) {
      console.error('メトロノームタイプ変更中にエラーが発生しました:', error);
      setAudioError('メトロノームタイプの変更中にエラーが発生しました。');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #121212, #1e1e1e)', color: 'white', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1.5rem 1rem', background: '#1a1a1a', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', textAlign: 'center', background: 'linear-gradient(to right, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>RandomTone</h1>
      </header>
      
      <main style={{ flex: 1, margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: '28rem' }}>
        {audioError && (
          <div style={{ width: '100%', background: '#ef4444', color: 'white', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ marginBottom: '0.5rem' }}>{audioError}</div>
            <button 
              style={{ background: 'white', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
              onClick={() => window.location.reload()}>
                再読み込み
            </button>
          </div>
        )}
        
        {/* メインの音名表示領域 */}
        <div style={{ width: '100%', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '6rem', fontWeight: 'bold', marginBottom: '1rem', padding: '3rem 0', background: '#333', borderRadius: '0.75rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {currentNote || '準備中...'}
          </div>
        </div>
        
        {/* 次の音名 - メインの音名の後に表示 */}
        <div style={{ width: '100%', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Next</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', background: '#333', padding: '1rem 2rem', borderRadius: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            {nextNote || '...'}
          </div>
        </div>
        
        {/* コントロールパネル */}
        <div style={{ width: '100%', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* BPMコントロール */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#333', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>BPM</div>
            <input 
              type="range" 
              min="20" 
              max="240" 
              value={bpm} 
              onChange={handleBpmChange}
              style={{ 
                appearance: 'none',
                width: '100%',
                height: '0.25rem',
                background: 'linear-gradient(to right, #a855f7, #ec4899)',
                borderRadius: '0.125rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '1.25rem' }}>{bpm}</div>
          </div>
          
          {/* 拍子コントロール */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#333', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Time Signature</div>
            <select 
              value={timeSignature} 
              onChange={handleTimeSignatureChange}
              style={{ 
                background: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              <option value={4}>4/4</option>
              <option value={3}>3/4</option>
              <option value={6}>6/8</option>
              <option value={5}>5/4</option>
            </select>
          </div>
          
          {/* 小節数コントロール */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#333', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Measures per Tone</div>
            <select 
              value={measureCount} 
              onChange={handleMeasureCountChange}
              style={{ 
                background: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(count => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>
          
          {/* メトロノームタイプコントロール */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#333', padding: '1rem', borderRadius: '0.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Metronome Type</div>
            <select 
              value={metronomeType} 
              onChange={handleMetronomeTypeChange}
              style={{ 
                background: 'transparent',
                color: 'white',
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              <option value="type1">Type 1</option>
              <option value="type2">Type 2</option>
            </select>
          </div>
        </div>
        
        {/* 再生/停止ボタン */}
        <button 
          onClick={togglePlayback}
          style={{ 
            background: isPlaying ? '#ef4444' : '#4caf50',
            color: 'white',
            padding: '1rem 2rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            width: '100%',
            transition: 'background 0.3s'
          }}
        >
          {isPlaying ? '停止' : '再生'}
        </button>
        
        {/* 継続確認ダイアログ */}
        {showContinueDialog && (
          <div style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)', 
            background: '#1a1a1a', 
            padding: '2rem', 
            borderRadius: '0.5rem', 
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)', 
            zIndex: 1000,
            width: '90vw',
            maxWidth: '400px'
          }}>
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>再生を続けますか？</div>
              <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>5分経過しました。続ける場合は「はい」をクリックしてください。</div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                onClick={handleContinue}
                style={{ 
                  background: '#4caf50', 
                  color: 'white', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '0.375rem', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '1rem', 
                  fontWeight: '500', 
                  flex: 1, 
                  marginRight: '0.5rem',
                  transition: 'background 0.3s'
                }}
              >
                はい
              </button>
              <button 
                onClick={handleStop}
                style={{ 
                  background: '#ef4444', 
                  color: 'white', 
                  padding: '0.75rem 1.5rem', 
                  borderRadius: '0.375rem', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '1rem', 
                  fontWeight: '500', 
                  flex: 1,
                  transition: 'background 0.3s'
                }}
              >
                いいえ
              </button>
            </div>
          </div>
        )}
        
        {/* フッター */}
        <footer style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: '#9ca3af', marginTop: 'auto' }}>
          <div>© 2023 RandomTone. All rights reserved.</div>
        </footer>
      </main>
    </div>
  );
}

export default App;
