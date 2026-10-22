import type { Lang } from '../lib/lang';

/**
 * The parts of Tier A that both shell charts draw the same way (shell 0.19.0): the visually hidden table of the plotted
 * values a screen reader reads (referenced by the plot through `aria-describedby`), the one-line summary, and the
 * reset-zoom control that is shown only while the chart is zoomed.
 */

export function ChartSummary({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className="caos-chart-summary sr-only">
      {text}
    </p>
  );
}

/** The plotted values as a table: a header row, then one row per point or bar. Every cell is already written in the page language. */
export function ChartDataTable({ id, caption, head, rows }: { id: string; caption: string; head: string[]; rows: string[][] }) {
  return (
    <div className="sr-only" data-chart-table-box="">
    <table id={id} className="caos-chart-table" data-chart-table="">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={i} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (c === 0 ? (
              <th key={c} scope="row">
                {cell}
              </th>
            ) : (
              <td key={c}>{cell}</td>
            )))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export const RESET_ZOOM: Record<Lang, string> = { en: 'Reset zoom', es: 'Restablecer zoom' };

/** The visible control that goes back to the full range; the caller shows it only while zoomed. */
export function ResetZoomButton({ lang, onReset }: { lang: Lang; onReset: () => void }) {
  return (
    <button type="button" className="caos-chart-reset" data-chart-reset="" onClick={onReset}>
      {RESET_ZOOM[lang]}
    </button>
  );
}

/** What the chart says (aloud and as a tooltip) about the interactions it carries, in the page language. */
export const CHART_ROLE: Record<Lang, string> = { en: 'interactive chart', es: 'gráfico interactivo' };

/** The hint at rest of a chart that can be zoomed: how to zoom and how to read it from the keyboard. */
export const ZOOM_HINT: Record<Lang, string> = {
  en: 'Drag to zoom, click then scroll to zoom, double-click to reset; arrow keys read the values',
  es: 'Arrastre para acercar, haga clic y desplace para acercar, doble clic para restablecer; las flechas leen los valores',
};
