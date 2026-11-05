import { useMemo, useState, useEffect, useRef } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';

export type CalloutState = 'alarm' | 'warning' | 'normal' | 'selected' | 'inactive';
export interface SceneCalloutDef {
  id: string;
  eyebrow: BiText;
  value: string;
  /** Every displayed quantity carries its physical unit (or a domain ratio name). */
  unit: BiText;
  state: CalloutState;
  anchor: { x: number; y: number };
  /** Provenance or derivation for the displayed value, in the reader's language. */
  source: BiText;
  trend?: 'up' | 'down' | 'flat';
}
export interface CalloutBox { id: string; left: number; top: number; width: number; height: number; anchorX: number; anchorY: number; }

const overlaps = (a: CalloutBox, b: CalloutBox) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
const coversAnchor = (box: CalloutBox, x: number, y: number, clearance = 8) =>
  x >= box.left - clearance && x <= box.left + box.width + clearance && y >= box.top - clearance && y <= box.top + box.height + clearance;

/** Deterministic callout placement, exported so a product can test its scene geometry before rendering. */
export function layoutSceneCallouts(items: SceneCalloutDef[], width: number, height: number, compact = false): CalloutBox[] {
  const w = compact ? 142 : 184;
  const h = compact ? 56 : 68;
  const margin = 8;
  const boxes: CalloutBox[] = [];
  for (const item of items) {
    const x = Math.max(0, Math.min(width, item.anchor.x * width));
    const y = Math.max(0, Math.min(height, item.anchor.y * height));
    const d = compact ? 82 : 112;
    const candidates = [
      [x + d, y - h / 2], [x - d - w, y - h / 2], [x + d, y - h / 2 - h - 12], [x - d - w, y - h / 2 - h - 12],
      [x - w / 2, y - d - h], [x - w / 2, y + d],
    ].map(([left, top]) => ({ id: item.id, left: Math.max(margin, Math.min(width - w - margin, left!)), top: Math.max(margin, Math.min(height - h - margin, top!)), width: w, height: h, anchorX: x, anchorY: y }));
    const ranked = candidates.map((candidate) => ({ candidate, score:
      boxes.reduce((score, box) => score + (overlaps(candidate, box) ? 1_000_000 : 0), 0) +
      items.reduce((score, subject) => score + (coversAnchor(candidate, subject.anchor.x * width, subject.anchor.y * height) ? 10_000_000 : 0), 0) +
      Math.hypot(candidate.left + w / 2 - x, candidate.top + h / 2 - y) }));
    ranked.sort((a, b) => a.score - b.score);
    boxes.push(ranked[0]!.candidate);
  }
  return boxes;
}

/** Callout cards in a reserved top band; leaders retain their individual scene anchors. */
export function layoutCalloutHeader(items: SceneCalloutDef[], width: number, height: number, compact = false): CalloutBox[] {
  const w = compact ? 164 : 184, h = compact ? 54 : 68, margin = 8, gap = compact ? 6 : 8;
  const columns = width < 520 ? 2 : Math.max(1, Math.min(items.length, Math.floor((width - margin * 2 + gap) / (w + gap))));
  return items.map((item, index) => {
    const column = index % columns, row = Math.floor(index / columns), count = Math.min(columns, items.length - row * columns);
    const cell = (width - margin * 2 - gap * (count - 1)) / count;
    return { id: item.id, left: margin + column * (cell + gap) + (cell - w) / 2, top: margin + row * (h + gap), width: w, height: h, anchorX: item.anchor.x * width, anchorY: item.anchor.y * height };
  });
}

/** Overlay anchored value labels on a stage; normalized anchors are reprojected by the product as the camera moves. */
export function SceneCallouts({ items, className, placement = 'anchored' }: { items: SceneCalloutDef[]; className?: string; placement?: 'anchored' | 'header' }) {
  const lang = useShellLang();
  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => { const rect = entries[0]?.contentRect; if (rect) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const boxes = useMemo(() => {
    if (placement === 'anchored') return layoutSceneCallouts(items, size.width, size.height, size.width < 640);
    return layoutCalloutHeader(items, size.width, size.height, size.width < 640);
  }, [items, placement, size]);
  return <div ref={host} className={['caos-callout-layer', className].filter(Boolean).join(' ')} aria-label={lang === 'es' ? 'Valores fijados a los componentes' : 'Values anchored to components'} data-caos-callout-layer="" data-placement={placement}>
    <svg className="caos-callout-leaders" aria-hidden="true" viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`} preserveAspectRatio="none">{boxes.map((box) => <line key={box.id} x1={box.anchorX} y1={box.anchorY} x2={box.left + box.width / 2} y2={box.top + box.height / 2} data-caos-callout-leader={box.id}/>)}</svg>
    {boxes.map((box) => { const item = items.find((candidate) => candidate.id === box.id)!; return <article key={box.id} className="caos-scene-callout" data-caos-callout={item.id} data-callout-value={item.value} data-callout-unit={pick(item.unit, lang)} data-callout-state={item.state} data-callout-source={pick(item.source, lang)} data-callout-anchor-x={item.anchor.x} data-callout-anchor-y={item.anchor.y} style={{ left: box.left, top: box.top, width: box.width, minHeight: box.height }}>
      <span className="caos-callout-eyebrow" title={pick(item.eyebrow, lang)}>{pick(item.eyebrow, lang)}</span><strong title={`${item.value} ${pick(item.unit, lang)}`}>{item.value} <small>{pick(item.unit, lang)}</small></strong>{item.trend && <span className={`caos-callout-trend trend-${item.trend}`} aria-label={item.trend}>{item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}</span>}<small className="caos-callout-source" title={pick(item.source, lang)}>{pick(item.source, lang)}</small>
    </article>; })}
  </div>;
}
