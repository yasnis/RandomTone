import React, { useEffect } from 'react';

interface ContinueDialogProps {
  isVisible: boolean;
  onContinue: () => void;
  onStop: () => void;
}

const ContinueDialog: React.FC<ContinueDialogProps> = ({ isVisible, onContinue, onStop }) => {
  // ダイアログが表示されたときにスクロールを無効にする
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  if (!isVisible) return null;
  
  return (
    <>
      {/* オーバーレイ背景 */}
      <div className="overlay"></div>
      
      {/* ダイアログ */}
      <div className="dialog">
        <div className="dialog-content">
          <div className="dialog-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" className="dialog-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="dialog-title">
            再生を続けますか？
          </div>
          <div className="dialog-message">
            5分経過しました。続ける場合は「はい」をクリックしてください。
          </div>
        </div>
        
        <div className="dialog-buttons">
          <button 
            onClick={onContinue} 
            className="dialog-button dialog-button-confirm"
          >
            はい
          </button>
          <button 
            onClick={onStop} 
            className="dialog-button dialog-button-cancel"
          >
            いいえ
          </button>
        </div>
      </div>
    </>
  );
};

export default ContinueDialog;