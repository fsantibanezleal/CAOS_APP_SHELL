/**
 * The storage keys the shell reads and writes. Exported (and built as their own entry, `dist/keys.js`) so the
 * measured gate sets the theme and the language exactly the way the shell reads them, instead of guessing the
 * key names (failure class 10 of the 2026-10-04 history: gates that measured the wrong mode).
 */
export const THEME_STORAGE_KEY = 'caos.theme';
export const LANG_STORAGE_KEY = 'caos.lang';
