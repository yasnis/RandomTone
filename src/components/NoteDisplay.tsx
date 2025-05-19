import React from 'react';
import { currentNoteContainerStyle, currentNoteDisplayStyle, nextNoteContainerStyle, nextNoteLabelStyle, nextNoteDisplayStyle } from '../styles/commonStyles';

interface NoteDisplayProps {
  currentNote: string;
  nextNote: string;
}

const NoteDisplay: React.FC<NoteDisplayProps> = ({ currentNote, nextNote }) => {
  return (
    <>
      {/* メインの音名表示領域 */}
      <div style={currentNoteContainerStyle}>
        <div style={currentNoteDisplayStyle}>
          {currentNote || '準備中...'}
        </div>
      </div>
      
      {/* 次の音名 */}
      <div style={nextNoteContainerStyle}>
        <div style={nextNoteLabelStyle}>Next</div>
        <div style={nextNoteDisplayStyle}>
          {nextNote || '...'}
        </div>
      </div>
    </>
  );
};

export default NoteDisplay;