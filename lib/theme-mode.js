// 深色／淺色模式的設定值與渲染前套用的 script（server 的 app/layout.js 與 client 的 useTheme 共用，
// 不能放在 'use client' 檔案裡，否則 server 端匯入到的是 client reference 而不是字串）。
// 設定存在這台裝置的瀏覽器：'system'（跟隨系統，預設）| 'light' | 'dark'。
// 實際模式以 <html> 上有沒有 light class 表示，色彩變數見 lib/theme.js 與 tailwind.config.js。
export const THEME_STORAGE_KEY = 'theme';
export const THEME_OPTIONS = ['system', 'light', 'dark'];
export const LIGHT_QUERY = '(prefers-color-scheme: light)';

// 在頁面渲染前執行（內嵌到 <head>），避免先閃一下深色才變淺色。
// 讀取失敗（例如瀏覽器封鎖 localStorage）時當作跟隨系統。
export const THEME_SCRIPT = `(function(){var p;try{p=localStorage.getItem('${THEME_STORAGE_KEY}');}catch(e){}
var light=p==='light'||(p!=='dark'&&window.matchMedia('${LIGHT_QUERY}').matches);
document.documentElement.classList.toggle('light',light);})();`;
