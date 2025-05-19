import React from 'react';

interface NoteDisplayProps {
  currentNote: string;
  nextNote: string;
}

const NoteDisplay: React.FC<NoteDisplayProps> = ({ currentNote, nextNote }) => {
  return (
    <div className="note-display">
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