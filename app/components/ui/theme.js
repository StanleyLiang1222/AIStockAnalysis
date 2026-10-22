'use client';

import { useCallback, useEffect, useState } from 'react';
import { LIGHT_QUERY, THEME_OPTIONS, THEME_STORAGE_KEY } from '@/lib/theme-mode';

function readPreference() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_OPTIONS.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(preference) {
  const light = preference === 'light' || (preference === 'system' && window.matchMedia(LIGHT_QUERY).matches);
  document.documentElement.classList.toggle('light', light);
}

/**
 * 目前的模式設定（'system' | 'light' | 'dark'）與切換函式。跟隨系統時，系統切換深淺色會即時套用。
 * 伺服器渲染時一律回傳 'system'，載入後才讀取實際設定（按鈕圖示可能在載入瞬間更新一次）。
 */
export function useTheme() {
  const [preference, setPreference] = useState('system');

  useEffect(() => {
    setPreference(readPreference());
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const media = window.matchMedia(LIGHT_QUERY);
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const change = useCallback((next) => {
    setPreference(next);
    applyTheme(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 無法儲存時只影響這次瀏覽
    }
  }, []);

  return { preference, change };
}
