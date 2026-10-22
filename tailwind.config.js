const plugin = require('tailwindcss/plugin');
const { palettes, tailwindColors, cssVariables } = require('./lib/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // lib/format.js 會組出 text-up / bg-down 等 class，也要納入掃描
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.js'],
  theme: {
    extend: {
      colors: tailwindColors,
      fontSize: {
        '3xs': '9px',
        '2xs': '10px',
      },
      scale: {
        99: '0.99',
      },
      gridTemplateColumns: {
        // 電腦版：固定寬度的自選清單 + 隨寬度伸縮的分析區
        dashboard: '320px minmax(0, 1fr)',
      },
    },
  },
  plugins: [
    // 色彩 CSS 變數：預設深色；<html> 加上 light class 時換成淺色（由 app/layout.js 的 ThemeScript 決定）
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...cssVariables(palettes.dark), colorScheme: 'dark' },
        ':root.light': { ...cssVariables(palettes.light), colorScheme: 'light' },
      });
    }),
  ],
};
