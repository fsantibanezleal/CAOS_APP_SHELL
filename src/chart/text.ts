/**
 * Text that fits the drawing it labels, measured in the font the page renders.
 *
 * Products drew their axes and labels with fixed margins and a fixed width per character. The Linux fonts (DejaVu
 * Sans) are wider than the Windows ones and Spanish labels are longer than English ones, so a column sized for one
 * ran its labels out of the drawing in the other (CAOS_Fragmenta 0.05.000: "Tamaño medio clásico, limitado al bloque
 * in situ" read "dio clásico, limitado al bloque in situ"; its deploy gate failed on Linux). Here a label is measured
 * with the canvas text metrics of the page's own font (`--font-sans`, which the gate's wide-font pass replaces),
 * broken over two lines at a word when it does not fit, and only then shortened with an ellipsis, so the drawing can
 * give the whole label as its title. Ported from CAOS_Fragmenta `viz/text.ts` (0.07.000).
 */

let context: CanvasRenderingContext2D | null | undefined;

/** The page's sans-serif stack as the shell token resolves it. */
export function fontFamily(): string {
  if (typeof document === 'undefined') return 'sans-serif';
  return getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
}

/** The width of one line of text at a font size, in CSS pixels; outside a browser, an estimate on the wide side. */
export function textWidth(text: string, px: number, weight = 400): number {
  if (context === undefined) {
    try {
      context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    } catch {
      context = null;
    }
  }
  if (!context) return text.length * px * 0.62;
  context.font = `${weight} ${px}px ${fontFamily()}`;
  return context.measureText(text).width;
}

/** The widest a set of labels needs, each on one line. */
export function widestLabel(labels: readonly string[], px: number, weight = 400): number {
  return Math.max(0, ...labels.map((label) => textWidth(label, px, weight)));
}

export interface FittedLabel {
  /** One or two lines; the last is shortened with an ellipsis only when the lines allowed are not enough. */
  lines: string[];
  /** Whether the label was shortened, so the drawing gives the whole label as its title. */
  shortened: boolean;
}

function shorten(line: string, width: number, px: number): string {
  if (textWidth(line, px) <= width) return line;
  let cut = line;
  while (cut.length > 1 && textWidth(`${cut}…`, px) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** A label in at most `maxLines` lines of `width` pixels: whole when it fits, broken at a word, shortened last. */
export function fitLabel(label: string, width: number, px: number, maxLines: 1 | 2 = 2): FittedLabel {
  if (textWidth(label, px) <= width) return { lines: [label], shortened: false };
  const words = label.split(' ');
  if (maxLines === 2 && words.length > 1) {
    let best: [string, string] | null = null;
    let bestWidth = Infinity;
    for (let k = 1; k < words.length; k += 1) {
      const first = words.slice(0, k).join(' ');
      const second = words.slice(k).join(' ');
      const widest = Math.max(textWidth(first, px), textWidth(second, px));
      if (widest < bestWidth) {
        bestWidth = widest;
        best = [first, second];
      }
    }
    if (best && bestWidth <= width) return { lines: best, shortened: false };
    if (best) return { lines: [shorten(best[0], width, px), shorten(best[1], width, px)], shortened: true };
  }
  return { lines: [shorten(label, width, px)], shortened: true };
}

/** The 1, 2, 2.5 or 5 times a power of ten at or above `x`. */
export function niceStep(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(x));
  return ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= x * (1 - 1e-12)) ?? 10) * magnitude;
}

/**
 * Round ticks covering [lo, hi], as many as leave room for labels about `labelSize` pixels along an axis of `room`
 * pixels (at least two, at most `most`). The first tick is at or below `lo` and the last at or above `hi`, so a bar
 * or a point never runs past the last labelled value.
 */
export function niceTicks(lo: number, hi: number, room: number, labelSize: number, most = 6): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0];
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) hi = lo === 0 ? 1 : lo + Math.abs(lo);
  const count = Math.max(2, Math.min(most, Math.floor(room / (labelSize + 16)) + 1));
  const step = niceStep((hi - lo) / (count - 1));
  const first = Math.floor(lo / step + 1e-9) * step;
  const ticks: number[] = [];
  for (let k = 0; first + k * step <= hi + step * 1e-9 || ticks.length < 2; k += 1) {
    ticks.push(Number((first + k * step).toPrecision(12)));
    if (ticks.length > 50) break;
  }
  if (ticks[ticks.length - 1] < hi - step * 1e-9) ticks.push(Number((ticks[ticks.length - 1] + step).toPrecision(12)));
  return ticks;
}
