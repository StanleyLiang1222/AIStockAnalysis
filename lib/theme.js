// 全站唯一的色彩來源。深色、淺色兩套色碼使用同一組 token，實際色值以 CSS 變數（--color-*）提供：
// - tailwind.config.js 用 tailwindColors（rgb(var(--color-x) / <alpha-value>)，支援 bg-accent/20 這類透明度寫法）
// - SVG 圖表等無法用 Tailwind class 的地方用 colors（rgb(var(--color-x))），切換模式時會即時變色
// - 兩套 CSS 變數由 tailwind.config.js 的 plugin 寫進 :root（深色）與 :root.light（淺色）
// 淺色版色相與深色版相同，只依白底調整明度（漲跌紅綠加深，確保在白底上清楚可讀）。
// 使用 CommonJS，因為 tailwind.config.js 是 CommonJS。
const palettes = {
  dark: {
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
  },
  light: {
    canvas: '#f5f5f7',
    inset: '#f0f0f3',
    surface: {
      DEFAULT: '#ffffff',
      raised: '#f5f5f7',
      selected: '#edf1fd',
    },
    line: {
      DEFAULT: '#e5e5ea',
      subtle: '#ececf0',
      strong: '#d1d1d6',
    },
    fg: {
      DEFAULT: '#1d1d1f',
      muted: '#6e6e73',
      faint: '#86868b',
      dim: '#a1a1a6',
    },
    up: '#d70015',
    down: '#248a3d',
    accent: {
      DEFAULT: '#3e63dd',
      hover: '#3451b2',
      soft: '#3451b2',
    },
    warn: '#b26b00',
    violet: '#7c3aed',
  },
};

// { surface: { raised: '#16181a' } } → [['surface-raised', '#16181a']]；DEFAULT 對應到不加後綴的名稱
function flatten(tree, prefix = '') {
  return Object.entries(tree).flatMap(([key, value]) => {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    return typeof value === 'string' ? [[name, value]] : flatten(value, name);
  });
}

// 與色碼同結構，值換成 CSS 變數參照
function mapTokens(tree, toValue, prefix = '') {
  return Object.fromEntries(Object.entries(tree).map(([key, value]) => {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    return [key, typeof value === 'string' ? toValue(name) : mapTokens(value, toValue, name)];
  }));
}

const hexToChannels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

// 某一套色碼 → { '--color-surface-raised': '22 24 26', ... }
const cssVariables = (palette) => Object.fromEntries(
  flatten(palette).map(([name, hex]) => [`--color-${name}`, hexToChannels(hex)])
);

const colors = mapTokens(palettes.dark, (name) => `rgb(var(--color-${name}))`);
const tailwindColors = mapTokens(palettes.dark, (name) => `rgb(var(--color-${name}) / <alpha-value>)`);

module.exports = { palettes, colors, tailwindColors, cssVariables };
