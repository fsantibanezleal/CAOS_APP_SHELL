# 05 Drawings

Products drew their own charts: 29 of 89 frontends carried their own uPlot wrapper, and every bar chart was hand-drawn
SVG with fixed margins and a fixed width per character, the template's included (audit of 2026-10-07). Fixed margins
cut labels in the wider Linux fonts and in Spanish, which is how CAOS_Fragmenta's 0.05.000 deploy gate failed. The
shell now holds the charts and the text measurement every drawing needs.

## `UPlotChart` (`@fasl-work/caos-app-shell/chart`)

Line and point charts on uPlot: x and y titles with units; series by colour token (`ShellColorToken`); a key of every
series under the plot when there are two or more; a cursor readout row (uPlot's legend is clipped by a sized host);
rebuilt on a theme or language change; compared by value, so a parent re-render does not tear it down.

- **Ticks:** an axis with fixed `decimals` ticks only where its labels differ (no "1, 2, 2, 3"); every axis writes its
  labels in one notation, scientific for all when any non-zero tick is below 1e-4 (`formatTicks`, known shell
  defect 19). The host declares `data-ticks-repeat` and the gate fails any repeat (G6).
- **A log axis** (`y: { log: true }`, and `x: { log: true }` from 0.9.0) keeps uPlot's ticks (1 to 9 times every power of ten) while its values stay above
  1e-22 (`LOG_TABLE_FLOOR`); uPlot builds those ticks from a precision table that ends there, and an axis reaching
  below it threw "Invalid array length" and was never drawn (known shell defect 31: p-values of 1e-124). Below the
  floor the axis ticks at powers of ten, at most eight (`logDecades`), every one labelled. A product that draws
  p-values may still floor them for reading: 1e-124 and 1e-60 lead to the same decision.
- **A year axis** reads 2021 with `format: { decimals: 0, grouping: false }` (known shell defect 30).
- **The y axis** is sized to its longest label measured in the font uPlot draws with, at the device pixel ratio; it
  was too narrow on every high-density screen before 0.8.0 (the gate runs at ratio 1 and never saw it).
- **Marks** (`marks: [{ x, label }]`) are drawn by `drawMarks`: a dashed line and a label with an explicit left
  alignment (uPlot leaves the canvas right-aligned after its last axis, which put the template's "peak" label on the
  wrong side of its line), on the side of the line where it fits inside the plot, on the next row when it would
  overlap the label before it, with a halo in the surface colour. A mark outside the x range is not drawn.
- **Reference lines** (`yMarks: [{ y, label }]`, 0.10.0) are drawn by `drawYMarks`: a dotted line across the plot at
  a y value (a null model's constant prediction, a target, a limit), its label at the right end above the line (below
  it when the line runs along the top), inside the plot, haloed; a label that would overlap the one before it moves
  left of it. A line outside the y range is not drawn. The host declares `data-y-marks`.
- **A log x axis** (`x: { log: true }`, 0.9.0): the axis spans the data (uPlot alone rounds out to the next decade),
  labels the ticks it keeps and leaves the rest blank; marks keep apart on it as on any axis.
- **A parity plot** (`parity`, 0.9.0): predicted (the series, usually `mode: 'points'`) against observed (x) on one
  shared range, in a square box centred in its card, with the dashed identity line. x need not be sorted. The range
  takes in the reference lines (`yMarks`, 0.10.0), so a null model's level is always in view.
- **The readout** under the plot lists the values at the cursor; `readout(index)` replaces it with the caller's text
  for the point (a scatter names its case: the blast, its site, its error), and `hint` sets the text at rest
  (0.10.0).
- **Picking** (`onPick(index)`, 0.9.0): a click on the plot hands back the index of the point under the cursor (select
  a case, a blast); `onCursor` does the same while hovering. Indexes are always the caller's, also when the chart
  sorted an unsorted x. On a chart whose series are all `points` (a scatter, a parity plot), the point under the
  cursor is the one nearest the pointer in the plane (`nearestPoint`, 0.10.0): uPlot alone takes the nearest in x,
  which on a scatter names a point far above or below the pointer. The readout then names only the series that
  have that point.
- **A selected point** (0.10.0): a `points` series takes a `size` (the marker diameter in CSS pixels, 9 by default);
  the selected case goes in a series of its own, larger and in its own colour, so the key says which it is.
- **More than six series:** the rotation has six colours; from the seventh, a repeated colour is drawn dashed, in the
  plot and in the key, so no two series look the same (`seriesStyle`).

## `BarChart`

A categorical chart in SVG, without uPlot:

```tsx
<BarChart
  title={{ en: 'Attack rate by immunisation', es: 'Tasa de ataque por inmunización' }}
  axis={{ label: { en: 'Attack rate', es: 'Tasa de ataque' }, format: { percent: true, decimals: 1 } }}
  data={variants.map((v) => ({ id: v.id, label: v.label, value: v.attack, highlight: v.id === active }))}
  orientation="horizontal"                  // the default: every category label on its own line
  height="fill"                             // inside a filling PlotCard
  onSelect={setVariant}                     // optional: a bar is a button
/>
```

Margins come from the labels, measured in the page's font; a category label is broken over two lines at a word and
only then shortened, with the whole label as its title; ticks are round and share one notation; values are written in
the interface language; a missing value reads "not available" at the zero line, never a bar of zero. `tone` colours a
bar by meaning; `highlight` marks the bar the reader is on (the others turn faint).

## The text kit

For a drawing of a product's own (a map, a diagram, a custom plot):

| Function | Returns |
|---|---|
| `textWidth(text, px, weight?)` | the width of one line in CSS pixels, in the page's `--font-sans` |
| `widestLabel(labels, px)` | the widest of a set of one-line labels |
| `fitLabel(label, width, px, maxLines?)` | one or two lines that fit, broken at a word, shortened last; `shortened` says when to give the full label as a title |
| `niceTicks(lo, hi, room, labelSize, most?)` | round ticks covering `[lo, hi]`, as many as their labels leave room for |
| `niceStep(x)` | the 1, 2, 2.5 or 5 times a power of ten at or above `x` |

Measure in a `Stage` (its render prop passes the real width and height); size every margin and column from
`widestLabel`; never from a count of characters.

## The `data-chart` contract

An SVG drawing declares `data-chart` (`BarChart` does). The gate's G10 reads every label of every declared chart, every
SVG in the instrument and every figure in a document: each label must lie inside the drawing and inside the part of it
its containers show, and no two labels may overlap; it measures again with every page rendered in the wide fallback
font. A drawing that crosses labels on purpose declares `data-text-overlap="allowed"`. Canvas text (uPlot's ticks) is
not readable by the gate; that is why the chart sizes its own axes and marks.
