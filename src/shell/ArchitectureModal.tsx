// In-app "Architecture / How it works" modal (ADR-0058 — the ⓘ standard, generalised from Veta + Circuita).
// A header ⓘ button opens this modal; each tab pairs ONE hand-authored THEMED SVG (CSS-variable tokens of the shell
// palette, so it repaints with the active theme) with a bilingual explanation. The SVG is fetched + INLINED (an <img>
// would NOT inherit the CSS variables). Apps pass their tabs via ShellConfig.architecture; the depth must be COMPLETE
// (what the app is, what runs web/offline/compute, the web-app flow, the science flow, the data contracts/design).
import { useEffect, useId, useRef, useState } from 'react';
import { useShellLang } from '../lib/lang';

export interface ArchTab {
  id: string;
  /** tab label. */
  en: string;
  es: string;
  /** the explanation body (paragraphs separated by a blank line). */
  body_en: string;
  body_es: string;
  /**
   * an inline '<svg…>…</svg>' string OR a path under the app's public/ (fetched + inlined).
   *
   * ONE file carries BOTH languages (ADR-0058). Tag each translatable `<text>` twice at the same
   * coordinates, `class="… l-en"` and `class="… l-es"`; the modal wrapper sets `data-arch-lang`
   * and the shell stylesheet shows exactly one. Two files would be two things to keep in step, and
   * the one that is not on screen is the one that goes stale. Anything language-neutral (a number,
   * a file name, an identifier) needs no pair.
   */
  svg: string;
}

export interface ArchitectureConfig {
  /** modal title override (defaults to "Architecture / How it works"). */
  title_en?: string;
  title_es?: string;
  tabs: ArchTab[];
}

const cache: Record<string, string> = {};

export function ArchitectureModal({ config, onClose }: { config: ArchitectureConfig; onClose: () => void }) {
  const lang = useShellLang();
  const es = lang === 'es';
  const tabs = config.tabs;
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const [svg, setSvg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const [nativeWidth, setNativeWidth] = useState(800);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const id = useId();

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])].filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); latestClose.current(); }
      if (e.key !== 'Tab') return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (!first || !last) { e.preventDefault(); return; }
      if (!modalRef.current?.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Node && !modalRef.current?.contains(e.target)) closeRef.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  useEffect(() => {
    if (!tab) return;
    setErr(null);
    setFullSize(false);
    const raw = tab.svg.trim();
    if (raw.startsWith('<svg')) { setSvg(raw); return; }
    if (cache[raw]) { setSvg(cache[raw]); return; }
    setSvg(null);
    let cancelled = false;
    // the consuming app is a Vite SPA; read its BASE_URL defensively (the shell itself is a plain library).
    const baseUrl = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
    const url = baseUrl + raw.replace(/^\//, '');
    fetch(url)
      .then(async (r) => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); })
      .then((text) => { cache[raw] = text; if (!cancelled) setSvg(text); })
      .catch((e) => { if (!cancelled) setErr(String((e as Error)?.message ?? e)); });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    const element = diagramRef.current?.querySelector('svg');
    if (!element) return;
    const width = element.viewBox.baseVal.width || element.width.baseVal.value;
    setNativeWidth(Number.isFinite(width) && width > 0 ? width : 800);
  }, [svg]);

  if (!tab) return null;
  const title = (es ? config.title_es : config.title_en) ?? (es ? 'Arquitectura / Cómo funciona' : 'Architecture / How it works');
  const body = (es ? tab.body_es : tab.body_en).split(/\n\s*\n/);

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
         style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
           style={{ background: 'var(--color-surface)', color: 'var(--color-fg)', border: '1px solid var(--color-border)', borderRadius: 10, width: '100%', maxWidth: 1000, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--color-surface-2, var(--color-surface))', borderBottom: '1px solid var(--color-border)' }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button ref={closeRef} onClick={onClose} aria-label={es ? 'cerrar' : 'close'}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-fg-subtle)', cursor: 'pointer' }}>
            {es ? 'cerrar' : 'close'} ✕
          </button>
        </header>

        <div role="tablist" aria-label={title} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 14px 0', borderBottom: '1px solid var(--color-border)' }}>
          {tabs.map((t) => {
            const sel = t.id === active;
            return (
              <button key={t.id} id={`${id}-${t.id}`} role="tab" aria-selected={sel} aria-controls={`${id}-panel`} tabIndex={sel ? 0 : -1} onClick={() => setActive(t.id)}
                      onKeyDown={event => {
                        const index = tabs.indexOf(t);
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : -1;
                        if (next < 0) return;
                        event.preventDefault(); setActive(tabs[next].id);
                        document.getElementById(`${id}-${tabs[next].id}`)?.focus();
                      }}
                      style={{ fontSize: 12.5, padding: '5px 10px', borderRadius: '6px 6px 0 0', border: '1px solid var(--color-border)', borderBottom: 'none', cursor: 'pointer',
                               background: sel ? 'var(--color-accent)' : 'transparent', color: sel ? 'var(--color-accent-fg, #fff)' : 'var(--color-fg-subtle)', fontWeight: sel ? 600 : 400 }}>
                {es ? t.es : t.en}
              </button>
            );
          })}
        </div>

        {/* data-arch-lang lives on the panel, not on the diagram wrapper: the wrapper only exists
            once the SVG has loaded, and the stylesheet needs a stable ancestor to key on. */}
        <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab.id}`} data-arch-lang={es ? 'es' : 'en'} style={{ overflowY: 'auto', minHeight: 0, padding: '14px 16px 18px' }}>
          {body.map((p, i) => (
            <p key={i} style={{ color: 'var(--color-fg)', fontSize: 13, lineHeight: 1.65, margin: i === 0 ? '0 0 10px' : '10px 0' }}>{p}</p>
          ))}
          {err && <div style={{ color: 'var(--color-warn, #f87171)', fontSize: 12 }}>SVG: {err}</div>}
          {!err && svg === null && <div style={{ color: 'var(--color-fg-faint)', fontSize: 12 }}>…</div>}
          {svg !== null && (
            <>
              <button type="button" aria-pressed={fullSize} aria-controls={`${id}-diagram`} onClick={() => setFullSize(value => !value)} style={{ margin: '0 0 8px', fontSize: 12, padding: '5px 10px' }}>
                {fullSize ? (es ? 'Ajustar diagrama' : 'Fit diagram') : (es ? 'Leer a tamaño completo' : 'Read at full size')}
              </button>
              <div id={`${id}-diagram`} role="region" aria-label={es ? 'Diagrama de arquitectura' : 'Architecture diagram'} tabIndex={0} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, background: 'var(--color-bg, var(--color-surface))', overflow: 'auto', maxWidth: '100%' }}>
                <div ref={diagramRef} className="caos-architecture-diagram" style={{ width: fullSize ? nativeWidth : '100%', maxWidth: fullSize ? 'none' : '100%' }}
                     // Own static asset, hand-authored in the app repo — not user input.
                     dangerouslySetInnerHTML={{ __html: svg }} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
