import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css' // スタイルを最初にインポート
import App from './App'

// DOMマウントの処理を強化
const appElement = document.getElementById('app');

if (appElement) {
  try {
    console.log('アプリのマウント処理を開始します');
    const root = ReactDOM.createRoot(appElement);
    // StrictModeを削除してAudioContextの二重初期化問題を解決
    root.render(<App />);
    console.log('アプリのマウント処理が完了しました');
  } catch (error) {
    console.error('Reactアプリのマウント中にエラーが発生しました:', error);
    // エラーメッセージをDOM上に表示
    appElement.innerHTML = `
      <div style="color: red; padding: 20px; border: 1px solid red; margin: 20px;">
        <h2>エラーが発生しました</h2>
        <p>${error instanceof Error ? error.message : '不明なエラー'}</p>
        <p>コンソール(F12)でさらに詳細を確認してください。</p>
      </div>
    `;
  }
} else {
  console.error('マウント先の要素(#app)が見つかりません。index.htmlファイルを確認してください。');
  // 要素が見つからない場合は、bodyに直接エラーメッセージを追加
  document.body.innerHTML += `
    <div style="color: red; padding: 20px; border: 1px solid red; margin: 20px;">
      <h2>マウントエラー</h2>
      <p>アプリケーションのマウント先となる要素(id="app")が見つかりませんでした。</p>
      <p>index.htmlファイルに &lt;div id="app"&gt;&lt;/div&gt; が存在するか確認してください。</p>
    </div>
  `;
}