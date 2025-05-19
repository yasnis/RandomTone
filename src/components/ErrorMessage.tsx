import React from 'react';

interface ErrorMessageProps {
  message: string | null;
  onReload?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onReload = () => window.location.reload() }) => {
  if (!message) return null;
  
  return (
    <div className="error-container">
      <div className="error-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-semibold">エラーが発生しました</span>
      </div>
      <div className="error-message">{message}</div>
      <button 
        className="error-button"
        onClick={onReload}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          再読み込み
      </button>
    </div>
  );
};

export default ErrorMessage;