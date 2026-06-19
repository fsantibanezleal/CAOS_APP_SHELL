import { create } from 'zustand';

export type Lang = 'en' | 'es';
const KEY = 'caos.lang';

function readLang(): Lang {
  // ADR-0011: English is the DEFAULT, always. We do NOT auto-detect navigator.language (that made
  // Spanish browsers open in ES). ES is shown only if the user explicitly chose it (persisted).
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'en' || s === 'es') return s;
  } catch {
    /* ignore */
  }
  return 'en';
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

export const useLangStore = create<LangState>((set, get) => ({
  lang: readLang(),
  setLang: (l) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    set({ lang: l });
  },
  toggle: () => {
    const next: Lang = get().lang === 'en' ? 'es' : 'en';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    set({ lang: next });
  },
}));

/** Current language, for app pages that render language-branched long-form content. */
export const useShellLang = (): Lang => useLangStore((s) => s.lang);
