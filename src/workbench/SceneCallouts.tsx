import { useMemo, useState, useEffect, useRef, type CSSProperties } from 'react';
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
/** Measured card heights in CSS pixels by callout id; a callout without one is laid out at the nominal height. */
export type CalloutHeights = Readonly<Record<string, number>>;

/**
 * The state as a word with a glyph of its own shape (ADR-0082 rule 8: a state is never shown by colour alone). The border
 * colour stays as well; the glyph is in the text colour, so the shape and the word carry the state without it.
 */
const STATE_LABELS: Record<CalloutState, { glyph: string; en: string; es: string }> = {
  alarm: { glyph: '▲', en: 'alarm', es: 'alarma' },
  warning: { glyph: '◆', en: 'warning', es: 'aviso' },
  normal: { glyph: '●', en: 'normal', es: 'normal' },
  selected: { glyph: '◎', en: 'selected', es: 'seleccionado' },
  inactive: { glyph: '○', en: 'inactive', es: 'inactivo' },
};

const overlaps = (a: CalloutBox, b: CalloutBox) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
const coversAnchor = (box: CalloutBox, x: number, y: number, clearance = 8) =>
  x >= box.left - clearance && x <= box.left + box.width + clearance && y >= box.top - clearance && y <= box.top + box.height + clearance;

/** Deterministic callout placement, exported so a product can test its scene geometry before rendering. */
export function layoutSceneCallouts(items: SceneCalloutDef[], width: number, height: number, compact = false, heights?: CalloutHeights): CalloutBox[] {
  const w = compact ? 142 : 184;
  const nominal = compact ? 56 : 68;
  const margin = 8;
  const boxes: CalloutBox[] = [];
  for (const item of items) {
    const h = heights?.[item.id] ?? nominal;
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

/** Whether two leaders (anchor to card centre) cross at a point inside both. */
function leadersCross(a: CalloutBox, b: CalloutBox) {
  const [x1, y1, x2, y2] = [a.anchorX, a.anchorY, a.left + a.width / 2, a.top + a.height / 2];
  const [x3, y3, x4, y4] = [b.anchorX, b.anchorY, b.left + b.width / 2, b.top + b.height / 2];
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

/** Every order of 0..n-1, the identity first and then in lexicographic order, so a tie keeps the order closest to the given one. */
function* orders(n: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === n) { yield prefix; return; }
  for (let i = 0; i < n; i += 1) if (!prefix.includes(i)) yield* orders(n, [...prefix, i]);
}

/**
 * Callout cards in a reserved top band; leaders retain their individual scene anchors. The cards are read in the order of
 * their anchors' x (stable for equal x) and placed in rows from left to right, each row as tall as its tallest card, so a card
 * that grew when its text wrapped never covers the next row (known defect 60). `heights` are the measured card heights
 * (SceneCallouts measures its cards and lays them out again when one changes); without them the nominal heights are used.
 * When that order would make two leaders cross (anchors at different depths), the slot order with the fewest crossings is
 * taken instead, the anchor order winning every tie. The boxes are returned in anchor x order.
 */
export function layoutCalloutHeader(items: SceneCalloutDef[], width: number, height: number, compact = false, heights?: CalloutHeights): CalloutBox[] {
  const nominalW = compact ? 164 : 184, nominalH = compact ? 54 : 68, margin = 8, gap = compact ? 6 : 8;
  // a compact card may narrow to 140 px to keep two columns on a phone; below that, one column
  const minW = compact ? 140 : nominalW;
  const sorted = items.map((item, index) => ({ item, index })).sort((a, b) => a.item.anchor.x - b.item.anchor.x || a.index - b.index).map(({ item }) => item);
  if (!sorted.length) return [];
  const columns = Math.max(1, Math.min(sorted.length, Math.floor((width - margin * 2 + gap) / (minW + gap))));
  const place = (slots: SceneCalloutDef[]) => {
    const boxes: CalloutBox[] = [];
    let top = margin;
    for (let start = 0; start < slots.length; start += columns) {
      const row = slots.slice(start, start + columns);
      const cell = (width - margin * 2 - gap * (row.length - 1)) / row.length;
      const w = Math.max(0, Math.min(nominalW, cell));
      const rowHeight = Math.max(...row.map((item) => heights?.[item.id] ?? nominalH));
      row.forEach((item, column) => boxes.push({ id: item.id, left: margin + column * (cell + gap) + (cell - w) / 2, top, width: w, height: heights?.[item.id] ?? nominalH, anchorX: item.anchor.x * width, anchorY: item.anchor.y * height }));
      top += rowHeight + gap;
    }
    return boxes;
  };
  const crossings = (boxes: CalloutBox[]) => { let count = 0; for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) if (leadersCross(boxes[i]!, boxes[j]!)) count += 1; return count; };
  let best = place(sorted);
  let fewest = crossings(best);
  // at most 6 callouts are searched (720 orders, ADR-0082 asks for 3 to 6 per view); more keep the anchor order
  if (fewest > 0 && sorted.length <= 6) {
    for (const order of orders(sorted.length)) {
      const boxes = place(order.map((i) => sorted[i]!));
      const count = crossings(boxes);
      if (count < fewest) { best = boxes; fewest = count; if (count === 0) break; }
    }
  }
  const at = new Map(best.map((box) => [box.id, box]));
  return sorted.map((item) => at.get(item.id)!);
}

/**
 * Overlay anchored value labels on a stage; normalized anchors are reprojected by the product as the camera moves.
 * The layer measures its cards and lays them out on their real heights. In the header placement it sets
 * `--caos-callout-band` (px) on the layer and calls `onLayout` with the band height: the distance from the top of the
 * layer to the bottom of the lowest card, which a product reserves above its drawing instead of a nominal band.
 * Since 0.26.0 the band is reported only for a settled layout (known defect 65): every card measured at the width it is
 * drawn with now (a height taken in an earlier layout, a 0 px stage or a card out of layout, is not used for the band), and
 * the layout unchanged for one frame. Until the first such layout the property is not set; after it, it holds the last
 * settled band until the next one, so a product that pads its drawing by it never sees a transient value.
 */
export function SceneCallouts({ items, className, placement = 'anchored', onLayout }: { items: SceneCalloutDef[]; className?: string; placement?: 'anchored' | 'header'; onLayout?: (info: { bandHeight: number }) => void }) {
  const lang = useShellLang();
  const host = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // each card's measured border box: its height, and the width it was drawn with when it was measured
  const [cards, setCards] = useState<Record<string, { height: number; width: number }>>({});
  const [band, setBand] = useState<number | null>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => { const rect = entries[0]?.contentRect; if (rect) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const ids = items.map((item) => item.id).join('\u0000');
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    setCards({});
    // the border box, unaffected by the transforms of a story's stage transition; a card out of layout (0 px) is not measured
    const observer = new ResizeObserver((entries) => setCards((previous) => {
      let next = previous;
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.caosCallout;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight;
        const width = entry.borderBoxSize?.[0]?.inlineSize ?? (entry.target as HTMLElement).offsetWidth;
        const was = id === undefined ? undefined : previous[id];
        if (id === undefined || !(height > 0) || !(width > 0) || (was && Math.abs(was.height - height) <= 0.25 && Math.abs(was.width - width) <= 0.25)) continue;
        if (next === previous) next = { ...previous };
        next[id] = { height, width };
      }
      return next;
    }));
    node.querySelectorAll<HTMLElement>('[data-caos-callout]').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [ids, placement]);
  const heights = useMemo(() => Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.height])), [cards]);
  const compact = size.width < 640;
  const boxes = useMemo(() => {
    if (placement === 'anchored') return layoutSceneCallouts(items, size.width, size.height, compact, heights);
    return layoutCalloutHeader(items, size.width, size.height, compact, heights);
  }, [items, placement, size, compact, heights]);
  const nominalH = placement === 'anchored' ? (compact ? 56 : 68) : (compact ? 54 : 68);
  const bandHeight = placement === 'header' && boxes.length ? Math.max(...boxes.map((box) => box.top + box.height)) : 0;
  // every card measured at the width it is laid out with now: a height from another layout is stale
  const measured = boxes.length === items.length && boxes.every((box) => { const c = cards[box.id]; return c !== undefined && Math.abs(c.width - box.width) <= 0.5; });
  const layoutSignature = JSON.stringify([size.width, size.height, boxes.map(({ id, left, top, width, height }) => [id, left, top, width, height])]);
  const report = useRef(onLayout);
  report.current = onLayout;
  const reported = useRef<number | null>(null);
  // a layout that holds for one frame is settled: the band is set and reported once per real change
  useEffect(() => {
    if (placement !== 'header' || size.width <= 0 || !measured) return undefined;
    const frame = requestAnimationFrame(() => {
      setBand(bandHeight);
      if (reported.current === null || Math.abs(reported.current - bandHeight) > 0.01) {
        reported.current = bandHeight;
        report.current?.({ bandHeight });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [placement, size.width, measured, layoutSignature, bandHeight]);
  const style = placement === 'header' && band !== null ? ({ '--caos-callout-band': `${band}px` } as CSSProperties) : undefined;
  return <div ref={host} className={['caos-callout-layer', className].filter(Boolean).join(' ')} style={style} aria-label={lang === 'es' ? 'Valores fijados a los componentes' : 'Values anchored to components'} data-caos-callout-layer="" data-placement={placement}>
    <svg className="caos-callout-leaders" aria-hidden="true" viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`} preserveAspectRatio="none">{boxes.map((box) => <line key={box.id} x1={box.anchorX} y1={box.anchorY} x2={box.left + box.width / 2} y2={box.top + box.height / 2} data-caos-callout-leader={box.id}/>)}</svg>
    {boxes.map((box) => { const item = items.find((candidate) => candidate.id === box.id)!; const state = Object.prototype.hasOwnProperty.call(STATE_LABELS, item.state) ? STATE_LABELS[item.state] : null; return <article key={box.id} className="caos-scene-callout" data-caos-callout={item.id} data-callout-value={item.value} data-callout-unit={pick(item.unit, lang)} data-callout-state={item.state} data-callout-source={pick(item.source, lang)} data-callout-anchor-x={item.anchor.x} data-callout-anchor-y={item.anchor.y} style={{ left: box.left, top: box.top, width: box.width, minHeight: nominalH }}>
      <span className="caos-callout-eyebrow" title={pick(item.eyebrow, lang)}>{pick(item.eyebrow, lang)}</span><strong title={`${item.value} ${pick(item.unit, lang)}`}>{item.value} <small>{pick(item.unit, lang)}</small></strong>{item.trend && <span className={`caos-callout-trend trend-${item.trend}`} aria-label={item.trend}>{item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}</span>}{state && <span className="caos-callout-state" data-callout-state-label=""><span className="caos-callout-state-glyph" aria-hidden="true" data-callout-state-glyph="">{state.glyph}</span>{state[lang]}</span>}<small className="caos-callout-source" title={pick(item.source, lang)}>{pick(item.source, lang)}</small>
    </article>; })}
  </div>;
}
