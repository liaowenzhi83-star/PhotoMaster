import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  bgElev: string;
  panel: string;
  panel2: string;
  line: string;
  text: string;
  textDim: string;
  textMute: string;
  keep: string;
  keepSoft: string;
  trash: string;
  trashSoft: string;
  accent: string;
  warn: string;
  overlay: string;
};

/* 深色：偏冷的墨绿黑，长时间看图不刺眼 */
export const darkPalette: Palette = {
  bg: '#080B0A',
  bgElev: '#0E1413',
  panel: '#151D1B',
  panel2: '#1D2724',
  line: 'rgba(255,255,255,0.075)',
  text: '#E9F1EE',
  textDim: '#9DAFAA',
  textMute: '#6C7E79',
  keep: '#3DDC97',
  keepSoft: 'rgba(61,220,151,0.14)',
  trash: '#FF6B6B',
  trashSoft: 'rgba(255,107,107,0.14)',
  accent: '#4FD1A5',
  warn: '#F2C14E',
  overlay: 'rgba(4,8,7,0.72)',
};

/* 浅色：低饱和暖白，避免纯白大面积反光 */
export const lightPalette: Palette = {
  bg: '#F2F5F3',
  bgElev: '#FFFFFF',
  panel: '#FFFFFF',
  panel2: '#E8EEEB',
  line: 'rgba(16,34,28,0.10)',
  text: '#12201C',
  textDim: '#516861',
  textMute: '#849790',
  keep: '#0E9A69',
  keepSoft: 'rgba(14,154,105,0.12)',
  trash: '#D93B3B',
  trashSoft: 'rgba(217,59,59,0.10)',
  accent: '#0E9A69',
  warn: '#B77A08',
  overlay: 'rgba(10,20,17,0.42)',
};

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  c: Palette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  c: darkPalette,
  isDark: true,
  mode: 'system',
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  const c = isDark ? darkPalette : lightPalette;

  // system 模式下跟随系统变化（useColorScheme 已自动触发，这里只是显式声明依赖）
  useEffect(() => {
    if (mode === 'system') Appearance.getColorScheme();
  }, [mode, system]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const nowDark = prev === 'system' ? system !== 'light' : prev === 'dark';
      return nowDark ? 'light' : 'dark';
    });
  }, [system]);

  const value = useMemo(() => ({ c, isDark, mode, setMode, toggle }), [c, isDark, mode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
