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

/**
 * The pre-paint script for index.html (inline, before the bundle): applies the stored or preferred theme and the
 * stored language before the first frame, so a light-theme user never sees a dark flash and the document language
 * is right from the start (ADR-0011, ADR-0012). Keys match the shell stores.
 */
export const THEME_BOOT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('caos.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}" +
  "document.documentElement.dataset.theme=t;var l=localStorage.getItem('caos.lang');document.documentElement.lang=l==='es'?'es':'en'}" +
  "catch(e){document.documentElement.dataset.theme='dark'}})();";
