import React from 'react';
import { errorContainerStyle } from '../styles/commonStyles';

interface ErrorMessageProps {
  message: string | null;
  onReload?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onReload = () => window.location.reload() }) => {
  if (!message) return null;
  
  return (
    <div style={errorContainerStyle}>
      <div style={{ marginBottom: '0.5rem' }}>{message}</div>
      <button 
        style={{ 
          background: 'white', 
          color: '#ef4444', 
          padding: '0.5rem 1rem', 
          borderRadius: '0.375rem', 
          border: 'none', 
          cursor: 'pointer' 
        }}
        onClick={onReload}>
          再読み込み
      </button>
    </div>
  );
};

export default ErrorMessage;