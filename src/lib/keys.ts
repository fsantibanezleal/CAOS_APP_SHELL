/**
 * The storage keys the shell reads and writes. Exported (and built as their own entry, `dist/keys.js`) so the
 * measured gate sets the theme and the language exactly the way the shell reads them, instead of guessing the
 * key names (failure class 10 of the 2026-10-04 history: gates that measured the wrong mode).
 */
export const THEME_STORAGE_KEY = 'caos.theme';
export const LANG_STORAGE_KEY = 'caos.lang';

/**
 * The pre-paint script for index.html (inline, before the bundle): applies the stored or preferred theme and the
 * stored language before the first frame, so a light-theme user never sees a dark flash and the document language
 * is right from the start (ADR-0011, ADR-0012). Built from the keys above, so the two cannot drift; exported from
 * this React-free entry so a build config can inline it.
 */
export const THEME_BOOT_SCRIPT =
  `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}` +
  `document.documentElement.dataset.theme=t;var l=localStorage.getItem('${LANG_STORAGE_KEY}');document.documentElement.lang=l==='es'?'es':'en'}` +
  "catch(e){document.documentElement.dataset.theme='dark'}})();";

/** The six standard routes, for build scripts that run without React (route materialisation, the gate). */
export { STANDARD_ROUTES } from '../shell/routes';
