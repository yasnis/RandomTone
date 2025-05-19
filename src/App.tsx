import React, { useState, useEffect, useCallback, useRef } from 'react';

// 音名の配列（シャープとフラットを別々の要素として）
const NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// デバッグモード - デバッグ出力を確認するためにtrueに設定
const DEBUG = true;

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
    logDebug(`スケジュールされた音: ${soundName}, 時間: ${time.toFixed(3)}`);
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
  const eventIdRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  
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
    
    // コンポーネントのクリーンアップ
    return () => {
      // オーディオプレーヤーをクリーンアップ
      if (audioPlayerRef.current) {
        audioPlayerRef.current.close();
        audioPlayerRef.current = null;
      }
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
  
  // 改善されたメトロノームの実装
  const stopMetronome = useCallback(() => {
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
    
    try {
      // 既存のメトロノームを停止して完全に新しくする
      stopMetronome();
      
      // 小節カウンターをリセット
      currentMeasureRef.current = 0;
      
      // 音声コンテキストの再開を試みる
      audioPlayerRef.current.resume().catch(err => {
        console.error('オーディオコンテキスト再開中にエラーが発生しました:', err);
      });
      
      // スケジューリングをリセット
      audioPlayerRef.current.resetScheduling();
      
      // 小節カウントと拍カウントを初期化
      let beatCount = 0;
      let localMeasureCount = 0;  // 名前を変更してグローバルなmeasureCountと競合しないようにする
      let nextNoteTime = audioPlayerRef.current.getCurrentTime(); // 最初の音のタイミング
      
      // 先読み時間（秒）
      const scheduleAheadTime = 0.1;
      
      // 次の拍をスケジュールするための関数
      const scheduler = () => {
        // 現在のスケジューラが有効かチェック
        if (!audioPlayerRef.current || !isPlaying) {
          return;
        }
        
        // 現在時刻から先読み時間内にスケジュールすべきビートがあるかをチェック
        const currentTime = audioPlayerRef.current.getCurrentTime();
        
        // スケジュール済みの時間が現在時間 + 先読み時間より前であれば、次の拍をスケジュール
        while (nextNoteTime < currentTime + scheduleAheadTime) {
          // 小節の最初の拍かどうかを判定
          const isFirstBeatOfMeasure = beatCount % timeSignature === 0;
          
          // ビートカウントと小節判定のデバッグ出力
          if (DEBUG) {
            console.log(`ビートカウント: ${beatCount}, 小節の1拍目？: ${isFirstBeatOfMeasure}, 小節カウント: ${localMeasureCount}`);
          }
          
          // 小節の最初の拍で小節カウントを更新
          if (isFirstBeatOfMeasure && beatCount > 0) { // beatCount > 0 は初回の処理をスキップするため
            // この行にもデバッグ出力
            console.log(`小節カウント更新: ${localMeasureCount} -> ${localMeasureCount + 1}, ビート=${beatCount}`);
            
            // 小節カウントを増加
            localMeasureCount++;
            
            // 音名の更新が必要かチェック (設定された小節数に達したかどうか)
            if (localMeasureCount >= measureCount) {
              // 音名を更新
              const newCurrent = nextNote || getRandomNote();
              const newNext = getRandomNote();
              
              // 音名更新のタイミングを明示的にログ出力
              console.log(`===音名更新のタイミング: 時間=${nextNoteTime.toFixed(3)}, ビート=${beatCount}===`);
              
              // updateNotesDirectly関数を使って状態を更新
              updateNotesDirectly(newCurrent, newNext);
              
              // カウンターをリセット
              localMeasureCount = 0;
            }
          }
          
          // アタック音を使用するかどうかの設定に基づいて音を選択
          const soundType = (isFirstBeatOfMeasure && useAttackSound) ? 'attack' : 'beat';
          
          // デバッグ用ログ
          if (DEBUG) {
            const beatType = isFirstBeatOfMeasure ? '小節の1拍目' : `${(beatCount % timeSignature) + 1}拍目`;
            logDebug(`スケジュール - ${beatType}, サウンド: ${soundType}, 時間: ${nextNoteTime.toFixed(3)}`);
          }
          
          // 音をスケジュール
          if (audioPlayerRef.current) {
            audioPlayerRef.current.scheduleSound(soundType, nextNoteTime);
          }
          
          // ビートカウントを更新
          beatCount++;
          
          // 次の拍のタイミングを計算
          const secondsPerBeat = 60.0 / bpm;
          nextNoteTime += secondsPerBeat;
        }
        
        // 次のスケジューリングのタイミングを設定
        eventIdRef.current = window.setTimeout(scheduler, 25); // 25msごとにスケジューリングを確認
      };
      
      // スケジューリングを開始
      scheduler();
      
    } catch (error) {
      console.error('メトロノーム開始中にエラーが発生しました:', error);
      setAudioError('メトロノームの開始中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }, [audioContextReady, bpm, timeSignature, stopMetronome, updateNotes, useAttackSound, isPlaying, nextNote, getRandomNote]);
  
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
  
  // 拍子が変更された時の処理
  useEffect(() => {
    // 再生中なら、新しい拍子でメトロノームを再スタート
    if (isPlaying && audioContextReady) {
      stopMetronome();
      // 少し遅延を入れてから再開する
      setTimeout(() => {
        startMetronome();
      }, 100);
    }
  }, [timeSignature, isPlaying, audioContextReady, stopMetronome, startMetronome]);

  // 小節数が変更された時も同様に処理
  useEffect(() => {
    if (isPlaying && audioContextReady) {
      stopMetronome();
      setTimeout(() => {
        startMetronome();
      }, 100);
    }
  }, [measureCount, isPlaying, audioContextReady, stopMetronome, startMetronome]);
  
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

  // 音名を更新する関数 - スケジューラー内で直接呼び出す
  const updateNotesDirectly = useCallback((newCurrent: string, newNext: string) => {
    // フラグを使用して状態更新中であることをマーク
    const isUpdating = true;
    
    // setTimeout を使わず直接更新
    setCurrentNote(prevCurrent => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevCurrent === newCurrent) return prevCurrent;
      return newCurrent;
    });
    
    setNextNote(prevNext => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevNext === newNext) return prevNext;
      return newNext;
    });
    
    if (DEBUG) {
      console.log(`音名を直接更新: 現在の音名=${newCurrent}, 次の音名=${newNext}`);
    }
  }, []);

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

        {/* コントロール部分 */}
        <div style={{ width: '100%', background: '#333', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="bpm" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#d1d5db' }}>
              テンポ: {bpm} BPM
            </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>20</span>
              <input
                id="bpm"
                type="range"
                min="20"
                max="240"
                value={bpm}
                onChange={handleBpmChange}
                style={{ width: '100%', height: '0.5rem', background: '#4b5563', borderRadius: '0.5rem', cursor: 'pointer', accentColor: '#8b5cf6' }}
              />
              <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>240</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label htmlFor="timeSignature" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#d1d5db' }}>
                拍子
              </label>
              <select
                id="timeSignature"
                value={timeSignature}
                onChange={handleTimeSignatureChange}
                style={{ width: '100%', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', color: 'white', outline: 'none' }}
              >
                <option value="2">2/4</option>
                <option value="3">3/4</option>
                <option value="4">4/4</option>
                <option value="5">5/4</option>
                <option value="6">6/8</option>
                <option value="7">7/8</option>
              </select>
            </div>

            <div>
              <label htmlFor="metronomeType" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#d1d5db' }}>
                メトロノーム音
              </label>
              <select
                id="metronomeType"
                value={metronomeType}
                onChange={handleMetronomeTypeChange}
                style={{ width: '100%', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', color: 'white', outline: 'none' }}
              >
                <option value="type1">タイプ1</option>
                <option value="type2">タイプ2</option>
              </select>
            </div>
          </div>

          {/* 小節数選択コントロールを追加 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="measureCount" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#d1d5db' }}>
              切り替え小節数: {measureCount}小節ごと
            </label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>1</span>
              <input
                id="measureCount"
                type="range"
                min="1"
                max="8"
                value={measureCount}
                onChange={(e) => setMeasureCount(parseInt(e.target.value, 10))}
                style={{ width: '100%', height: '0.5rem', background: '#4b5563', borderRadius: '0.5rem', cursor: 'pointer', accentColor: '#8b5cf6' }}
              />
              <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>8</span>
            </div>
          </div>

          {/* アタック音設定用チェックボックスを追加 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useAttackSound}
                onChange={(e) => setUseAttackSound(e.target.checked)}
                style={{ marginRight: '0.5rem', width: '1rem', height: '1rem', accentColor: '#8b5cf6' }}
              />
              <span style={{ fontSize: '0.875rem', color: '#d1d5db' }}>1拍目のアクセント音を使用する</span>
            </label>
          </div>

          <button
            onClick={togglePlayback}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s',
              background: isPlaying
                ? 'linear-gradient(to right, #ef4444, #dc2626)'
                : 'linear-gradient(to right, #8b5cf6, #6366f1)',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} viewBox="0 0 20 20" fill="currentColor">
                    <rect x="6" y="4" width="3" height="12" fill="currentColor" />
                    <rect x="11" y="4" width="3" height="12" fill="currentColor" />
                  </svg>
                  停止
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  再生
                </>
              )}
            </div>
          </button>
        </div>

        <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#9ca3af' }}>
          <p style={{ textAlign: 'center' }}>スペースキーで再生/停止を切り替え</p>
          <p style={{ textAlign: 'center' }}>↑/↓キーでテンポを調整</p>
          <p style={{ textAlign: 'center' }}>←/→キーで切り替え小節数を調整</p>
        </div>
      </main>

      <footer style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
        <p>© 2025 RandomTone</p>
      </footer>

      {/* 反復処理の継続確認ダイアログ */}
      {showContinueDialog && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 50 }}>
          <div style={{ background: '#1f2937', borderRadius: '0.5rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)', padding: '1.5rem', maxWidth: '24rem', width: '100%' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>処理の継続確認</h2>
            <p style={{ fontSize: '0.875rem', color: '#d1d5db', marginBottom: '1rem', textAlign: 'center' }}>
              処理を続行しますか？
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={handleContinue}
                style={{ flex: 1, background: '#8b5cf6', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background 0.3s' }}
              >
                続行
              </button>
              <button
                onClick={handleStop}
                style={{ flex: 1, background: '#ef4444', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background 0.3s' }}
              >
                停止
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;