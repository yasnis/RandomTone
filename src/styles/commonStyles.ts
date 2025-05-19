// 共通で使用するスタイル定義

// コンテナのスタイル
export const containerStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(to bottom, #121212, #1e1e1e)',
  color: 'white',
  display: 'flex',
  flexDirection: 'column' as const
};

// ヘッダーのスタイル
export const headerStyle = {
  padding: '1.5rem 1rem',
  background: '#1a1a1a',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

// タイトルのスタイル
export const titleStyle = {
  fontSize: '1.875rem',
  fontWeight: 'bold' as const,
  textAlign: 'center' as const,
  background: 'linear-gradient(to right, #a855f7, #ec4899)',
  WebkitBackgroundClip: 'text' as const,
  WebkitTextFillColor: 'transparent' as const
};

// メインコンテナのスタイル
export const mainContainerStyle = {
  flex: 1,
  margin: '0 auto',
  padding: '2rem 1rem',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  maxWidth: '28rem'
};

// エラー表示のスタイル
export const errorContainerStyle = {
  width: '100%',
  background: '#ef4444',
  color: 'white',
  padding: '1rem',
  borderRadius: '0.5rem',
  marginBottom: '1.5rem',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};

// コントロールパネルのスタイル
export const controlPanelStyle = {
  width: '100%',
  marginBottom: '2rem',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '1rem'
};

// 個々のコントロール項目のスタイル
export const controlItemStyle = {
  display: 'flex',
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  background: '#333',
  padding: '1rem',
  borderRadius: '0.5rem',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

// コントロールラベルのスタイル
export const controlLabelStyle = {
  color: '#9ca3af',
  fontSize: '0.875rem'
};

// セレクトボックスのスタイル
export const selectStyle = {
  background: 'transparent',
  color: 'white',
  border: 'none',
  outline: 'none',
  fontSize: '1rem',
  cursor: 'pointer'
};

// 再生/停止ボタンのスタイル
export const playButtonStyle = (isPlaying: boolean) => ({
  background: isPlaying ? '#ef4444' : '#4caf50',
  color: 'white',
  padding: '1rem 2rem',
  borderRadius: '0.5rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.25rem',
  fontWeight: 'bold' as const,
  width: '100%',
  transition: 'background 0.3s'
});

// 現在の音名表示のスタイル
export const currentNoteContainerStyle = {
  width: '100%',
  marginBottom: '2rem',
  textAlign: 'center' as const
};

export const currentNoteDisplayStyle = {
  fontSize: '6rem',
  fontWeight: 'bold' as const,
  marginBottom: '1rem',
  padding: '3rem 0',
  background: '#333',
  borderRadius: '0.75rem',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  display: 'flex',
  alignItems: 'center' as const,
  justifyContent: 'center' as const
};

// 次の音名表示のスタイル
export const nextNoteContainerStyle = {
  width: '100%',
  marginBottom: '2rem',
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center' as const
};

export const nextNoteLabelStyle = {
  color: '#9ca3af',
  fontSize: '0.875rem',
  marginBottom: '0.25rem'
};

export const nextNoteDisplayStyle = {
  fontSize: '1.5rem',
  fontWeight: '600',
  background: '#333',
  padding: '1rem 2rem',
  borderRadius: '0.5rem',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

// スライダーのスタイル
export const sliderStyle = {
  appearance: 'none' as const,
  width: '100%',
  height: '0.25rem',
  background: 'linear-gradient(to right, #a855f7, #ec4899)',
  borderRadius: '0.125rem',
  outline: 'none',
  cursor: 'pointer'
};

// BPM値表示のスタイル
export const bpmValueStyle = {
  color: 'white',
  fontWeight: 'bold' as const,
  fontSize: '1.25rem'
};

// フッターのスタイル
export const footerStyle = {
  padding: '1rem',
  textAlign: 'center' as const,
  fontSize: '0.875rem',
  color: '#9ca3af',
  marginTop: 'auto'
};

// ダイアログのスタイル
export const dialogContainerStyle = {
  position: 'fixed' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#1a1a1a',
  padding: '2rem',
  borderRadius: '0.5rem',
  boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  zIndex: 1000,
  width: '90vw',
  maxWidth: '400px'
};

export const dialogContentStyle = {
  marginBottom: '1.5rem',
  textAlign: 'center' as const
};

export const dialogTitleStyle = {
  fontSize: '1.125rem',
  fontWeight: '600',
  marginBottom: '0.5rem'
};

export const dialogMessageStyle = {
  color: '#9ca3af',
  fontSize: '0.875rem'
};

export const dialogButtonsContainerStyle = {
  display: 'flex',
  justifyContent: 'space-between' as const
};

export const confirmButtonStyle = {
  background: '#4caf50',
  color: 'white',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.375rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '500' as const,
  flex: 1,
  marginRight: '0.5rem',
  transition: 'background 0.3s'
};

export const cancelButtonStyle = {
  background: '#ef4444',
  color: 'white',
  padding: '0.75rem 1.5rem',
  borderRadius: '0.375rem',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '500' as const,
  flex: 1,
  transition: 'background 0.3s'
};