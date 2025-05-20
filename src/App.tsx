import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BeatManager } from './utils/BeatManager';
import { AudioPlayer } from './utils/AudioPlayer';
import { NOTES } from './types/index';
import { trackEvent, trackPageView, EventCategory } from './utils/Analytics'; // Google Analytics関連をインポート

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

  // コンポーネントマウント時にページビューを追跡する
  useEffect(() => {
    trackPageView('/'); // ホームページのページビューを追跡
  }, []);

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
    logDebug('音名が初期化されました');
    
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
      // 実際のwindow unloadイベント時のみクローズするように変更
      // 通常のアンマウント時はclose()を呼ばないようにする
      if (audioPlayerRef.current && window.isBeforeUnloadTriggered) {
        logDebug('ページアンロード時にAudioPlayerをクリーンアップします');
        audioPlayerRef.current.close();
        audioPlayerRef.current = null;
      }
      
      // BeatManagerの参照をクリア
      beatManagerRef.current = null;
    };
  }, []); // 空の依存配列で最初の一度だけ実行
  
  // beforeunloadイベントを処理するためのリスナーを追加
  useEffect(() => {
    // グローバル変数がない場合は作成
    if (typeof window.isBeforeUnloadTriggered === 'undefined') {
      window.isBeforeUnloadTriggered = false;
    }
    
    const handleBeforeUnload = () => {
      window.isBeforeUnloadTriggered = true;
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  // 音名を更新する関数 - スケジューラー内で直接呼び出す
  const updateNotesDirectly = useCallback((newCurrent: string, newNext: string) => {
    logDebug(`updateNotesDirectly呼び出し: 現在=${newCurrent}, 次=${newNext}`);
    
    // setTimeout を使わず直接更新
    setCurrentNote(prevCurrent => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevCurrent === newCurrent) {
        logDebug('現在の音名が同じため更新しません:', prevCurrent);
        return prevCurrent;
      }
      logDebug(`現在の音名を更新: ${prevCurrent} -> ${newCurrent}`);
      return newCurrent;
    });
    
    setNextNote(prevNext => {
      // 前の音名と同じなら更新しない（再レンダリング防止）
      if (prevNext === newNext) {
        logDebug('次の音名が同じため更新しません:', prevNext);
        return prevNext;
      }
      logDebug(`次の音名を更新: ${prevNext} -> ${newNext}`);
      return newNext;
    });
    
    if (appConfig.debug) {
      logDebug(`音名を直接更新: 現在の音名=${newCurrent}, 次の音名=${newNext}`);
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
    
    // メトロノーム停止時にイベントを追跡
    if (isPlaying) {
      trackEvent(EventCategory.PLAY, 'stop_metronome', `BPM: ${bpm}, TimeSignature: ${timeSignature}`);
    }
  }, [audioContextReady, bpm, timeSignature, isPlaying]);
  
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
    logDebug('startMetronome呼び出し', {
      audioContextReady,
      audioPlayerExists: !!audioPlayerRef.current,
      audioPlayerState: audioPlayerRef.current ? audioPlayerRef.current.getState() : 'none'
    });
    
    if (!audioContextReady || !audioPlayerRef.current) {
      console.error('メトロノーム開始失敗: オーディオコンテキストが準備できていないか、AudioPlayerが存在しません');
      return;
    }
    
    // サウンドバッファをチェック
    if (!audioPlayerRef.current.soundBuffersExist()) {
      console.error('メトロノーム開始失敗: 音声バッファがロードされていません');
      setAudioError('音声データが正しくロードされていません。ページを再読み込みしてください。');
      return;
    }
    
    try {
      logDebug('既存のメトロノームを停止します');
      // 既存のメトロノームを停止して完全に新しくする
      stopMetronome();
      
      // 小節カウンターをリセット
      currentMeasureRef.current = 0;
      
      // 音声コンテキストの再開を試みる
      logDebug('AudioContextの状態:', audioPlayerRef.current.getState());
      audioPlayerRef.current.resume().catch(err => {
        console.error('オーディオコンテキスト再開中にエラーが発生しました:', err);
      });
      
      // BeatManagerが存在しない場合は新しく作成
      if (!beatManagerRef.current) {
        logDebug(`BeatManagerを新規作成します: BPM=${bpm}`);
        beatManagerRef.current = new BeatManager(bpm, true); // デバッグを有効化
      } else {
        // 既存のBeatManagerのBPMを更新
        logDebug(`BeatManagerのBPMを更新します: ${beatManagerRef.current.getBpm()} -> ${bpm}`);
        beatManagerRef.current.setBpm(bpm);
      }
      
      // メトロノーム開始時にイベントを追跡
      trackEvent(EventCategory.PLAY, 'start_metronome', `BPM: ${bpm}, TimeSignature: ${timeSignature}`);
      
      // 小節カウントと拍カウントを初期化
      let beatCount = timeSignature - 1; // 1小節内の拍カウント (0から始まり timeSignature - 1 まで)
      let localMeasureCount = 0;  // 名前を変更してグローバルなmeasureCountと競合しないようにする
      
      // 以前のリスナーが存在する場合はクリア
      if (beatListenerCleanupRef.current) {
        logDebug('以前のビートリスナーをクリアします');
        beatListenerCleanupRef.current();
        beatListenerCleanupRef.current = null;
      }
      
      logDebug('ビートイベントリスナーを登録します');
      // 現在の音名と次の音名を直接取得（クロージャの問題を回避）
      const currentNoteAtStart = currentNote;
      let nextNoteAtStart = nextNote;
      
      // BeatManagerにビートイベントリスナーを登録
      beatListenerCleanupRef.current = beatManagerRef.current.addBeatListener(() => {
        // ビートイベント発生
        logDebug('ビートイベントが発生しました');
        
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
        
        // 小節の最初の拍のときに小節カウントを増加
        if (isFirstBeatOfMeasure) {
          // 小節カウントを増加
          localMeasureCount++;
          logDebug(`小節カウント更新: ${localMeasureCount}`);
          
          // 指定された小節数に達した場合に音名を更新
          if (localMeasureCount >= measureCount) {
            // 音名を更新
            const newCurrentNote = nextNoteAtStart || getRandomNote();
            const newNextNote = getRandomNote();
            nextNoteAtStart = newNextNote;
            logDebug(`音名を更新します: ${currentNote} -> ${newCurrentNote}, 次: ${nextNote} -> ${newNextNote}`);

            // 直接状態を更新
            setCurrentNote(newCurrentNote);
            setNextNote(newNextNote);
            
            // カウンターをリセット
            localMeasureCount = 0;
          }
        }
        
        try {
          // アタック音を使用するかどうかの設定に基づいて音を選択
          const soundType = (isFirstBeatOfMeasure && useAttackSound) ? 'attack' : 'beat';
          logDebug(`音を再生します: タイプ=${soundType}`);
          
          // 音を再生
          if (audioPlayerRef.current) {
            const currentTime = audioPlayerRef.current.getCurrentTime();
            logDebug(`音をスケジュール: タイプ=${soundType}, 時間=${currentTime}`);
            audioPlayerRef.current.scheduleSound(soundType, currentTime);
          } else {
            console.error('AudioPlayerが見つかりません');
          }
        } catch (error) {
          console.error('音声再生中にエラーが発生しました:', error);
        }
      });
      
      logDebug('メトロノーム開始処理が完了しました');
      
    } catch (error) {
      console.error('メトロノーム開始中にエラーが発生しました:', error);
      setAudioError('メトロノームの開始中にエラーが発生しました。ページを再読み込みしてください。');
      
      // エラー発生時にイベント追跡
      trackEvent(EventCategory.ERROR, 'metronome_start_error', String(error));
    }
  }, [audioContextReady, bpm, timeSignature, useAttackSound, measureCount, currentNote, nextNote]);
  
  // AudioContextの初期化
  const initAudioContext = useCallback(async () => {
    try {
      logDebug('AudioContextの初期化を開始します');
      
      if (!audioPlayerRef.current) {
        logDebug('AudioPlayerインスタンスを新規作成します');
        audioPlayerRef.current = new AudioPlayer();
      }
      
      // AudioContextを初期化
      logDebug('AudioContextを初期化しています');
      const initSuccess = await audioPlayerRef.current.initialize();
      logDebug('AudioContext初期化結果:', initSuccess);
      
      if (!initSuccess) {
        throw new Error('AudioContextの初期化に失敗しました');
      }
      
      // メトロノーム音声をロード
      logDebug(`メトロノーム音声をロードしています: タイプ=${metronomeType}`);
      const loadSuccess = await audioPlayerRef.current.loadSounds(metronomeType);
      logDebug('音声ロード結果:', loadSuccess);
      
      if (!loadSuccess) {
        throw new Error('メトロノーム音声のロードに失敗しました');
      }
      
      logDebug('AudioContext state:', audioPlayerRef.current.getState());
      
      // 状態を一度に更新して混乱を避ける
      setAudioInitialized(true);
      setAudioContextReady(true);
      setAudioError(null);
      
      // マイクロタスクのタイミングで確実に状態が更新されるのを待つ
      await new Promise(resolve => setTimeout(resolve, 0));
      
      return true;
    } catch (error) {
      console.error('AudioContextの初期化に失敗しました:', error);
      setAudioError(`音声の初期化中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      
      // エラー発生時にイベント追跡
      trackEvent(EventCategory.ERROR, 'audio_context_init_error', String(error));
      return false;
    }
  }, [metronomeType]);
  
  // 再生/停止の切り替え
  const togglePlayback = useCallback(async () => {
    logDebug('togglePlayback呼び出し', {
      audioInitialized,
      audioContextReady,
      isPlaying,
      state: audioPlayerRef.current?.getState() || 'none'
    });
    
    try {
      // AudioPlayerが存在しない場合、新しく作成する
      if (!audioPlayerRef.current) {
        logDebug('AudioPlayerが存在しないため、新規作成します');
        audioPlayerRef.current = new AudioPlayer();
        setAudioInitialized(false);
        setAudioContextReady(false);
      }
      
      // 初回の再生時はオーディオコンテキストを初期化
      if (!audioInitialized) {
        logDebug('初回再生: AudioContextを初期化します');
        
        try {
          // 直接初期化処理を実行
          const success = await initAudioContext();
          logDebug('AudioContext初期化の結果:', success);
          
          if (!success) {
            setAudioError('オーディオの初期化に失敗しました。もう一度タップしてください。');
            return;
          }
          
          // 状態の更新が確実に完了するのを待ってから自動再生を開始
          // このタイマーは状態更新後のレンダリングが確実に完了する時間を確保
          setTimeout(() => {
            logDebug('自動再生チェック:', {
              audioContextReady: true, // initAudioContextで設定済み
              audioInitialized: true,  // initAudioContextで設定済み
              audioPlayerExists: !!audioPlayerRef.current
            });
            
            // ここでは状態が更新されていることを前提に処理
            if (audioPlayerRef.current) {
              logDebug('再生状態: 開始に切り替えます (自動)');
              setIsPlaying(true);
              
              // 再生状態の更新を反映させるための遅延
              setTimeout(() => {
                logDebug('メトロノームを開始します (自動)');
                if (audioPlayerRef.current) {
                  // メトロノームを明示的に開始
                  // startMetronomeの代わりに直接コードを実行
                  try {
                    logDebug('既存のメトロノームを停止します');
                    stopMetronome();
                    
                    // 小節カウンターをリセット
                    currentMeasureRef.current = 0;
                    
                    // 音声コンテキストの状態を確認
                    if (audioPlayerRef.current) {
                      logDebug('AudioContextの状態:', audioPlayerRef.current.getState());
                      // 明示的に再開を試みる
                      audioPlayerRef.current.resume().catch(err => {
                        console.error('オーディオコンテキスト再開中にエラーが発生しました:', err);
                      });
                    }
                    
                    // BeatManagerが存在しない場合は新しく作成
                    if (!beatManagerRef.current) {
                      logDebug(`BeatManagerを新規作成します: BPM=${bpm}`);
                      beatManagerRef.current = new BeatManager(bpm, true);
                    } else {
                      // 既存のBeatManagerのBPMを更新
                      logDebug(`BeatManagerのBPMを更新します: ${beatManagerRef.current.getBpm()} -> ${bpm}`);
                      beatManagerRef.current.setBpm(bpm);
                    }
                    
                    // メトロノーム開始時にイベントを追跡
                    trackEvent(EventCategory.PLAY, 'start_metronome_auto', `BPM: ${bpm}, TimeSignature: ${timeSignature}`);
                    
                    // 小節カウントと拍カウントを初期化
                    let beatCount = timeSignature - 1;
                    let localMeasureCount = 0;
                    
                    // 以前のリスナーが存在する場合はクリア
                    if (beatListenerCleanupRef.current) {
                      logDebug('以前のビートリスナーをクリアします');
                      beatListenerCleanupRef.current();
                      beatListenerCleanupRef.current = null;
                    }
                    
                    logDebug('ビートイベントリスナーを登録します');
                    
                    // BeatManagerにビートイベントリスナーを登録
                    if (beatManagerRef.current) {
                      const currentNoteAtStart = currentNote;
                      let nextNoteAtStart = nextNote;
                      
                      beatListenerCleanupRef.current = beatManagerRef.current.addBeatListener(() => {
                        // ビートイベント発生
                        logDebug('ビートイベントが発生しました');
                        
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
                        }, 100);
                        
                        // 小節の最初の拍のときに小節カウントを増加
                        if (isFirstBeatOfMeasure) {
                          // 小節カウントを増加
                          localMeasureCount++;
                          logDebug(`小節カウント更新: ${localMeasureCount}`);
                          
                          // 指定された小節数に達した場合に音名を更新
                          if (localMeasureCount >= measureCount) {
                            // 音名を更新
                            const newCurrentNote = nextNoteAtStart || getRandomNote();
                            const newNextNote = getRandomNote();
                            nextNoteAtStart = newNextNote;
                            logDebug(`音名を更新します: ${currentNote} -> ${newCurrentNote}, 次: ${nextNote} -> ${newNextNote}`);
                            
                            // 直接状態を更新
                            setCurrentNote(newCurrentNote);
                            setNextNote(newNextNote);
                            
                            // カウンターをリセット
                            localMeasureCount = 0;
                          }
                        }
                        
                        try {
                          // アタック音を使用するかどうかの設定に基づいて音を選択
                          const soundType = (isFirstBeatOfMeasure && useAttackSound) ? 'attack' : 'beat';
                          logDebug(`音を再生します: タイプ=${soundType}`);
                          
                          // 音を再生
                          if (audioPlayerRef.current) {
                            const currentTime = audioPlayerRef.current.getCurrentTime();
                            logDebug(`音をスケジュール: タイプ=${soundType}, 時間=${currentTime}`);
                            audioPlayerRef.current.scheduleSound(soundType, currentTime);
                          } else {
                            console.error('AudioPlayerが見つかりません');
                          }
                        } catch (error) {
                          console.error('音声再生中にエラーが発生しました:', error);
                        }
                      });
                    }
                    
                    logDebug('メトロノーム開始処理が完了しました (自動)');
                    
                    // 5分後に確認ダイアログを表示するタイマーをセット
                    startContinuationTimer();
                  } catch (error) {
                    console.error('自動メトロノーム開始中にエラーが発生しました:', error);
                    setAudioError('メトロノームの開始中にエラーが発生しました。もう一度タップしてください。');
                    setIsPlaying(false);
                  }
                } else {
                  console.error('AudioPlayerがnullのため、自動再生を中止します');
                  setAudioError('オーディオの準備ができていません。もう一度タップしてください。');
                  setIsPlaying(false);
                }
              }, 50);
            } else {
              logDebug('AudioPlayerが存在しないため、自動再生を延期します');
              setAudioError('オーディオの準備ができました。もう一度タップして再生を開始してください。');
            }
          }, 100);
          
          return; // 初期化後に処理を終了
        } catch (error) {
          console.error('AudioContext初期化中にエラーが発生しました:', error);
          setAudioInitialized(false);
          setAudioError('オーディオの初期化中にエラーが発生しました。もう一度お試しください。');
          return;
        }
      } else if (!audioContextReady || (audioPlayerRef.current && audioPlayerRef.current.getState() !== 'running')) {
        try {
          logDebug('AudioContextを再開します');
          if (audioPlayerRef.current) {
            await audioPlayerRef.current.resume();
            logDebug('AudioContextを再開しました:', audioPlayerRef.current.getState());
          }
          setAudioContextReady(true);
        } catch (error) {
          console.error('AudioContextの再開に失敗しました:', error);
          
          // エラーが発生した場合、AudioPlayerを再初期化する
          logDebug('エラーが発生したため、AudioContextを再初期化します');
          try {
            if (audioPlayerRef.current) {
              // closeメソッドは呼ばない - すでにエラーが発生しているため
              audioPlayerRef.current = new AudioPlayer();
            }
            const reinitSuccess = await initAudioContext();
            if (!reinitSuccess) {
              setAudioError(`AudioContextの再初期化に失敗しました。ページを再読み込みしてください。`);
              return;
            }
          } catch (reinitError) {
            console.error('AudioContextの再初期化中にエラーが発生しました:', reinitError);
            setAudioError(`音声の処理中にエラーが発生しました: ${reinitError instanceof Error ? reinitError.message : '不明なエラー'}`);
            return;
          }
        }
      }
      
      // AudioPlayerが存在することを再確認
      if (!audioPlayerRef.current || !audioContextReady) {
        setAudioError('オーディオシステムが正しく初期化されていません。ページを再読み込みしてください。');
        return;
      }
      
      if (isPlaying) {
        logDebug('再生状態: 停止に切り替えます');
        // まず再生状態を更新してからメトロノームを停止
        setIsPlaying(false);
        stopMetronome();
        
        // 再生停止時にイベントを追跡
        trackEvent(EventCategory.PLAY, 'stop', `BPM: ${bpm}`);
        
        // 反復処理のタイムアウトをクリア
        if (continuationTimeout) {
          window.clearTimeout(continuationTimeout);
          setContinuationTimeout(null);
        }
      } else {
        logDebug('再生状態: 開始に切り替えます');
        // まず再生状態を更新してからメトロノームを開始
        setIsPlaying(true);
        
        // 再生開始時にイベントを追跡
        trackEvent(EventCategory.PLAY, 'start', `BPM: ${bpm}`);
        
        // サウンドバッファが正しくロードされているか確認
        if (audioPlayerRef.current && !audioPlayerRef.current.soundBuffersExist()) {
          logDebug('サウンドバッファが存在しないため、再ロードします');
          const loadSuccess = await audioPlayerRef.current.loadSounds(metronomeType);
          if (!loadSuccess) {
            setAudioError('音声データのロードに失敗しました。ページを再読み込みしてください。');
            setIsPlaying(false);
            return;
          }
        }
        
        // わずかな遅延を入れて状態更新が反映されるのを待つ
        setTimeout(() => {
          if (audioPlayerRef.current && audioContextReady) {
            logDebug('メトロノームを開始します');
            startMetronome();
            // 5分後に確認ダイアログを表示するタイマーをセット
            startContinuationTimer();
          } else {
            console.error('メトロノーム開始失敗: オーディオコンテキストが準備できないか、AudioPlayerが存在しません');
            setAudioError('オーディオの準備ができていません。もう一度タップしてください。');
            setIsPlaying(false);
          }
        }, 50);
      }
    } catch (error) {
      console.error('再生/停止中にエラーが発生しました:', error);
      setAudioError(`音声処理中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      setIsPlaying(false); // エラー時には再生状態をリセット
      
      // エラー発生時にイベント追跡
      trackEvent(EventCategory.ERROR, 'playback_toggle_error', String(error));
    }
  }, [audioContextReady, audioInitialized, initAudioContext, isPlaying, startMetronome, stopMetronome, continuationTimeout, startContinuationTimer, bpm, timeSignature, metronomeType, useAttackSound, measureCount, currentNote, nextNote, getRandomNote]);
  
  // 反復処理の継続を処理する関数
  const handleContinuePlayback = useCallback((shouldContinue: boolean) => {
    setShowContinueDialog(false);
    
    if (shouldContinue) {
      // 再生を継続し、新しいタイマーをセット
      setIsPlaying(true);
      startMetronome();
      startContinuationTimer();
      
      // 継続を選択したことを追跡
      trackEvent(EventCategory.PLAY, 'continue_after_timeout', `BPM: ${bpm}, TimeSignature: ${timeSignature}`);
    } else {
      // 再生を停止
      setIsPlaying(false);
      stopMetronome();
      
      // 停止を選択したことを追跡
      trackEvent(EventCategory.PLAY, 'stop_after_timeout', `BPM: ${bpm}, TimeSignature: ${timeSignature}`);
    }
  }, [setIsPlaying, startMetronome, stopMetronome, startContinuationTimer, bpm, timeSignature]);
  
  // 反復処理を続行する - ContinueDialog用のコールバック
  const handleContinue = useCallback(() => {
    handleContinuePlayback(true);
  }, [handleContinuePlayback]);

  // 反復処理を終了する - ContinueDialog用のコールバック
  const handleStop = useCallback(() => {
    handleContinuePlayback(false);
  }, [handleContinuePlayback]);
  
  // BPM調整ハンドラー
  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBpm(value);
    
    // 設定変更を追跡
    trackEvent(EventCategory.SETTINGS, 'change_bpm', `BPM: ${value}`, value);
    
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
    
    // 設定変更を追跡
    trackEvent(EventCategory.SETTINGS, 'change_time_signature', `TimeSignature: ${value}`, value);
  };
  
  // 小節数調整ハンドラー
  const handleMeasureCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setMeasureCount(value);
    
    // 設定変更を追跡
    trackEvent(EventCategory.SETTINGS, 'change_measure_count', `MeasureCount: ${value}`, value);
  };
  
  // メトロノームタイプ変更ハンドラー
  const handleMetronomeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setMetronomeType(newType);
    
    // 設定変更を追跡
    trackEvent(EventCategory.SETTINGS, 'change_metronome_type', `Type: ${newType}`);
    
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
    
    // 設定変更を追跡
    trackEvent(EventCategory.SETTINGS, 'change_attack_sound', `UseAttack: ${useAttack}`);
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
