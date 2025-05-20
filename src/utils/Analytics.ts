// Google Analyticsのイベントトラッキング用ユーティリティ

// window.gtagの型定義
declare global {
  interface Window {
    gtag: (
      command: string,
      action: string,
      params?: {
        [key: string]: any;
      }
    ) => void;
  }
}

// イベントカテゴリの定義
export enum EventCategory {
  PLAY = 'play',
  NOTE = 'note',
  SETTINGS = 'settings',
  ERROR = 'error',
}

// Google Analyticsのイベントを送信する関数
export const trackEvent = (
  category: EventCategory, 
  action: string, 
  label?: string, 
  value?: number
): void => {
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  } else {
    console.debug('Google Analytics not loaded, event not tracked:', {
      category,
      action,
      label,
      value,
    });
  }
};

// ページビューを追跡する関数
export const trackPageView = (path: string): void => {
  if (window.gtag) {
    window.gtag('config', 'G-XXXXXXXXXX', {
      page_path: path,
    });
  }
};