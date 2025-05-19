import React from 'react';
import { dialogContainerStyle, dialogContentStyle, dialogTitleStyle, dialogMessageStyle, dialogButtonsContainerStyle, confirmButtonStyle, cancelButtonStyle } from '../styles/commonStyles';

interface ContinueDialogProps {
  isVisible: boolean;
  onContinue: () => void;
  onStop: () => void;
}

const ContinueDialog: React.FC<ContinueDialogProps> = ({ isVisible, onContinue, onStop }) => {
  if (!isVisible) return null;
  
  return (
    <div style={dialogContainerStyle}>
      <div style={dialogContentStyle}>
        <div style={dialogTitleStyle}>再生を続けますか？</div>
        <div style={dialogMessageStyle}>5分経過しました。続ける場合は「はい」をクリックしてください。</div>
      </div>
      
      <div style={dialogButtonsContainerStyle}>
        <button onClick={onContinue} style={confirmButtonStyle}>
          はい
        </button>
        <button onClick={onStop} style={cancelButtonStyle}>
          いいえ
        </button>
      </div>
    </div>
  );
};

export default ContinueDialog;