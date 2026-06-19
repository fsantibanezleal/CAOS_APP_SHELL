import { Languages } from 'lucide-react';
import { useLangStore } from '../lib/lang';
import { chrome } from '../lib/chrome';

/** Language toggle. Shows the current 2-letter code; pressing it swaps and persists. */
export function LanguageToggle() {
  const lang = useLangStore((s) => s.lang);
  const toggle = useLangStore((s) => s.toggle);
  const c = chrome(lang);
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={c.toggleLanguage} title={c.toggleLanguage}>
      <Languages size={18} aria-hidden="true" />
      <span className="lang-code">{lang}</span>
    </button>
  );
}
