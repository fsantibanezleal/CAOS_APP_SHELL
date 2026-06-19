import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../lib/theme';
import { useShellLang } from '../lib/lang';
import { chrome } from '../lib/chrome';

/** Light/dark icon toggle. Shows the icon of the theme you would switch TO. */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const c = chrome(useShellLang());
  return (
    <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={c.toggleTheme} title={c.toggleTheme}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span className="sr-only">{theme === 'dark' ? c.light : c.dark}</span>
    </button>
  );
}
