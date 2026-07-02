import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Boxes, Briefcase, Github, Globe, Info } from 'lucide-react';
import { useShellLang } from '../lib/lang';
import { chrome } from '../lib/chrome';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { type ArchitectureConfig, ArchitectureModal } from './ArchitectureModal';

export interface ShellRoute {
  path: string;
  en: string;
  es: string;
}

export interface ShellConfig {
  /** Brand: product name + optional lucide icon element (defaults to a generic mark). */
  product: { name: string; mark?: ReactNode };
  /** Top-level routes for the header nav. 0–1 entries → nav hidden (e.g. the Faena hub). */
  routes?: ShellRoute[];
  /** External links. personal/portfolio default to Felipe's canonical URLs (kept identical app-to-app). */
  links: { github: string; personal?: string; portfolio?: string };
  /** Human version string (X.XX.XXX) shown in the footer. */
  version: string;
  /** In-app Architecture / "How it works" modal (ADR-0058). When present, an ⓘ button appears in the header. */
  architecture?: ArchitectureConfig;
  /** Footer provenance + honesty (ADR-0016 §2): the real data/engine source with citation +
   * license (e.g. "Engine: lingbot-map (arXiv:2604.14141, Apache-2.0)") and the one-line honest
   * disclaimer of how the app runs. Both optional, both bilingual. */
  footer?: {
    provenance?: { en: string; es: string };
    disclaimer?: { en: string; es: string };
  };
}

const PERSONAL = 'https://fsantibanezleal.github.io';
const PORTFOLIO = 'https://fasl-work.com';

/** The shared CAOS/Faena app shell: sticky header (brand + nav + icon-links + lang/theme) + footer.
 * Wrap your <Routes> (or single landing) in it, inside a Router. */
export function AppShell({ config, children }: { config: ShellConfig; children: ReactNode }) {
  const lang = useShellLang();
  const c = chrome(lang);
  const routes = config.routes ?? [];
  const personal = config.links.personal ?? PERSONAL;
  const portfolio = config.links.portfolio ?? PORTFOLIO;
  const [archOpen, setArchOpen] = useState(false);
  const archLabel = lang === 'es' ? 'Arquitectura / Cómo funciona' : 'Architecture / How it works';

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand" aria-label={config.product.name}>
            <span className="brand-mark">{config.product.mark ?? <Boxes size={18} aria-hidden="true" />}</span>
            <span>{config.product.name}</span>
          </NavLink>

          {routes.length > 1 && (
            <nav className="main-nav" aria-label={config.product.name}>
              {routes.map((r) => (
                <NavLink
                  key={r.path}
                  to={r.path}
                  end={r.path === '/'}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  {lang === 'es' ? r.es : r.en}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="header-actions">
            <a className="icon-btn" href={config.links.github} target="_blank" rel="noreferrer noopener" aria-label={c.github} title={c.github}>
              <Github size={18} aria-hidden="true" />
            </a>
            <a className="icon-btn" href={personal} target="_blank" rel="noreferrer noopener" aria-label={c.personal} title={c.personal}>
              <Globe size={18} aria-hidden="true" />
            </a>
            <a className="icon-btn" href={portfolio} target="_blank" rel="noreferrer noopener" aria-label={c.portfolio} title={c.portfolio}>
              <Briefcase size={18} aria-hidden="true" />
            </a>
            {config.architecture && (
              <button className="icon-btn" type="button" onClick={() => setArchOpen(true)} aria-label={archLabel} title={archLabel}>
                <Info size={18} aria-hidden="true" />
              </button>
            )}
            <span className="header-sep" aria-hidden="true" />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {config.architecture && archOpen && (
        <ArchitectureModal config={config.architecture} onClose={() => setArchOpen(false)} />
      )}

      <main className="page">{children}</main>

      {/* ADR-0016 §2: one compact wrapping line — provenance + honesty, not re-advertising.
          The header (§1) already carries the personal/portfolio links; NEVER repeat them here. */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-meta">
            <span>{config.product.name}</span>
            <span aria-hidden="true">·</span>
            <span>{c.complement}</span>
            <span aria-hidden="true">·</span>
            <span className="footer-build"><span>{c.version}{config.version}</span></span>
            <span aria-hidden="true">·</span>
            <span>{c.attribution}</span>
            {config.footer?.provenance && (
              <>
                <span aria-hidden="true">·</span>
                <span>{config.footer.provenance[lang]}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <a href={config.links.github} target="_blank" rel="noreferrer noopener">{c.github}</a>
            <span aria-hidden="true">·</span>
            <span className="faint">{c.license}</span>
            {config.footer?.disclaimer && (
              <>
                <span aria-hidden="true">·</span>
                <span className="faint">{config.footer.disclaimer[lang]}</span>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
