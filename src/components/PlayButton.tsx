import React from 'react';
import { playButtonStyle } from '../styles/commonStyles';

interface PlayButtonProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const PlayButton: React.FC<PlayButtonProps> = ({ isPlaying, onTogglePlay }) => {
  return (
    <button 
      onClick={onTogglePlay}
      style={playButtonStyle(isPlaying)}
    >
      {isPlaying ? '停止' : '再生'}
    </button>
  );
};

export default PlayButton;