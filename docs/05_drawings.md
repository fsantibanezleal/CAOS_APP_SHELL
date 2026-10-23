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
- **Mark labels that avoid each other** (0.19.0, SHC-094, SHC-095): the labels of `marks` and of `yMarks` share one set of placed boxes. An x label goes
  right of its line on the first row as before, and one row down for each label of either kind in the way, never below the plot; when no row clears it
  the label is cut with an ellipsis and its whole text stays in the plot's title, the readout and a table of marks (`aria-details`). A y label is placed
  against the same boxes (`placeYLabel`): at the right end of its line, above it (below it at the top) when nothing is in the way, else left of the
  label in the way, then on the other side of its line, then one row further; when no place clears it is cut with an ellipsis and kept whole in the
  same places, never drawn over another label. An x mark with an empty label (the later years of a run named once) draws its line only. The host
  declares `data-mark-overlaps` (0 when none overlap, which G20 reads), `data-mark-boxes` and `data-mark-cut`.
- **Reference lines** (`yMarks: [{ y, label }]`, 0.10.0) are drawn by `drawYMarks`: a dotted line across the plot at
  a y value (a null model's constant prediction, a target, a limit), its label at the right end above the line (below
  it when the line runs along the top), inside the plot, haloed; a label that would overlap one placed before it moves
  left of it, to the other side of its line or a row further, or is cut with an ellipsis (0.19.0). A line outside a given `y.range` is not drawn. The host declares `data-y-marks`. Since 0.11.0
  (CAOS_APP_SHELL#94) a line has a `tone`, which colours the line and its label (the line stays dotted): `warn` (the
  default, `--color-warn`, an amber threshold), `bad` (`--color-bad`, a red threshold), `good` (`--color-good`, a level
  to reach) and `neutral` (`--color-fg-subtle`, a level that is no alarm: a test's nominal size, "no bias"). On any
  chart, when `y.range` is not given, the y range takes in every line's level (`rangeWithLevels`: the data's extent
  widened to the levels, 5% of the span beyond an end a level pushed out, then uPlot's own padding), so a line is
  always drawn, as a constant series would have pulled the range to it; on a log axis only the levels above 0 count.
  A given `y.range` is kept as it is and a line outside it is skipped.
- **A log x axis** (`x: { log: true }`, 0.9.0): the axis spans the data (uPlot alone rounds out to the next decade),
  labels the ticks it keeps and leaves the rest blank; marks keep apart on it as on any axis.
- **Decade labels** (`x: { log: true }`, 0.17.0): the log x axis labels the powers of ten only, in the interface
  language's number format (1,000 in English, 1.000 in Spanish), and draws the ticks between them without a label
  (`decadeOnly`); an axis whose range holds no power of ten keeps uPlot's labels, so it is never left bare. The host
  declares the labels shown in `data-log-labels` (read by the shell's own test, not by the gate). An axis that spans
  the data from a value that is not round (12 to 800) has no decade among its ticks and keeps uPlot's labels. Below `LOG_TABLE_FLOOR` every decade is labelled as before.
- **Draggable reference lines** (`yMarks: [{ y, label, drag: { min, max, step? } }]` with `onYMarkChange(index, y)`,
  0.17.0): a line with `drag` carries a handle on it (a `role="slider"` band 14 px tall across the plot, vertical, with
  `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and a value text). The reader drags it with the pointer or moves it
  with the keyboard once it has focus: the arrows one step, Page Up and Page Down ten, Home and End the ends of
  `[min, max]`. A step is `drag.step`, or a hundredth of the range when not given; on a log y axis it is a factor (a
  hundredth of the range in decades) and a dragged value is not snapped. Every move calls `onYMarkChange` with the
  index of the line in `yMarks` and the new y, inside `[min, max]`; the caller sets that y (and the label, which can
  carry the value) in `yMarks`. The chart is redrawn, never rebuilt, while a line moves, so the handle keeps its
  focus. Without a `y.range` the axis takes in the whole `[min, max]`, so it does not move under the pointer; with a `y.range`
  the drag range is cut to it (`dragWithin`: a `[50, 150]` drag on a `[0, 100]` axis runs from 50 to 100, and the
  `aria-valuemin` and `aria-valuemax` say so), so the line never leaves the axis and its handle is always reachable. The
  host declares the count in `data-y-drag`.
- **Points on their own x** (`series: [{ ..., mode: 'points', x: [...] }]`, 0.17.0): a `points` series with `x` (a line series ignores `x`) is drawn over the
  plot at its own x values (measured sizes over a modelled curve that has other sizes). The axes take its extent in
  (the x range on a log axis too), and the host declares `data-overlay` (the series) and `data-overlay-drawn` (the
  points drawn inside the plot). Such a series is not part of the curves' data: it takes no part in the cursor, the
  pick or the readout, and the key under the plot lists it.
- **Named x ticks** (`x: { ticks: [{ value, label }] }`, 0.18.0): a categorical axis (the three protocols of a sensitivity
  chart, blast ids) ticks exactly at the given values, no other, and labels each with its text in the page language
  (`BiText`). The readout names an x that sits on a tick by its label ("Protocol deduplicated"), never by its number. A
  tick outside the range is not drawn, a list of one draws that one, and an empty list leaves uPlot its own ticks;
  on a log axis only the ticks above 0 inside the range are drawn (`tickSplits`, `tickLabelAt`). A value listed
  twice keeps its first label, and an x within 1e-9 of the x span of a tick is on it. The labels must be different, adjacent or
  not (A, B, A): two ticks with one name fail the gate (G6, which names the label; the host declares them in
  `data-ticks-repeated` and counts them in `data-ticks-repeat`). The host declares the labels shown in
  `data-x-tick-labels`. Ignored on a time axis.
- **An x range** (`x: { range: [lo, hi] }`, 0.18.0): the x scale spans at least that range, as `y.range` fixes the y scale.
  Widen it past the data by half a step so the label of an end tick is not cut by the plot edge. The data and the
  overlays still widen it further, and on a log axis a range that reaches 0 or below is ignored alone (`xScaleRange`). On a parity chart `x.range` is ignored: its
  shared range rules.
- **A key that solos a series** (`solo`, 0.18.0): each entry of the key is a `button` with `aria-pressed`, reached by Tab and
  pressed by click, Enter or Space. The solo is held by the series key, `ChartSeries.id` or else its English label, not by
  position: it stays on that series when the list changes, is released when that series leaves and is not given back when
  it returns. Pressing one dims every other series to alpha 0.12 and 1 px (`soloStyle`; dimmed, not
  hidden, so the reader keeps the context) and leaves the chosen one as drawn; pressing it again releases it, pressing
  another moves the solo. A press redraws the chart and never rebuilds it, so the cursor and a line the reader drags
  survive; the solo survives a theme or a language change. It dims a `points` series with an x of its own too, and a chart
  of one series shows the key and toggles it (nothing to dim). The host declares the soloed series in `data-solo` (its index
  in `series`). Off by default: the key is then as before, a list that is not interactive.
- **Dots on a line** (`series: [{ ..., dots: true }]`, 0.18.0): a line series draws a dot (5 px) at each value, and none at a
  `null`. Off by default; CAOS_Fragmenta draws them under 40 values (`dots={x.length < 40}`), a product that wants the
  same decides it the same way.
- **A reference line with no label** (`yMarks: [{ y }]`, 0.18.0): drawn as the others, with no label box and nothing
  reserved for one, so the labelled lines place themselves as without it (a zero line). A draggable line without a
  label names its handle "Reference line" ("Línea de referencia") to a screen reader, numbered ("Reference line 1",
  "Reference line 2") when several unlabelled lines can be dragged (`referenceLineName`, in the text module).
- **Markers apart on a log axis** (`marks`): a 60 cm target beside a 100 cm limit print their labels on two rows,
  as on any axis; see `drawMarks`.
- **A parity plot** (`parity`, 0.9.0): predicted (the series, usually `mode: 'points'`) against observed (x) on one
  shared range, in a square box centred in its card, with the dashed identity line. x need not be sorted. The range
  takes in the reference lines (`yMarks`, 0.10.0), so a null model's level is always in view; both axes tick at one
  step (one tick spacing for the two), and filling a box taller than it is wide the square is centred down as well as
  across. The host declares how many ticks each axis labels (`data-ticks-x`, `data-ticks-y`, on every chart).
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
- **Tier A, every chart (0.19.0).** The interactions the rubric asks of any analytical chart are on by default, with no change at a
  call site (SHC-063 to SHC-073):
  - *Zoom and pan.* The wheel zooms x around the pointer **while the chart holds the focus** (a click or a Tab gives it), and always
    with Ctrl or Meta (a trackpad pinch arrives as Ctrl and wheel); a chart that does not hold the focus leaves the wheel to the page,
    so a chart in a long document never traps the scroll, and a chart that cannot be zoomed never takes it. A mouse drag along x is
    uPlot's brush (under 5 px it is a click); Shift with the drag pans; two fingers pinch and pan, and one finger pans a zoomed chart
    (an unzoomed chart leaves the vertical scroll to the page: `touch-action: pan-y`). `zoomY` zooms both axes (a parity plot always
    does). On a log axis the zoom is made in decades. The zoom survives a theme, a language and a size change and a parent that hands
    in the same data as new arrays; new data starts from the full range.
  - *Reset.* While the chart is zoomed a visible **Reset zoom** control shows under the plot (none while it is not); a double-click and
    the keys `0` and Escape reset too. The host declares the range in view (`data-view-x`) and `data-zoomed`.
  - *Keyboard.* The plot is one tab stop with an accessible name (`title`, else "y by x"). Left and Right (Up and Down too) move the
    crosshair from point to point and the readout, a polite live region, follows; Home and End go to the first and last point; `+`
    and `-` zoom around the crosshair; Shift with the arrows pans; `0` and Escape reset (Escape is not taken when the chart is not
    zoomed); Enter chooses the point as a click does (`onPick`). The handle of a draggable line keeps its own keys.
  - *Screen reader.* The plot is described (`aria-describedby`) by a visually hidden table of every plotted value (x and each series,
    in their units and the page language, thinned to 1000 rows) and by a one-line summary: series, x range and the y extremes.
  - *Opting out.* `zoomOff` takes the reason, in both languages when the page is bilingual (at least 12 letters and digits): the
    wheel, the brush, the pinch and the zoom keys go, the crosshair, the table and the summary stay, and the gate lists the chart
    among its waivers (a short reason fails G20). Nothing else of Tier A can be turned off.
- **Axis titles never cut (0.19.0, SHC-081).** A rotated y title longer than the plot is high moves above the plot as a horizontal
  line (`data-axis-title-moved="y"`), with its unit; an x title wider than the chart moves below it and wraps. Estimated before the
  chart is built and checked on the built chart, which can only move a title out.
- **Integer ticks (defect 21, 0.19.0).** `niceStepAt` and `niceTicks` take a resolution, so a step is a multiple of the least difference
  the labels can show; `tickSteps` already did this for `UPlotChart`.

## The filling card's stage floor

A `PlotCard fill` fills the height its column gives it; its note keeps at most 35% of the card (0.11.0, #95). At
1280 px and wider the card's body, the drawing the gate measures, keeps at least the gate's stage floor
(`--caos-stage-floor`, 140 px) itself (0.11.2): when the header or the note wraps (a narrow column, a Spanish title,
two badges, the wide fallback font) the card grows instead of squeezing its drawing, and the containing panel scrolls
when the cards do not fit (ADR-0071); the rail never does. Below 1280 px the document scrolls and nothing changes.

0.11.1 tried a card height derived from a fixed chrome (a two-line header); a header that wrapped to a third line left
the stage under the floor (CAOS_Contraste 0.07.000: 138 px; a 400 px column with a note: 106 px), which is why the floor
now sits on the stage. A product never restyles `.caos-plot.fill` to meet the floor (the template's web baseline
refuses it, ADR-0078). Measured by `e2e/fill-floor.test.ts` (two and three stacked cards, with and without a note, in a
640 px and a 400 px column, 1280 x 800 and 1600 x 900, English and Spanish, wide font) and walked by the gate fixture's
`Fit` tab, which stacks two filling cards in one column.

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

**Tier A (0.19.0, SHC-074 to SHC-079).** The bar chart carries the same interactions, by category:

- *Crosshair and readout.* The pointer over a bar, or the keyboard standing on it, draws a band on it and reads its label, value, unit
  and hint in a polite live region under the chart (`data-cursor` on the bar). The arrows (Left, Right, Up, Down), Home and End step bar
  by bar; Enter chooses the bar (`onSelect`). A bar that takes a choice is also a button of its own, reached by Tab after the chart.
- *Zoom and pan by category.* The wheel while the chart holds the focus (Ctrl or Meta always), a brush along the bars, Shift with a
  drag, a pinch, and the keys `+` and `-` show a window of whole bars (at least two; the host declares it in `data-window`); the chart
  keeps its height, so the page does not move, and the value axis keeps its domain from zero. Shift with the arrows pans, a
  double-click, the **Reset zoom** control and the keys `0` and Escape return to every bar. `zoomOff` turns it off with a reason, as
  on `UPlotChart`.
- *Screen reader.* One tab stop named by `title`, described by a visually hidden table (category, value, note) and a one-line summary.
- *Counts.* A value axis of counts (whole values with no `decimals` asked for, or `decimals: 0`) ticks at whole numbers only, and one
  with fixed decimals at multiples of their unit, so "0, 1, 1, 2, 2" cannot happen; the host declares the labels that repeat
  (`data-ticks-repeat`, which an axis of significant digits can still produce) and the gate fails them under G6.
- *Long titles.* The axis title wraps over as many lines as it needs, never cut.

**Floating bars, grouped bars and a legend (0.19.0, SHC-090 to SHC-093).** The two forms the products drew by hand:

```tsx
// a bridge from one total to another through signed steps: `span` is the bar's two ends, `value` the number it states
<BarChart
  title={{ en: 'Capital bridge', es: 'Puente de capital' }}
  axis={{ label: { en: 'Capital', es: 'Capital' }, unit: 'USD m', range: [100, 140] }}   // with a span the range is the axis as given
  data={[
    { id: 'open', label: 'Opening', value: 120, span: [120, 120], tone: 'accent' },       // a span of zero length is a dot
    { id: 'in', label: 'Inflows', value: 15, span: [120, 135], tone: 'good' },
    { id: 'out', label: 'Outflows', value: -22, span: [135, 113], tone: 'bad' },         // ends in any order: the same bar
  ]}
/>

// provision by segment under three regimes: consecutive data with one group.id share a band
<BarChart
  title={...} axis={...} orientation="vertical"
  data={segments.flatMap((g) => regimes.map((r) => ({ id: `${g.id}-${r.id}`, label: r.label, group: g, value: v(g, r), tone: r.tone })))}
  legend={regimes.map((r) => ({ tone: r.tone, label: r.label }))}
/>
```

| Prop | Meaning |
|---|---|
| `BarDatum.span?: [a, b]` | the bar's two ends on the value axis, in any order; without it the bar spans zero to `value`. `value` stays what the bar states: it is written at the bar (`values`), read in the readout and the table, which add the ends ("from a to b"; the table gains From and To). A span of zero length is a dot as thick as a bar; when a chart has a dot the value axis is inset by its radius at both ends, so a total at an end of `axis.range` is drawn whole with its value label, clear of the category labels. The axis covers every span; `axis.range` is then the axis as given (it may exclude zero), a span outside it is cut to it and one wholly outside draws nothing. A plain bar (no `span`) beside floating ones is cut to the same axis (it is never drawn from zero over the category labels) and reads its ends too, zero and its value, as the table writes them. A span with a missing end, or a missing `value`, draws nothing and reads "not available". The summary of a floating chart states its first and its last ends (a bridge's opening and closing totals, a waterfall's start and its total: "Capital (USD m): from 120 USD m at Opening to 119 USD m at Closing"), not its lowest and highest value. Host: `data-spans`. |
| `BarDatum.group?: { id, label }` | consecutive data with the same `group.id` share one category band, side by side (vertical) or one under another (horizontal); the category axis prints the group label once and `label` names the member (read as "Retail, Stress: 18"). The table gains a Group column; the keyboard walks group by group, member by member; zoom, pan and brush are over whole groups (`data-window`, `data-groups`). Groups may differ in size: bars keep one width and a smaller group is centred. Each member is named on the drawing when its slot has room for a short label: the member label, else its first letters (`text[data-member]`), in a column between the group labels and the plot when horizontal and on a row under the bars when vertical, so the members are never told apart by colour alone; the legend keeps the tone. |
| `BarDatum.format?: FormatOptions` | the number format of this bar, over `axis.format`: its value label, its readout, its ends and its table cells (a layer stated to three decimals in a stack written to two). The axis ticks keep `axis.format`. |
| `BarChartProps.legend?: { tone, label }[]` | what each tone means, as a list under the bars (`data-legend`); a tone no bar uses is drawn anyway and warned about in development. |

A highlighted bar (`highlight`) that carries a `tone` keeps its fill and is drawn with an outline, so it stands out from neighbours of the same
tone (without a tone it is drawn in the accent and the others turn faint, as before). A floating or grouped bar that takes a choice (`onSelect`)
is a pointer target over its whole slot (`rect[data-bar-hit]`, transparent): the middle of its box, which can be the empty space beside a
floating bar or under a short bar's raised value, reaches the bar (G5).

A `BarChart` without the new props renders the same markup as before, a highlighted bar with a tone excepted (its outline).

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

## Animated figures (0.14.0)

A documentation figure or an executive illustration may be an animated SVG (CSS keyframes or SMIL inside the file) where it explains
a change, a flow or a sequence. The same rules bind it as the executive illustrations (`docs/06_executive-view.md`): a gentle loop or
a single play of at most ten seconds, theme tokens, labels that do not move, and a `@media (prefers-reduced-motion: reduce)` block
in the file that shows the static final frame. The gate (G17) checks every `figure svg` of the page and fetches and analyses every `figure img` of an SVG file. Use CSS keyframes in a documentation figure: the shell pauses SMIL only in the executive view's illustrations, so a SMIL animation in a figure would keep moving under reduced motion and fail G17.

## The `data-chart` contract

An SVG drawing declares `data-chart` (`BarChart` does). The gate's G10 reads every label of every declared chart, every
SVG in the instrument and every figure in a document: each label must lie inside the drawing and inside the part of it
its containers show, and no two labels may overlap; it measures again with every page rendered in the wide fallback
font. A drawing that crosses labels on purpose declares `data-text-overlap="allowed"`. Canvas text (uPlot's ticks) is
not readable by the gate; that is why the chart sizes its own axes and marks.
