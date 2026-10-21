const { colors } = require('./lib/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // lib/format.js 會組出 text-up / bg-down 等 class，也要納入掃描
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.js'],
  theme: {
    extend: {
      colors,
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
  plugins: [],
};
