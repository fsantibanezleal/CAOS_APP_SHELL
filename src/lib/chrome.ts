import type { Lang } from './lang';

// Header/footer chrome strings — identical across every CAOS / Faena app (the shell owns them so
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
    license: 'MIT licensed · open source',
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
    license: 'Licencia MIT · código abierto',
    version: 'v',
  },
} as const;

export type ChromeStrings = (typeof CHROME)['en'];
export const chrome = (lang: Lang): ChromeStrings => CHROME[lang];
