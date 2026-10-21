// 全站唯一的色彩來源：tailwind.config.js 與 SVG 圖表（無法用 Tailwind class 的地方）都從這裡讀取。
// 所有色值都取自原本畫面上已使用的色碼；近似色（RGB 差 1–3）已合併。
// 使用 CommonJS，因為 tailwind.config.js 是 CommonJS。
const colors = {
  canvas: '#090a0c', // 頁面底色
  inset: '#0c0e10', // 圖表繪圖區、分段控制的凹槽
  surface: {
    DEFAULT: '#111315', // 卡片、頁首
    raised: '#16181a', // 卡片內的列、輸入框、按鈕、Tooltip
    selected: '#1a1d23', // 選取中的列
  },
  line: {
    DEFAULT: '#22252a', // 卡片外框、啟用中的分段、格線外框
    subtle: '#1f2125', // 分隔線、內部格線
    strong: '#2d3137', // 輸入框與控制項外框、導引虛線
  },
  fg: {
    DEFAULT: '#eeeeef', // 全站預設文字色
    muted: '#9ba1a6', // 次要文字
    faint: '#888d92', // 未啟用的按鈕／分頁文字
    dim: '#505a68', // 座標軸、極次要說明
  },
  up: '#ff453a', // 台股配色：漲為紅
  down: '#30d158', // 台股配色：跌為綠
  accent: {
    DEFAULT: '#3e63dd',
    hover: '#3451b2',
    soft: '#6e8eff',
  },
  warn: '#ffb224',
  violet: '#7c3aed',
};

module.exports = { colors };
