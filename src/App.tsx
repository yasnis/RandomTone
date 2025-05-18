import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';

// 音名の配列（シャープとフラットを別々の要素として）
const NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// デバッグモード - 必要に応じてオフにできる
const DEBUG = false;

// 条件付きログ出力ヘルパー関数
const logDebug = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

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
  const [instrumentType, setInstrumentType] = useState<string>('synth');
  const [audioContextReady, setAudioContextReady] = useState<boolean>(false);
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // 音名を切り替える小節数を指定する状態変数を追加
  const [measureCount, setMeasureCount] = useState<number>(1);
  // 現在の小節カウンター
  const currentMeasureRef = useRef<number>(0);
  
  // Tone.jsの参照
  const synthRef = useRef<Tone.Synth | Tone.AMSynth | Tone.FMSynth | Tone.MembraneSynth | null>(null);
  const metronomeRef = useRef<Tone.Synth | Tone.AMSynth | Tone.FMSynth | Tone.MembraneSynth | null>(null);
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
  }, []); // 空の依存配列で最初の一度だけ実行
  
  // 音名を更新する関数
  const updateNotes = useCallback(() => {
    // 現在の小節をインクリメント
    currentMeasureRef.current += 1;
    
    // 指定された小節数に達したときだけ音名を更新
    if (currentMeasureRef.current >= measureCount) {
      setCurrentNote(() => {
        const newCurrent = nextNote || getRandomNote();
        setNextNote(getRandomNote());
        return newCurrent;
      });
      // カウンターをリセット
      currentMeasureRef.current = 0;
    }
  }, [nextNote, getRandomNote, measureCount]);
  
  // 選択された音色タイプに基づいてシンセサイザーを作成する関数
  const createSynth = useCallback((type: string) => {
    let synth;
    
    switch (type) {
      case 'am':
        synth = new Tone.AMSynth({
          oscillator: { type: 'triangle' }
        }).toDestination();
        break;
      case 'fm':
        synth = new Tone.FMSynth({
          oscillator: { type: 'triangle' }
        }).toDestination();
        break;
      case 'membrane':
        synth = new Tone.MembraneSynth({
          octaves: 2,
          pitchDecay: 0.05
        }).toDestination();
        break;
      default:
        synth = new Tone.Synth({
          oscillator: { type: 'triangle' }
        }).toDestination();
        break;
    }
    
    // 音量の調整
    synth.volume.value = -15;
    
    return synth;
  }, []);
  
  // AudioContextの初期化
  const initAudioContext = useCallback(async () => {
    try {
      logDebug('Initializing AudioContext after user gesture');
      
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      } else {
        await Tone.start();
      }
      
      logDebug('AudioContext state:', Tone.context.state);
      
      // 初期音色で両方のシンセサイザーを初期化
      metronomeRef.current = createSynth(instrumentType);
      synthRef.current = createSynth(instrumentType);
      
      // BPMの初期設定
      Tone.Transport.bpm.value = bpm;
      
      setAudioContextReady(true);
      setAudioInitialized(true);
      setAudioError(null);
      
      return true;
    } catch (error) {
      console.error('AudioContextの初期化に失敗しました:', error);
      setAudioError('音声の初期化中にエラーが発生しました。ページを再読み込みして再試行してください。');
      return false;
    }
  }, [bpm, createSynth, instrumentType]);
  
  // BPMが変更されたときの処理
  useEffect(() => {
    if (audioContextReady) {
      try {
        Tone.Transport.bpm.value = bpm;
      } catch (error) {
        console.error('BPM設定中にエラーが発生しました:', error);
      }
    }
  }, [bpm, audioContextReady]);
  
  // 改善されたメトロノームの実装
  const stopMetronome = useCallback(() => {
    // インターバルを停止
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Transportのイベントをクリア
    try {
      // 特定のイベントIDがあればそれだけキャンセル
      if (eventIdRef.current !== null) {
        Tone.Transport.clear(eventIdRef.current);
        eventIdRef.current = null;
      }
      
      Tone.Transport.stop();
      Tone.Transport.cancel(0); // すべてのスケジュールされたイベントをキャンセル
      
    } catch (error) {
      console.error('メトロノーム停止中にエラーが発生しました:', error);
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
    if (!audioContextReady || !metronomeRef.current) return;
    
    try {
      // 既存のメトロノームを停止して完全に新しくする
      stopMetronome();
      
      // 小節カウンターをリセット
      currentMeasureRef.current = 0;
      
      // 音声コンテキストのリセットを試みる
      Tone.context.resume().then(() => {
        logDebug('オーディオコンテキストを再開しました:', Tone.context.state);
      }).catch(err => {
        console.error('オーディオコンテキスト再開中にエラーが発生しました:', err);
      }); // 未処理の例外を防止
      
      // Transportの設定
      Tone.Transport.stop();  // 念のため停止
      Tone.Transport.cancel(0);  // すべてのイベントをクリア
      Tone.Transport.bpm.value = bpm;
      
      // 音名の更新用タイマー - テンポとは独立して一定間隔で更新
      const measureDuration = (60 / bpm) * timeSignature * 1000; // ミリ秒単位の1小節
      
      // 1小節ごとに更新関数を呼び出し（内部で小節数をカウント）
      intervalRef.current = window.setInterval(() => {
        updateNotes();
      }, measureDuration);
      
      // Tone.jsの新しいスケジューリング方法
      let beatCount = 0;
      
      // 単純なワンショットイベントを繰り返し登録する方式に変更
      const scheduleNextBeat = () => {
        const now = Tone.now();
        // 小節の最初の拍は異なる音で
        const note = beatCount % timeSignature === 0 ? 'C5' : 'B4';
        
        // 次の拍を0.1秒後にスケジュール（十分な余裕を持つ）
        const scheduleTime = now + 0.1;
        
        try {
          if (metronomeRef.current) {
            metronomeRef.current.triggerAttackRelease(note, '16n', scheduleTime);
          }
          
          // 小節の先頭で現在の音色をログ出力（デバッグ用）
          if (beatCount % timeSignature === 0 && DEBUG) {
            logDebug('拍:', beatCount, '音色:', instrumentType);
          }
          
          // 次の拍のスケジュール設定
          const nextBeatTime = Tone.Transport.toSeconds('4n'); // 4分音符の長さ
          
          // 次の拍を再スケジュール
          eventIdRef.current = Tone.Transport.scheduleOnce(() => {
            beatCount++;
            scheduleNextBeat();
          }, `+${nextBeatTime}`); // 次の拍の時間を相対的に指定
        } catch (error) {
          console.error('拍のスケジューリングエラー:', error);
        }
      };
      
      // 最初の拍をスケジュール
      scheduleNextBeat();
      
      // Transportを開始
      Tone.Transport.start();
      
    } catch (error) {
      console.error('メトロノーム開始中にエラーが発生しました:', error);
      setAudioError('メトロノームの開始中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }, [audioContextReady, bpm, timeSignature, instrumentType, stopMetronome, updateNotes]);

  // コンポーネントのアンマウント時の処理
  useEffect(() => {
    return () => {
      stopMetronome();
      
      try {
        if (synthRef.current) {
          synthRef.current.dispose();
          synthRef.current = null;
        }
        
        if (metronomeRef.current) {
          metronomeRef.current.dispose();
          metronomeRef.current = null;
        }
        
        if (Tone.Transport.state === 'started') {
          Tone.Transport.stop();
          Tone.Transport.cancel(0); // すべてのスケジュールされたイベントをキャンセル
        }
      } catch (error) {
        console.error('クリーンアップ中にエラーが発生しました:', error);
      }
    };
  }, [stopMetronome]);
  
  // 再生/停止の切り替え
  const togglePlayback = useCallback(async () => {
    // 初回の再生時はオーディオコンテキストを初期化
    if (!audioInitialized) {
      const success = await initAudioContext();
      if (!success) return;
    } else if (!audioContextReady || Tone.context.state !== 'running') {
      try {
        await Tone.context.resume();
        setAudioContextReady(true);
      } catch (error) {
        console.error('AudioContextの再開に失敗しました:', error);
        setAudioError('音声の処理中にエラーが発生しました。再試行してください。');
        return;
      }
    }
    
    try {
      if (isPlaying) {
        stopMetronome();
        setIsPlaying(false);
        
        // 反復処理のタイムアウトをクリア
        if (continuationTimeout) {
          window.clearTimeout(continuationTimeout);
          setContinuationTimeout(null);
        }
      } else {
        startMetronome();
        setIsPlaying(true);
        
        // 5分後に確認ダイアログを表示するタイマーをセット
        startContinuationTimer();
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
  
  // 音色変更ハンドラー
  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!audioContextReady) {
      initAudioContext();
      return;
    }
    
    const value = e.target.value;
    setInstrumentType(value);
    
    try {
      // 両方のシンセサイザーを更新
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      
      if (metronomeRef.current) {
        metronomeRef.current.dispose();
      }
      
      // 新しい音色のシンセサイザーを作成
      synthRef.current = createSynth(value);
      metronomeRef.current = createSynth(value);
      
      logDebug('音色を変更しました:', value);
      
      // 再生中の場合はメトロノームを再起動して新しい音色を即座に反映
      if (isPlaying) {
        stopMetronome();
        // 少し遅延を入れてから再開する
        setTimeout(() => {
          startMetronome();
        }, 100);
      }
    } catch (error) {
      console.error('音色変更中にエラーが発生しました:', error);
      setAudioError('音色の変更中にエラーが発生しました。');
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
              <label htmlFor="instrumentType" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#d1d5db' }}>
                音色
              </label>
              <select
                id="instrumentType"
                value={instrumentType}
                onChange={handleInstrumentChange}
                style={{ width: '100%', background: '#1f2937', border: '1px solid #4b5563', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', color: 'white', outline: 'none' }}
              >
                <option value="synth">Synth</option>
                <option value="am">AM Synth</option>
                <option value="fm">FM Synth</option>
                <option value="membrane">Membrane</option>
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