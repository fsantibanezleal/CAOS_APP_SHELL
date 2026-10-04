import type { Lang } from './lang';

// Header/footer chrome strings, identical across every CAOS / Faena app (the shell owns them so
// header & footer can never drift). App-specific strings (nav labels, page content) live in the app.
const CHROME = {
  en: {
    github: 'Source on GitHub',
    personal: 'Personal site',
    portfolio: 'Portfolio',
    toggleTheme: 'Toggle light / dark',
    toggleLanguage: 'Switch language',
    light: 'Light',
    dark: 'Dark',
    attribution: 'Developed by Felipe Santibáñez-Leal',
    complement: 'A CAOS research project',
    license: '',
    version: 'v',
  },
  es: {
    github: 'Código en GitHub',
    personal: 'Sitio personal',
    portfolio: 'Portafolio',
    toggleTheme: 'Cambiar claro / oscuro',
    toggleLanguage: 'Cambiar idioma',
    light: 'Claro',
    dark: 'Oscuro',
    attribution: 'Desarrollado por Felipe Santibáñez-Leal',
    complement: 'Un proyecto de investigación CAOS',
    license: '',
    version: 'v',
  },
} as const;

/** Each chrome string as plain text: `as const` keeps the keys exact, and the values must not be the English
 * literals, or the Spanish object is not assignable (tsc 5.9 rejects it). */
export type ChromeStrings = { readonly [K in keyof (typeof CHROME)['en']]: string };
export const chrome = (lang: Lang): ChromeStrings => CHROME[lang];
