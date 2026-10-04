import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useInRouterContext, useLocation } from 'react-router';
import { Boxes, Briefcase, CodeXml, Globe, Info } from 'lucide-react';
import { useShellLang } from '../lib/lang';
import { chrome } from '../lib/chrome';
import { PanelBoundary } from '../lib/PanelBoundary';
import { useOverflowFade } from '../lib/overflow';
import { type BiText, pick } from '../lib/text';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { type ArchitectureConfig, ArchitectureModal, validateArchitectureConfig } from './ArchitectureModal';

export interface ShellRoute {
  path: string;
  en: string;
  es: string;
}

export interface ShellConfig {
  /** Brand: product name + optional lucide icon element (defaults to a generic mark). */
  product: { name: string; mark?: ReactNode };
  /** Top-level routes for the header nav (use `STANDARD_ROUTES`). 0 or 1 entries hide the nav (a hub). */
  routes?: ShellRoute[];
  /** External links. personal/portfolio default to Felipe's canonical URLs (kept identical app-to-app). */
  links: { github: string; personal?: string; portfolio?: string };
  /** Display version `X.XX.XXX`, read from the repo's VERSION (ADR-0068); a semver form is reported. */
  version: string;
  /** Short commit SHA of the build, printed after the version so the deployed build is identifiable. */
  build?: string;
  /** The product's licence as the footer shows it. Required: the shell's own licence is not inherited, and a
   * default "MIT · open source" once appeared on private products (failure class 16). */
  license: BiText;
  /** Repository visibility. A private product shows no source link in the header or the footer. */
  visibility: 'public' | 'private';
  /** In-app Architecture / "How it works" modal (ADR-0058). When present, an info button appears in the header. */
  architecture?: ArchitectureConfig;
  /** Footer provenance + honesty (ADR-0016 s2): the real data/engine source with citation + licence, and the
   * one-line honest disclaimer of how the app runs. */
  footer?: {
    /** Explicit product attribution, or false when the product excludes personal attribution. */
    attribution?: { en: string; es: string } | false;
    /** @deprecated use `ShellConfig.license`. */
    license?: { en: string; es: string };
    provenance?: { en: string; es: string };
    disclaimer?: { en: string; es: string };
  };
  /** Routes whose surface IS the viewport (ADR-0071 rule 1), matched exactly or by prefix for a non-root path. */
  fixedRoutes?: string[];
  /** Every route fixed: a single-surface app (a hub, a one-page tool). */
  fixed?: boolean;
  /**
   * Every route is the viewport (ADR-0071 rule 1, as amended 2026-10-04): the workbench (`WorkbenchLayout`) fills
   * it, and a documentation route scrolls INSIDE the main container, so the header and footer stay in view and the
   * document itself never scrolls. The configuration the product template uses.
   */
  contain?: boolean;
}

const PERSONAL = 'https://fsantibanezleal.github.io';
const PORTFOLIO = 'https://fasl-work.com';
const DISPLAY_VERSION = /^\d+\.\d{2}\.\d{3}$/;

function validate(config: ShellConfig): void {
  if (!DISPLAY_VERSION.test(config.version)) {
    console.error(`[caos-app-shell] version "${config.version}" is not the display form X.XX.XXX (ADR-0068)`);
  }
  if (!config.license && !config.footer?.license) {
    console.error('[caos-app-shell] ShellConfig.license is required: the footer shows the product licence');
  }
  if (config.visibility !== 'public' && config.visibility !== 'private') {
    console.error('[caos-app-shell] ShellConfig.visibility is required ("public" or "private")');
  }
  if (config.architecture) {
    for (const problem of validateArchitectureConfig(config.architecture)) console.error(`[caos-app-shell] ${problem}`);
  }
}

/** The route links: `NavLink` inside a router, plain anchors (and a reported error) outside one. */
function Nav({ routes, name, routed }: { routes: ShellRoute[]; name: string; routed: boolean }) {
  const lang = useShellLang();
  const ref = useRef<HTMLElement | null>(null);
  const path = routed ? '' : typeof window !== 'undefined' ? window.location.pathname : '/';
  useOverflowFade(ref, '.nav-link.active', [lang, path]);
  return (
    <nav className="main-nav" aria-label={name} ref={ref}>
      {routes.map((r) =>
        routed ? (
          <NavLink
            key={r.path}
            to={r.path}
            end={r.path === '/'}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {lang === 'es' ? r.es : r.en}
          </NavLink>
        ) : (
          <a key={r.path} href={r.path} className={path === r.path ? 'nav-link active' : 'nav-link'}>
            {lang === 'es' ? r.es : r.en}
          </a>
        ),
      )}
    </nav>
  );
}

function RoutedPath({ children }: { children: (pathname: string) => ReactNode }) {
  const { pathname } = useLocation();
  return <>{children(pathname)}</>;
}

/** The shared CAOS/Faena app shell: sticky header (brand + nav + icon-links + lang/theme) + footer.
 * Wrap your <Routes> (or single landing) in it, inside a Router. */
export function AppShell({ config, children }: { config: ShellConfig; children: ReactNode }) {
  const routed = useInRouterContext();
  useEffect(() => {
    if (!routed) {
      console.error(
        '[caos-app-shell] AppShell is outside a Router context. If a Router is mounted, two copies of react-router ' +
          'are installed: depend on react-router (not react-router-dom) and add resolve.dedupe ' +
          "['react', 'react-dom', 'react-router'] to vite.config.ts.",
      );
    }
  }, [routed]);
  useEffect(() => {
    validate(config);
    // validated once per mount: a product's configuration is static
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (routed) return <RoutedPath>{(pathname) => <Frame config={config} pathname={pathname} routed>{children}</Frame>}</RoutedPath>;
  return (
    <Frame config={config} pathname={typeof window !== 'undefined' ? window.location.pathname : '/'} routed={false}>
      {children}
    </Frame>
  );
}

function Frame({ config, pathname, routed, children }: { config: ShellConfig; pathname: string; routed: boolean; children: ReactNode }) {
  const lang = useShellLang();
  const c = chrome(lang);
  const routes = config.routes ?? [];
  const personal = config.links.personal ?? PERSONAL;
  const portfolio = config.links.portfolio ?? PORTFOLIO;
  const isPublic = config.visibility !== 'private';
  const [archOpen, setArchOpen] = useState(false);
  // ADR-0011: the document language follows the language toggle (screen readers, hyphenation, spell-check).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const archLabel = lang === 'es' ? 'Arquitectura / Cómo funciona' : 'Architecture / How it works';
  const fixed =
    config.contain === true ||
    config.fixed === true ||
    (config.fixedRoutes ?? []).some((p) => p === pathname || (p !== '/' && pathname.startsWith(p.replace(/\/$/, '') + '/')));
  const license = config.license ? pick(config.license, lang) : config.footer?.license?.[lang] ?? '';
  const brand = (
    <>
      <span className="brand-mark">{config.product.mark ?? <Boxes size={18} aria-hidden="true" />}</span>
      <span>{config.product.name}</span>
    </>
  );

  return (
    <div className={config.contain ? 'app-shell fixed contain' : fixed ? 'app-shell fixed' : 'app-shell'}>
      <header className="site-header">
        <div className="header-inner">
          {routed ? (
            <NavLink to="/" className="brand" aria-label={config.product.name} data-brand={config.product.name}>
              {brand}
            </NavLink>
          ) : (
            <a href="/" className="brand" aria-label={config.product.name} data-brand={config.product.name}>
              {brand}
            </a>
          )}

          {routes.length > 1 && <Nav routes={routes} name={config.product.name} routed={routed} />}

          <div className="header-actions">
            {isPublic && (
              <a className="icon-btn" href={config.links.github} target="_blank" rel="noreferrer noopener" aria-label={c.github} title={c.github}>
                <CodeXml size={18} aria-hidden="true" />
              </a>
            )}
            <a className="icon-btn" href={personal} target="_blank" rel="noreferrer noopener" aria-label={c.personal} title={c.personal}>
              <Globe size={18} aria-hidden="true" />
            </a>
            <a className="icon-btn" href={portfolio} target="_blank" rel="noreferrer noopener" aria-label={c.portfolio} title={c.portfolio}>
              <Briefcase size={18} aria-hidden="true" />
            </a>
            {config.architecture && (
              <button className="icon-btn" type="button" onClick={() => setArchOpen(true)} aria-label={archLabel} title={archLabel} data-architecture-button="">
                <Info size={18} aria-hidden="true" />
              </button>
            )}
            <span className="header-sep" aria-hidden="true" />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {config.architecture && archOpen && <ArchitectureModal config={config.architecture} onClose={() => setArchOpen(false)} />}

      <main className="page">
        <PanelBoundary panel="page">{children}</PanelBoundary>
      </main>

      {/* ADR-0016 s2: one compact line: provenance + honesty, not re-advertising. The header (s1) already carries
          the personal/portfolio links; NEVER repeat them here. */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-meta">
            <span>{config.product.name}</span>
            <span aria-hidden="true">·</span>
            <span>{c.complement}</span>
            <span aria-hidden="true">·</span>
            <span className="footer-build" data-version={config.version} data-build={config.build ?? ''}>
              <span>
                {c.version}
                {config.version}
                {config.build ? ` · ${config.build}` : ''}
              </span>
            </span>
            {config.footer?.attribution !== false && (
              <>
                <span aria-hidden="true">·</span>
                <span>{config.footer?.attribution?.[lang] ?? c.attribution}</span>
              </>
            )}
            {config.footer?.provenance && (
              <>
                <span aria-hidden="true">·</span>
                <span>{config.footer.provenance[lang]}</span>
              </>
            )}
            {isPublic && (
              <>
                <span aria-hidden="true">·</span>
                <a href={config.links.github} target="_blank" rel="noreferrer noopener">
                  {c.github}
                </a>
              </>
            )}
            {license && (
              <>
                <span aria-hidden="true">·</span>
                <span className="faint">{license}</span>
              </>
            )}
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
