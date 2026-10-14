import type { BiText } from '../lib/text';

/** The words Focus mode writes (the product writes none of them). */
export const FOCUS_TEXT = {
  enter: { en: 'Focus', es: 'Enfocar' },
  enterLabel: { en: 'Open this case in focus mode', es: 'Abrir este caso en modo enfoque' },
  exit: { en: 'Back to the App', es: 'Volver a la App' },
  stage: { en: 'Focus stage', es: 'Escenario de enfoque' },
} as const;

/** The query parameter that holds Focus mode (`?focus=1`), beside `?case=` and `?view=`. */
export const FOCUS_PARAM = 'focus';

/** What a product may say about the Focus mode of its App (`CaseWorkbench.focus`; `true` means all defaults). */
export interface CaseFocusConfig {
  /** The stage's heading (default: the name of the selected case). */
  title?: BiText;
  /** One line under it (default: the name of the open group). */
  description?: BiText;
  /** Readouts laid over the stage (ADR-0070): at most four on a phone. */
  hud?: Array<{ label: BiText; value: string }>;
  /** Called when Focus opens (`true`) and closes (`false`), for a product that records it. */
  onChange?: (on: boolean) => void;
  /** The query parameter (default `focus`). */
  param?: string;
}
