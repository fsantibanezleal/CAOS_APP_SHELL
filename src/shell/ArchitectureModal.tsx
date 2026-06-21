// In-app "Architecture / How it works" modal (ADR-0058 — the ⓘ standard, generalised from Veta + Circuita).
// A header ⓘ button opens this modal; each tab pairs ONE hand-authored THEMED SVG (CSS-variable tokens of the shell
// palette, so it repaints with the active theme) with a bilingual explanation. The SVG is fetched + INLINED (an <img>
// would NOT inherit the CSS variables). Apps pass their tabs via ShellConfig.architecture; the depth must be COMPLETE
// (what the app is, what runs web/offline/compute, the web-app flow, the science flow, the data contracts/design).
import { useEffect, useRef, useState } from 'react';
import { useShellLang } from '../lib/lang';

export interface ArchTab {
  id: string;
  /** tab label. */
  en: string;
  es: string;
  /** the explanation body (paragraphs separated by a blank line). */
  body_en: string;
  body_es: string;
  /** an inline '<svg…>…</svg>' string OR a path under the app's public/ (fetched + inlined). */
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
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tab = tabs.find((t) => t.id === active) ?? tabs[0];
  useEffect(() => {
    if (!tab) return;
    setErr(null);
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

  if (!tab) return null;
  const title = (es ? config.title_es : config.title_en) ?? (es ? 'Arquitectura / Cómo funciona' : 'Architecture / How it works');
  const body = (es ? tab.body_es : tab.body_en).split(/\n\s*\n/);

  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
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
              <button key={t.id} role="tab" aria-selected={sel} onClick={() => setActive(t.id)}
                      style={{ fontSize: 12.5, padding: '5px 10px', borderRadius: '6px 6px 0 0', border: '1px solid var(--color-border)', borderBottom: 'none', cursor: 'pointer',
                               background: sel ? 'var(--color-accent)' : 'transparent', color: sel ? 'var(--color-accent-fg, #fff)' : 'var(--color-fg-subtle)', fontWeight: sel ? 600 : 400 }}>
                {es ? t.es : t.en}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" style={{ overflowY: 'auto', padding: '14px 16px 18px' }}>
          {body.map((p, i) => (
            <p key={i} style={{ color: 'var(--color-fg)', fontSize: 13, lineHeight: 1.65, margin: i === 0 ? '0 0 10px' : '10px 0' }}>{p}</p>
          ))}
          {err && <div style={{ color: 'var(--color-warn, #f87171)', fontSize: 12 }}>SVG: {err}</div>}
          {!err && svg === null && <div style={{ color: 'var(--color-fg-faint)', fontSize: 12 }}>…</div>}
          {svg !== null && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 8, background: 'var(--color-bg, var(--color-surface))', overflowX: 'auto' }}
                 // Own static asset, hand-authored in the app repo — not user input.
                 dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>
      </div>
    </div>
  );
}
