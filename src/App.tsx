import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BeatManager } from './utils/BeatManager';
import { AudioPlayer } from './utils/AudioPlayer';
import { NOTES } from './types/index';

// コンポーネントをインポート
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorMessage from './components/ErrorMessage';
import NoteDisplay from './components/NoteDisplay';
import MetronomeControls from './components/MetronomeControls';
import ContinueDialog from './components/ContinueDialog'; // ContinueDialogコンポーネントをインポート

// 設定の保存/読み込み機能をインポート
import { loadSettings, saveSettings, defaultSettings } from './utils/SettingsStorage';

// 設定データの型定義
type StoredSettings = {
  bpm: number;
  timeSignature: number;
  measureCount: number;
  metronomeType: string;
  useAttackSound: boolean;
};

// AppConfig型をインライン定義
interface AppConfig {
  debug: boolean;
}

// アプリケーション設定
const appConfig: AppConfig = {
  debug: false
};

// 条件付きログ出力ヘルパー関数
const logDebug = (...args: any[]) => {
  if (appConfig.debug) {
    console.log(...args);
  }
};

const App: React.FC = () => {
  // 保存された設定を読み込む
  const savedSettings = loadSettings();

  // 状態変数（保存された設定で初期化）
  const [bpm, setBpm] = useState<number>(savedSettings.bpm);
  const [timeSignature, setTimeSignature] = useState<number>(savedSettings.timeSignature);
  const [measureCount, setMeasureCount] = useState<number>(savedSettings.measureCount);
  const [metronomeType, setMetronomeType] = useState<string>(savedSettings.metronomeType);
  const [useAttackSound, setUseAttackSound] = useState<boolean>(savedSettings.useAttackSound);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContinueDialog, setShowContinueDialog] = useState(false);
  const [continuationTimeout, setContinuationTimeout] = useState<number | null>(null);
  // 明示的に初期値を設定して音名表示が確実に初期化されるようにする
  const [currentNote, setCurrentNote] = useState<string>('C');
  const [nextNote, setNextNote] = useState<string>('G');
  const [audioContextReady, setAudioContextReady] = useState<boolean>(false);
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  // ビートアニメーションのための状態変数を追加
  const [beatActive, setBeatActive] = useState<boolean>(false);
  const [isFirstBeat, setIsFirstBeat] = useState<boolean>(false);
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

  // 設定変更を監視し、変更があった場合に保存する
  useEffect(() => {
    const currentSettings: StoredSettings = {
      bpm,
      timeSignature,
      measureCount,
      metronomeType,
      useAttackSound
    };
    
    // 設定を保存
    saveSettings(currentSettings);
  }, [bpm, timeSignature, measureCount, metronomeType, useAttackSound]);
  
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
      beatManagerRef.current = new BeatManager(bpm, appConfig.debug);
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
  
  // 音名を更新する関数 - スケジューラー内で直接呼び出す
  const updateNotesDirectly = useCallback((newCurrent: string, newNext: string) => {
    console.log(`updateNotesDirectly呼び出し: 現在=${newCurrent}, 次=${newNext}`);
    
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
    
    if (appConfig.debug) {
      console.log(`音名を直接更新: 現在の音名=${newCurrent}, 次の音名=${newNext}`);
    }
  }, []);

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
    if (appConfig.debug) {
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
        beatManagerRef.current = new BeatManager(bpm, appConfig.debug);
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
        
        // ビートアニメーションのためのビート状態を更新
        setBeatActive(true);
        setIsFirstBeat(isFirstBeatOfMeasure);
        
        // 短い時間後に非アクティブに戻す（アニメーションのため）
        setTimeout(() => {
          setBeatActive(false);
          setIsFirstBeat(false);
        }, 100); // 100msでビートアニメーションを終了
        
        // ビートカウントと小節判定のデバッグ出力
        if (appConfig.debug) {
          console.log(`ビートカウント: ${beatCount}, 小節の1拍目？: ${isFirstBeatOfMeasure}, 小節カウント: ${localMeasureCount}`);
        }

        // 小節の最初の拍のときに小節カウントを増加
        if (isFirstBeatOfMeasure) {
          // 小節カウントを増加
          localMeasureCount++;
          
          // 小節カウントのデバッグ出力
          if (appConfig.debug) {
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
      // 少し遅延を入れてから再開する
      setTimeout(() => {
        startMetronome();
      }, 100);
    }
  }, [timeSignature, measureCount, isPlaying, audioContextReady, startMetronome]);

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

  // アタック音設定変更ハンドラー
  const handleAttackSoundChange = (useAttack: boolean) => {
    setUseAttackSound(useAttack);
  };

  // メトロノームコントロールの状態をまとめる
  const controlState = {
    bpm,
    timeSignature,
    measureCount,
    metronomeType,
    useAttackSound
  };

  return (
    <div className="app-container">
      <Header title="RandomTone" />
      
      <main className="main-content">
        <ErrorMessage message={audioError} />
        
        {/* 音符表示を最大限に広げる */}
        <div className="note-display-container flex-grow">
          <NoteDisplay 
            currentNote={currentNote} 
            nextNote={nextNote} 
            beatActive={beatActive}
            isFirstBeat={isFirstBeat}
            onTap={togglePlayback}
            isPlaying={isPlaying}
          />
        </div>
        
        {/* コントロールパネルのみ表示、プレイボタンは非表示に */}
        <div className="bottom-controls">
          <div className="control-panel">
            <MetronomeControls
              controlState={controlState}
              onBpmChange={handleBpmChange}
              onTimeSignatureChange={handleTimeSignatureChange}
              onMeasureCountChange={handleMeasureCountChange}
              onMetronomeTypeChange={handleMetronomeTypeChange}
              onAttackSoundChange={handleAttackSoundChange}
            />
          </div>
        </div>
        
        <ContinueDialog
          isVisible={showContinueDialog}
          onContinue={handleContinue}
          onStop={handleStop}
        />
      </main>
      
      <Footer />
    </div>
  );
}

export default App;
