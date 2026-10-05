import { create } from 'zustand';
import { THEME_STORAGE_KEY } from './keys';

export type Theme = 'light' | 'dark';
const KEY = THEME_STORAGE_KEY;

export function readTheme(): Theme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: Theme): void {
  try {
    document.documentElement.dataset.theme = t;
  } catch {
    /* ignore (non-DOM env) */
  }
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    set({ theme: next });
  },
  setTheme: (t) => {
    applyTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    set({ theme: t });
  },
}));

// The pre-paint script lives with the storage keys it reads (React-free entry `/keys`).
export { THEME_BOOT_SCRIPT } from './keys';
