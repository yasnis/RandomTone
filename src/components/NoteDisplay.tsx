import React from 'react';

interface NoteDisplayProps {
  currentNote: string;
  nextNote: string;
  beatActive?: boolean;
  isFirstBeat?: boolean;
  onTap?: () => void;  // タップイベントのコールバック関数
  isPlaying?: boolean; // 再生中かどうかのステート
}

const NoteDisplay: React.FC<NoteDisplayProps> = ({ 
  currentNote, 
  nextNote, 
  beatActive = false, 
  isFirstBeat = false,
  onTap,
  isPlaying = false
}) => {
  // ビートに応じたクラス名を生成
  const backgroundClassNames = [
    "note-background",
    beatActive ? "beat-active" : "",
    isFirstBeat ? "first-beat" : "",
    isPlaying ? "playing" : ""
  ].filter(Boolean).join(" ");

  // タップ時の処理
  const handleTap = () => {
    if (onTap) {
      onTap();
    }
  };

  return (
    <div className="note-display" onClick={handleTap}>
      <div className={backgroundClassNames}></div>
      <div className="current-note">
        {currentNote || '準備中...'}
        <div className="tap-hint">
          {isPlaying ? 'Tap to pause' : 'Tap to play'}
        </div>
      </div>
      <div className="next-note-container">
        <div className="next-note-label">Next:</div>
        <div className="next-note-display">
          {nextNote || '...'}
        </div>
      </div>
    </div>
  );
};

export default NoteDisplay;