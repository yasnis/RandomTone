import React from 'react';

interface NoteDisplayProps {
  currentNote: string;
  nextNote: string;
  beatActive?: boolean;
  isFirstBeat?: boolean;
}

const NoteDisplay: React.FC<NoteDisplayProps> = ({ currentNote, nextNote, beatActive = false, isFirstBeat = false }) => {
  // ビートに応じたクラス名を生成
  const backgroundClassNames = [
    "note-background",
    beatActive ? "beat-active" : "",
    isFirstBeat ? "first-beat" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="note-display">
      <div className={backgroundClassNames}></div>
      <div className="current-note">
        {currentNote || '準備中...'}
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