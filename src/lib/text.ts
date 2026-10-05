import type { Lang } from './lang';

/** A string shown to users: one language-neutral string (a number, a code, a name) or both languages. */
export type BiText = string | { en: string; es: string };

/** The text for the current language. English is the canonical fallback (ADR-0011). */
export function pick(text: BiText | undefined, lang: Lang): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;
  return text[lang] ?? text.en;
}
