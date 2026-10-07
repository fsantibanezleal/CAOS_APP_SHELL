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
- **The y axis** is sized to its longest label measured in the font uPlot draws with, at the device pixel ratio; it
  was too narrow on every high-density screen before 0.8.0 (the gate runs at ratio 1 and never saw it).
- **Marks** (`marks: [{ x, label }]`) are drawn by `drawMarks`: a dashed line and a label with an explicit left
  alignment (uPlot leaves the canvas right-aligned after its last axis, which put the template's "peak" label on the
  wrong side of its line), on the side of the line where it fits inside the plot, on the next row when it would
  overlap the label before it, with a halo in the surface colour. A mark outside the x range is not drawn.

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
