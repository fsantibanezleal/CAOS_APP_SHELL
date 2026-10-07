## [0.09.000] - 2026-10-07

### Added

What CAOS_Fragmenta still carried after 0.8.1 (CAOS_APP_SHELL#65; CAOS_MANAGE `plans/app-shell` BL-027, BL-028): with
these a product draws its size distributions, its parity plots and a weighted views row on the shell.

- `ViewsRow`: views side by side, each in a column the shell owns (a filling card keeps its height chain), the row
  split by `shares` (`[3, 2]`); stacked below 900 px. A product removes its own column wrapper (Fragmenta's
  `.fr-viewcol`).
- `UPlotChart`: `x.log`, a log x axis that spans the data (uPlot rounds out to the next decade) and leaves the ticks it
  does not label blank; `parity`, predicted against observed on one shared range in a square box with the identity
  line, x unsorted allowed; `onPick(index)`, the point under the cursor on a click. Every index handed back is the
  caller's, also when the chart sorted an unsorted x (`sortOrder`).
- From the seventh series a repeated colour is dashed, in the plot and in the key (`seriesStyle`).
- `/chart` exports `seriesStyle`, `sortOrder` and `parityRange`.
- The gate fixture's Validation has a "Fit" sub-tab: a `ViewsRow` of three fifths and two fifths holding a parity plot
  over an unsorted x (picking on) and a log-x curve; the clean run (G15) measures both.

### Fixed

- G11 let a number in scientific notation through: "2.7e-08" on a Spanish page writes its decimal with a point, and the
  exponent hid it from the pattern (found on CAOS_Fragmenta's Implementation page). The exponent is now part of the
  number; the `decimal-point` plant carries one.
- The gate's header-route step (every route reached by a pointer click) let a locator wait its default 30 s and
  throw, which ended the whole run (the 0.9.0 self-test, under load); a link that does not answer in time is now a G5
  failure of its route.

## [0.08.002] - 2026-10-07

### Fixed

- Known shell defect 30 (#62): `formatNumber` grouped every number, so a calendar year on an axis, in a readout or in a
  table read 2,021 (2.021 in Spanish), for every option the type allowed; `time: true` was no way out, since the
  chart's cursor readout still formatted the epoch seconds. `FormatOptions.grouping: false` drops the group separator
  on every path (fixed decimals, significant digits, the integer path), and `formatTicks` and `UPlotChart` pass the
  axis format through, so `x: { format: { decimals: 0, grouping: false } }` writes 2021 on the ticks and in the
  readout, in both languages. The default still groups. Found by CAOS_Contraste's case C04 (rating cohorts 2000 to
  2025). On adoption: a product that counted its years from a base year, or wrote them as text to avoid the
  separator, gives its year axis `grouping: false`.

## [0.08.001] - 2026-10-07

### Fixed

Found by the 0.8.0 gate on the product template's example, the first product on 0.8.0:

- `BarChart` filling its card capped its rows at 2.2 times their height, so three horizontal bars took a quarter of a
  tall card and failed the gate's stage-fill floor (G6, 13 to 29 percent against 30). The rows now share the card's
  height; a bar keeps a readable thickness (half its row, at most 40px) with its label centred on it.
- G10 judged a label against the viewport and a header stuck at its top, so on a phone a chart's first row, scrolled
  under the sticky header by the probe, read as "cut by 4px at the drawing's edge". A label is now judged against its
  drawing and the containers that cut their content (overflow hidden or clip) only; a scroll container and the
  viewport do not cut.
- G6 reported a table wider than a phone, scrolling inside its card as ADR-0071 rule 3 asks, as "extends past the
  page". A surface inside a box that scrolls sideways ends where that box ends; one cut by a box that hides its
  overflow still fails.

The gate fixture's comparison is a horizontal `BarChart` filling its card, and its "Every day" table is wider than a
phone; the clean run (G15) passes both only with these fixes.

## [0.08.000] - 2026-10-07

The base defines the structure every product builds on (#59; CAOS_MANAGE `plans/app-shell`, research in
`wip/template-archetype/base-unify-audit-2026-10-07.md`). A survey of the 89 React frontends of the line found 44 on the
shell, 43 of them restyling its classes, 15 to 19 writing the same containment for a tab App, 16 to 24 holding their
tab rows by hand, and 29 carrying their own uPlot wrapper; this release moves those into the shell. Documentation:
`docs/` (structure, tokens, navigation, views, drawings, icons and numbers, the gate, releasing).

### Added

- `SurfacePage`, the third route type beside the workbench and the document: a head (title, lede, actions), one row of
  at most six views, the open view filling the viewport under `contain` and scrolling inside it.
- The open view in the URL: `CaseWorkbench` holds its open group and `SurfacePage` its open view in `?view=`
  (`deepLinkView`); `useUrlView` for a tab row of a product's own.
- Tokens for type (`--text-*`), space (`--space-*`), radii (`--radius-*`), layout (`--measure`, `--measure-text`,
  `--header-h`, `--rail-w`, `--fade`), icons (`--icon-*`) and z-order (`--z-*`), all in `SHELL_TOKENS`; one breakpoint
  set, 480, 760 and 900 px (and the gate's 1280), exported as `BREAKPOINTS`.
- `BarChart`, a categorical chart without uPlot: margins measured from the labels, labels broken at a word and then
  shortened with their title, round ticks in one notation, values in the interface language, `highlight`, `tone`,
  `onSelect`.
- The text kit for a product's own drawings: `textWidth`, `widestLabel`, `fitLabel`, `niceTicks`, `niceStep`,
  `fontFamily` (from CAOS_Fragmenta 0.07.000).
- `formatTicks` (one notation per axis), `NBSP`, `SCIENTIFIC_BELOW`, the `notation` option of `formatNumber`, the
  type `ShellColorToken`; `/chart` exports `drawMarks`, `tickSteps` and `repeatedLabels`.
- A skip link to `main#main`, the first keyboard stop of every page.
- Icons sized by their context: lucide's `svg.lucide` in the header, tabs, sub-tabs, chips, buttons, route links,
  badges, callout titles, plot heads and the console sidebar; a product passes no size.
- Gate: G10 text in drawings (labels cut, outside the drawing or overlapping, in every declared chart, instrument SVG
  and document figure), with a wide-font pass (Verdana, else DejaVu Sans) at 390 and 1280 px; G11 a decimal point on a
  Spanish page; G12 a vertical sub-tab list that scrolls away; G13 text under WCAG AA contrast; G14 `index.html`
  beside the report, every capture by route with the failures first; options `--wide-font-sizes` and
  `--no-wide-font`. The self-test (G15) plants a defect for each: 34 plants.

### Changed

- `styles.css` is written in ordered layers (tokens, base, frame, routes, navigation, content, controls, case
  selector, workbench, frames), each class defined in one place (`.tablist` and `.subtablist` were defined twice, the
  second overriding the first); class names are unchanged.
- Every tab row (`.tablist`, `.subtablist`, the rail's section row) holds its height in any flex column, not only in
  the workbench: a product removes its own `.tablist { flex: 0 0 auto }` and `.tab { flex: 0 0 auto }`.
- Text blocks inside a document (paragraphs, list items, callouts, captions) keep a 78ch line (`--measure-text`);
  figures, tables and grids keep the width. A product removes its own `max-width: 78ch` on callouts and captions.
- The faint text colour, and in the light theme `accent-2` and `warn`, were raised to WCAG AA on every surface: the
  faint text read 3.49:1 on the dark raised surface and 4.08:1 on the light one (dark `--color-fg-faint` `#828b97`,
  light `#656d77`; light `--color-accent-2` `#0a7886`, `--color-warn` `#946300`). A unit test computes every pair.
- `reserved-classes.json` lists `components` (never restyled) and `modifiers` (`on`, `active`, `fill`, `wide`, ...,
  which a product may join to its own class); `classes` keeps both for 0.7 readers. The words read from the
  `@import` lines (`css`) are gone. The gauge legend dot is `.caos-gauge-dot`.
- The rail's section row fades its hidden end, reveals the open section and takes the arrow keys, Home and End.

### Fixed

- Known shell defect 26: `html, body { overflow-x: hidden }` computed body's vertical overflow to auto, so body was a
  scroll container that never scrolls and nothing in a scrolling document could stick to the viewport: the site header
  scrolled away on every default-mode page and on a phone. `overflow-x: clip` (with `hidden` as the fallback). Below
  900 px a contained document's page is released in both forms of its rule (the `:has()` form had kept it a scroll
  container).
- Known shell defect 24 (#55): the vertical sub-tab list is sticky; it stays in view at the end of a long section.
- Known shell defect 23 (#54): a filling `PlotCard` in a `.caos-views-row` takes an equal share; a product removes its
  wrapper column (CAOS_Fragmenta `.fr-viewcol`).
- Known shell defect 22: a percent is joined to its sign, and a unit to its value (`Knob`, `Readout`, `Gauge`, the
  chart readout), by a no-break space.
- Known shell defect 19: an axis writes all its ticks in one notation.
- Known shell defect 20 (the gate): a control whose inputs are all disabled is not moved by the reactivity check.
- `UPlotChart` marks: drawn with an explicit left alignment (uPlot left the canvas right-aligned after its y axis, so
  the template's "peak" label sat on the wrong side of its line and ran off the plot near the left edge), on the side
  of the line where they fit inside the plot, on separate rows when they would overlap, with a halo; a mark outside
  the x range is not drawn.
- `UPlotChart` y axis: measured in the font uPlot draws with at the device pixel ratio; it was too narrow on every
  high-density screen (the gate runs at ratio 1).
- The gate's truncation check normalised the letter `s` instead of whitespace (`/s+/g`); its pointer probe takes a 1x1
  hidden control (the skip link) for what it is, and scrolls a control clear of a header stuck at the top of the
  viewport; the tab walk does the same before it clicks.
- `CaseSelector` keeps the router's history state when it writes `?case=` (it replaced it with `null`).

### Adoption (ADR-0078 section 5)

Pin `0.8.0` exactly. Remove: containment CSS for a tab App (use `SurfacePage`), tab-row flex and wrap overrides, chip
styling, `max-width: 78ch` on callouts and captions, product wrappers for a views row, label-fitting code that the
text kit replaces, hand-drawn bar charts (use `BarChart`), icon `size` props. Run the gate: G10 to G13 may report what
the product carried unseen.

## [0.07.003] - 2026-10-06

### Fixed

- Known shell defect 25: the gate's pointer probe (G5) scrolled an element that fits its scroll container until its
  end showed plus an 8px margin, so an element with less slack than the margin had its start pushed out of the
  container and was reported as never brought into view, by the probe that had moved it (CAOS_Contraste's
  Methodology "Stability" sub-panel: 706.7px in a 712.2px page box at 1280x800, four false failures). The probe now
  scrolls by the smaller of the end's overflow plus the margin and the start's distance from the container's start,
  on both axes (#56). The gate fixture's Methodology gains a "Margins" tab, a focusable region a few pixels shorter
  than the page box below the fold, which the clean run (G15) passes only with the fix.

## [0.07.002] - 2026-10-05

### Fixed

- Known shell defect 21: an axis of integer values (variant numbers, grades, years) formatted with `decimals: 0` got
  uPlot's default tick steps, which include 0.5, 0.25 and 2.5, and the formatter rounded them: CAOS_Contraste's AUC
  chart of seven variants read 1, 2, 2, 3, 3, ..., 7, 7, so every point shared its label with the tick beside it, and
  a grade axis of three points read 1, 1, 1, 2, 2, 2, 2, 3, 3, 3. An axis whose format fixes its decimals now ticks
  only at multiples of the smallest difference its labels can show (scaled by 100 for a percent); a time or log axis
  keeps uPlot's own steps. `test/base07.test.tsx`.
- The gate could not see a repeated tick (the labels are drawn on a canvas). The chart host now declares
  `data-ticks-repeat`, the ticks whose label repeats the one before, and the gate fails a chart that declares any
  (G6), so an axis formatted by significant digits that still repeats is caught; the self-test plants one
  (`repeat-ticks`, G15).

## [0.07.001] - 2026-10-05

### Fixed

Five base defects, four of them found by the first measured gate run of a product built on 0.7.0 (CAOS_Contraste,
583 failures in 655 states); each has a test that fails without its fix.

- Known shell defect 14: the footer wrote a separator before the build group, whose auto margin moves it to the
  right edge, so a "·" dangled at the end of the left group on every wide screen (found on Fragmenta). The
  separator is gone; the margin separates the two groups. `test/appShellFixed.test.tsx`.
- Known shell defect 15: `formatNumber` wrote any magnitude in fixed notation, so a p-value of 1e-200 rendered as
  two hundred zeros and one table cell measured 12,790 px. A non-zero magnitude below 1e-4 is now written in
  scientific notation with the requested significant digits (`6.53E-13`, `7,05E-5` in Spanish); a fixed number of
  `decimals` stays the caller's explicit choice. `test/base07.test.tsx` (S8).
- Known shell defect 16: in the workbench the group row and the sub-tab row are scroll containers, so their automatic
  minimum height is zero, and under a panel taller than the instrument they shrank: the rows were clipped and the
  panel covered the sub-tabs. Both rows keep their height (`flex: none`) and the panel scrolls, and the gate fails a
  tab row that cuts its tabs (G5). `test/base07.test.tsx`; the gate fixture's "Every day" sub-tab and the
  `shrunk-tabs` plant (G15).
- Known shell defect 17: a chart of several series named them only in the cursor readout, so at rest a reader could
  not tell one line from another. `UPlotChart` now keys every series under the plot when there are two or more: its
  colour, a dashed swatch for a dashed series, a dot for points, and its label; the key wraps.
  `test/base07.test.tsx`.
- Known shell defect 18 (the gate): the pointer probe judged whether an element fits against the window instead of
  the scroll container it lives in, and aligned a tall element by its end, so a documentation tab panel taller than
  the page's scroll box was reported as "cannot be brought into the viewport" or "covered by" the header. The probe
  now brings a large element in by its start and points at the centre of the part that shows, inside every ancestor
  that clips. The gate fixture's "Notes" tab (taller than the scroll box, shorter than the window) passes clean.

## [0.07.000] - 2026-10-04

### Added

- The workbench primitives, so a product composes its App route instead of re-deriving it (ADR-0016 s9,
  ADR-0017 and ADR-0071 as amended 2026-10-04):
  - `WorkbenchLayout`: a sized control rail beside the instrument on the full viewport (`.page-body.wide`),
    `min-width: 0` down the tree, the instrument marked `data-instrument`; a rail given as sections shows one
    section at a time instead of scrolling (ADR-0071 rule 6).
  - `CaseWorkbench`: the variant bar, then ONE row of at most six question groups in a fixed order (the
    instrument groups, the variant comparison, the context write-up); more than six throws. The live lane is a
    property of each view, shown by its badge.
  - `VariantBar` (one scrollable row of regimes, the active regime's note and lane) and `LaneBadge` (live,
    replay, offline only).
  - `Readout`, `Gauge`, `Verdict` and `PlotCard`, with shared tones.
  - `DocPage` and `DocSection`: the documentation route skeleton; a section ends in its own `Refs`, and a
    section that cites nothing must state why (`noRefsReason`).
  - `pick` and `BiText` for bilingual strings.
- `ShellConfig.contain`: every route is the viewport; the workbench fills it and a documentation route scrolls
  inside the main container, so the document never scrolls (ADR-0071 rule 1).
- The design-system CSS for chips (`.chip`, `.chip.on`), the one-row chip strip, the workbench grid, the
  variant bar, lane badges, readouts, gauges, verdicts and plot cards. Products no longer copy it.
- `caos-shell-gate` (bin): measures a running build at three sizes, both themes and both languages (viewport
  fit, one-row tab bars, a rail without scroll, the instrument at least half of a workbench route, centred prose,
  no bibliography dump, captioned equations, sections with references, the theme applied, no console error) and
  reaches every header route by a real pointer click. `playwright` is an optional peer dependency.

- ADR rules enforced at runtime (ADR-0078, "rules live in the base"): an `Equation` without a caption, a citation
  without a DOI or URL, a duplicate citation id, a `Cite` of an unknown id, a `ReferenceList` (banned by
  ADR-0017 s4, now deprecated) and an architecture modal with fewer than five tabs are each reported with
  `console.error`; `caos-shell-gate` fails a page on any console error.
- `STANDARD_ROUTES`: the six product routes with EN/ES labels, one definition for header, router and gate.
- `THEME_BOOT_SCRIPT`: the inline pre-paint script that applies the stored theme and language before the first
  frame; `AppShell` keeps `<html lang>` in step with the language toggle (ADR-0011).
- The base requirements of the 2026-10-04 failure history (S1 to S13, S17, S18), each with a test in
  `test/base07.test.tsx`:
  - S3 `PanelBoundary`: a failing view is contained, named (`data-panel-error`) and reported; every tab panel,
    every `PlotCard` and the shell root sit inside one.
  - S4 `Tabs` and `SubTabs` are controllable (`value`, `onChange`), render only the open panel inside a boundary,
    carry `data-tab` and `data-panel`, report more than six peers, and fade their overflowing edge;
    `TabGroups` puts views under question groups when one row cannot hold them.
  - S7 to S10 the workbench state: `Provenance` (`real`, `synthetic`, `published`) beside the lane on every
    `Readout`, `PlotCard` and workbench group; `makeStateKey` and `useWorkbenchState`, so a view showing data
    for an earlier selection is overlaid as stale; `CaseWorkbench` writes `data-case`, `data-variant`,
    `data-source`, `data-state-key` and `data-replay-only` for the gate.
  - S8 `formatNumber` and `useFormat`: numbers follow the interface language (es-CL decimal comma), and an
    absent or non-finite value reads "not available" instead of `NaN`.
  - S10 `Knob` and `ChipGroup`: the instrument's controls, registered with `data-control` so the gate can check
    that each one changes the state key.
  - S11 `SHELL_TOKENS`, `resolveToken` and `useThemeTokens`: the colour tokens the shell defines, resolved to
    concrete values for canvas and WebGL; `validateArchitectureConfig` checks the modal on mount (at least five
    tabs, inline SVG strings only, only defined tokens, no hex colours, both languages).
  - S12 `UPlotChart` from the separate entry `@fasl-work/caos-app-shell/chart` (with `chart.css`): sized by its
    container, colours resolved from the theme and rebuilt on theme or language change, options compared by
    value, null-safe localised ticks, a y axis sized to its widest label, a cursor readout row instead of the
    clipped legend, and labelled marks. `uplot` is an optional peer dependency.
  - S13 `Stage` and `useStageSize`: an instrument draws only once its box has a size, declares
    `data-drawn`, `data-width` and `data-height`, and reports a stage still at zero size after 1.5 s.
  - S17 `reserved-classes.json`: every class the stylesheet styles, generated at build, for the product guard
    that forbids redefining them.
  - S18 `AppShell` reports a missing router context and names the duplicated-React cause.
  - `@fasl-work/caos-app-shell/keys`: the storage keys (`caos.theme`, `caos.lang`) for the gate and the boot
    script.

- The instrument's height chain (failure class 4): `PlotCard fill` takes the height its panel leaves, `.caos-views-row`
  sets filling views side by side, sub-tabs inside a panel pass the height down, and `UPlotChart height="fill"`
  takes its container's height; below 900 px a filling view gets a fixed readable height. Before this, a `Stage`
  inside a `PlotCard` resolved to zero height and never drew.
- `.caos-table`: tables in views and documents (tabular figures, a header that stays in view).
- `UPlotChart` series `mode: 'points'` (a scatter of cases over a curve); `.caos-pending` for a view whose data is not
  there yet (it declares `data-state="loading"`); the `BiText` type is exported.
- `caos-shell-gate` rebuilt as `gate/` (G1 to G9 of the 2026-10-04 history): subject and mode identity with the
  exported storage keys; console, page and HTTP errors; deep links with and without a trailing slash, artifacts
  answered as JSON and a missing asset answered 404, through a built-in server that answers as GitHub Pages does
  (`--serve dist`); boxes inside the viewport and the rail, containers that cut or scroll sideways, truncated text
  without its full text, every control reached by the pointer the way a reader can scroll to it; painted pixels per
  drawing stage and the drawn views covering half the viewport, measured on the screenshot; every route, tab,
  sub-tab and case at 390x844, 768x1024, 1280x800, 1600x900 and 2560x1440, both themes and both languages, waiting
  for declared state; animation frames and mutations at rest; every registered control changing the selection key,
  and the rendered case being the case asked for, by selection and by deep link.
- G15: the gate's self-test (`npm run test:gate`, a CI job): a fixture product built on this shell passes the full
  matrix clean, and each of 26 planted defects fails the check that owns it.

### Changed

- `CaseWorkbench` is the whole App route: it renders the layout, puts the case picker (`cases`), the variants and
  the product's `rail` in the rail, and provides the selection key to the rail and the instrument. The per-group
  badge row is gone (each view shows its own lane and provenance); `WorkbenchLayout` takes a `railHead`. The
  workbench spacing is tightened (rail `clamp(248px, 19vw, 340px)`, compact group and sub-tab rows), so the drawn
  views cover half of a 1280x800 viewport.
- The variant row is a registered control (`data-control="variant"`).
- `ShellConfig.license` and `ShellConfig.visibility` are required (S5): the footer shows the product's own
  licence with no default, and a private product shows no source link. `ShellConfig.build` adds the build id to
  the footer beside the version, which must be `X.XX.XXX` (S6); both are written as `data-version` and
  `data-build`.
- `Readout` items take a numeric `value` (or `null`) with a unit or `unitless: true` and are formatted by the
  shell; `lane` and `provenance` are required on `Readout` and `PlotCard`.
- `CaseSelector` shows each case by name only (the id is written as `data-case`).
- The architecture modal takes inline SVG strings only; the URL fetch and cache are removed.

### Fixed

- The document could not scroll on a page taller than the viewport (`html, body, #root { height: 100% }`); it is
  now `height: auto; min-height: 100%` (S1).
- `[hidden]` lost to component `display` rules and showed hidden panels; it now always hides (S2). Each theme
  declares `color-scheme`, so native scrollbars and form controls follow it.
- The header navigation pushed the actions off a narrow screen; it shrinks and scrolls at every width.
  Native selects and inputs follow the theme, and sub-tab rows stay on one row.
- A partly hidden item focused by keyboard in a scrolling row (nav, tab rows, phone footer) is scrolled fully into
  view; the routed nav re-centres its active link on every route change. The contained phone footer stays one row
  with a faded end instead of wrapping into three lines over the instrument.
- Badges never wrap mid-label; stacked views in a panel keep a gap.
- A scrolling row reveals the reader's focused item even when a route change re-runs its effect afterwards (the
  late effect had scrolled a focused link back out of view; the navigation e2e caught it as a flaky failure), and
  the reveal is instant.
- Units are bilingual where they are words (`unit: { en: 'people', es: 'personas' }`) in `Readout`, `Gauge`, `Knob` and the
  chart axes; a Spanish reader no longer meets an English unit. `formatNumber` shows every integer digit of a count
  (27,345, not 27,350); significant digits round only the fraction. `Verdict compact` puts the title and the verdict
  on one row, for a verdict above a drawing.
- Found by the gate on the product template: `CaseSelector` resolves a `?case=` deep link once an asynchronous case
  list arrives (it adopted on mount only, and wrote the default case into the URL first), and its modified badge
  names the case instead of its id and wraps in the rail; the architecture validation no longer reads a marker
  reference (`url(#dc5-arrow)`) as a hex colour; the gate's reach check tests a fragment of a wrapped inline link,
  not the empty centre of its box. The fixture now loads its cases asynchronously and carries a wrapped link.

- `ChromeStrings` typed each value as `string`; with `as const` the English literals made the Spanish table
  unassignable and `tsc` 5.9 failed, which also failed the build that `npm ci` runs.

## [0.06.013] - 2026-09-26

### Added

- `publish-npm.yml`: trusted publishing to npm from a GitHub release (OIDC, provenance attached, no token stored).
  npm no longer issues 2FA-bypass tokens, which is why 0.6.9 to 0.6.12 never reached the registry; this release
  is the first published since 0.6.8 and carries everything those four entries describe.

## [0.06.012] - 2026-09-25

### Added

- Continuous integration, for the first time in this package: build, the node test suite, and the
  guards every product repo already carries (no tracked `.env` or `dist/`, no leaked local path,
  no em-dash or emoji per ADR-0067, the ADR-0074 CI budget gate, and version coherence per
  ADR-0068). Trunk-only triggers, a concurrency group, a timeout per job.

### Fixed

- `VERSION` had stayed at `0.06.008` through three tagged releases while `package.json` moved to
  `0.6.11`, and `0.06.010` and `0.06.011` had no changelog entry. All four sources now agree, and the
  two entries below are transcribed from the commits they tag.
- Twenty-two em-dashes in comments, docstrings, the README, this changelog and one UI string
  (`CaseSelector.lockedNote`), replaced per ADR-0067.

## [0.06.011] - 2026-09-24

### Fixed

- On a phone viewport the focus HUD no longer overflows: below 860px it is a four-column grid with
  ellipsised labels and compact value text instead of a horizontally scrolling flex row.

## [0.06.010] - 2026-09-24

### Added

- `FocusShell`, the shell-owned full-viewport scenario focus frame (ADR-0070): the product supplies
  its instrument (`stage`), its controls (`rail`), a title, a description and HUD readouts; the shell
  owns the layout, the language and theme toggles, the exit action, and the phone breakpoint that
  stacks stage over rail. Exported from the package barrel with its props type and a contract test.

## [0.06.009] - 2026-09-24

### Fixed

- Keep route navigation in the same compact header row on narrow screens, with keyboard-accessible horizontal route scrolling and no document overflow.
- Keep complete mobile footer provenance accessible in one horizontally scrollable row instead of consuming instrument height.

### Changed

- Build the distributable during Git dependency installation, so a pinned source revision can be consumed while registry publication is unavailable.

## [0.06.006] - 2026-09-10

### Fixed

- The repository link now uses the supported `CodeXml` icon. Lucide 1.x removed the `Github` export, which broke consumer browser builds despite satisfying the shell's declared peer range. The accessible repository link and destination remain intact.
- Development validation now uses Lucide 1.43.0, with a browser-bundle regression test that resolves its actual ESM exports instead of externalizing the dependency.

## [0.06.005] - 2026-09-10

### Added

- Optional bilingual `footer.attribution` (or `false`) and `footer.license` let applications use their actual authorship/privacy requirements and code license while retaining the shared shell. Existing consumers keep their previous footer by default.

## [0.06.004] - 2026-09-06

### Fixed

- **A wide table in a vertical sub-tab panel pushed the page past the viewport.** The
  `.subtabs-vertical` grid used a bare `1fr` panel track, which is `minmax(auto, 1fr)`: the
  panel's min-content width is the table's width, so the grid sized itself to the table
  instead of letting the table scroll inside its wrapper (ADR-0071 rule 3). Measured on
  Porvenir's Datasets tab at 1280x800: the panel column rendered 1380px wide on a 1280px
  viewport. The track is now `minmax(0, 1fr)`, and `.subtabs`, `.subtabpanels` and
  `.subtabpanel` carry `min-width: 0` beside `.tabs` and `.tabpanel`.
- **On a contained surface (`.app-shell.fixed`) the footer took 178px.** A product's
  provenance and disclaimer wrapped into five lines at 1600x900 and the instrument fell from
  56 to 42 percent of the viewport, under the ADR-0071 rule 8 floor. The footer keeps its
  text (ADR-0016 s2) and is set compact on fixed routes only: two to three lines.

## [0.06.003] - 2026-09-06

### Added

- **`ShellConfig.fixedRoutes` and `ShellConfig.fixed`**, the per-route opt-in to the contained
  layout ADR-0071 rule 1 requires (the app surface IS the viewport; the one container that
  owns long content scrolls, the document never does). `styles.css` has carried
  `.app-shell.fixed` since the containment fix with the note "apps that fill the viewport add
  it", and no app could: `AppShell` rendered a fixed class string. Measured on Porvenir before
  this field existed: every tab of the App route scrolled the document by 200 to 770px at
  1600x900, and the ADR gate could not see it because it never measured scrollHeight. A route
  in `fixedRoutes` (exact for `/`, prefix for any other path) gets the class; `fixed: true`
  contains every route of a single-surface app. Nothing changes for consumers that set neither.

### Fixed

- **`test/layout-primitives.test.ts` could not see a compound or descendant override.** It
  inspected only blocks whose selector list contained exactly `.page-body`; appending
  `.app-shell .page-body { max-width: 100%; margin-inline: 0 }` to the stylesheet removed the
  reading cap and the centering from every product and all five tests passed. The test now
  walks every rule whose subject carries the class, requires the plain rule to hold the
  intended value, and refuses any competing declaration outside the documented `.wide`
  opt-in; proven on that exact override (two failures) and clean on the shipped stylesheet.

## [0.06.002] - 2026-09-03

### Added

- **`CaseSelector layout="select"`**, the compact one-of-N picker ADR-0071 rule 7 asks for:
  a native dropdown with one `optgroup` per category, preserving the category structure the
  chip layout carries. The chip layout spends vertical space linearly in the number of cases,
  and that space comes out of the instrument on every render. Measured on Porvenir at
  2560x1440: ten cases in four categories occupied a 308px block, 21 percent of the viewport,
  for a choice one control expresses. Default stays `chips`, so nothing changes for existing
  consumers until they opt in.

## [0.06.001] - 2026-09-03

### Fixed

- **Every prose page in every product on this shell rendered full-bleed.** `styles.css` defined
  `.page-body { max-width: var(--maxw) }`, the 1200px reading measure ADR-0017 s1.1 specifies, and
  then 216 lines later a containment fix added a second unscoped `.page-body { max-width: 100% }`.
  CSS takes the last one, so the cap was silently removed everywhere. Measured on Porvenir at
  1600x900: the doc routes rendered 1600px wide instead of 1200px centered, so body text ran the
  full width of the display.

  The overriding rule was itself written to fix a real bug (a `nowrap` row sizing its whole column
  and pushing the page wider than the viewport, ADR-0071 rule 3). Containment is about letting a box
  SHRINK below its content, which is `min-width: 0`; capping it at 100% does nothing for that and
  costs the measure. Changed to `min-width: 0`. `.page-body.wide` is more specific and still wins,
  so workbench routes keep the full viewport.

  Nothing could see this. The package built, the types were correct, and every consumer imported the
  right class. `test/layout-primitives.test.ts` now asserts that the LAST declaration of a capped
  property on each layout primitive is the intended one, so a later rule overriding a primitive fails
  here instead of shipping to every app. Verified non-vacuous: re-adding the rule fails the test.

## [0.06.000] - 2026-08-23

### Added

- **Bilingual architecture diagrams (ADR-0058).** The ArchitectureModal panel now carries
  `data-arch-lang`, and the stylesheet ships the three rules that act on it. A diagram tags each
  translatable `<text>` twice at the same coordinates, `class="... l-en"` and `class="... l-es"`,
  and exactly one is shown. Diagrams previously rendered English text inside a fully Spanish UI,
  which was the last untranslated surface in an otherwise bilingual shell.

  ONE file carries both languages on purpose. Two files would be two things to keep in step, and
  the one not on screen is the one that goes stale. Anything language-neutral, a number, a file
  name, an identifier, needs no pair.

  Backwards compatible: a diagram with no `l-en`/`l-es` classes renders exactly as before.

### Fixed

- `npm test` listed its test files by hand, so a newly added test file silently never ran. It now
  discovers `test/**/*.test.ts(x)`, which immediately picked up two tests that had been invisible.

## [0.05.000] - 2026-08-03

### Added

- `WorkbenchShell`, a typed authenticated-console frame with shared route rendering, desktop sidebar,
  mobile bottom navigation and extension slots for product-owned brand, sidebar trust/actions, command
  surface, account/chat controls, overlays and canonical content.
- A server-rendered contract test proving route activation, slot preservation, the main-content
  landmark and overlay placement without coupling the package to product state.

### Changed

- The shell now consumes the stable `react-router` core peer contract across major versions 6, 7 and
  8. Browser applications can keep `react-router-dom` 6/7, while core-only Router 8 applications are
  supported without a downgrade. The package is built/tested against 8.3.0 and retains `AppShell`.
- Package, display version, lockfile, README and changelog now advance together for the npm release.

## [0.04.000] - 2026-07-28

### Added (the ADR-0071 UI floor, so every product inherits it instead of fixing it alone)
- **`.page-body.wide`**: a workbench is not prose. App surfaces take the full viewport; the 1200px
  reading measure (`--maxw`) stays for prose pages. Capping an instrument at a reading width discarded
  400px on a 1600px display and over half of a 2560px one, which is why the visualization read as a
  thumbnail across the whole product line.
- **`.app-shell.fixed`**: an app surface sized by flex rather than by a hardcoded guess at the chrome.
  Products were computing `calc(100dvh - 150px)` while real chrome measured 175px, leaving a few pixels
  of scroll; the constant also has to be maintained whenever the header or footer changes.
- **`.app-shell.fixed .site-footer { margin-top: 0 }`**: the prose footer margin (3rem) is dead space in
  a viewport-filling app. It was exactly the 48px gap users saw above the footer.

### Changed
- **The tab bar is a single row.** `flex-wrap: wrap` let a 12-to-18 tab bar occupy two and three rows,
  and every extra row is vertical space taken from the content permanently, on every render.
- **Layout containment.** `html, body { overflow-x: hidden }` plus `min-width: 0` and `max-width: 100%`
  on `.tabs`, `.tabpanel` and `.tablist`. A flex or grid item defaults to `min-width: auto` and will not
  shrink below its content, so a single `nowrap` row silently sized the page to 1817px on a 1600px
  viewport and the user had to drag sideways to reach the right edge.

### Note for consumers
A tab row that must scroll horizontally MUST NOT use `overflow-x` on the row itself if it hosts dropdown
menus: in CSS a box cannot keep `overflow-y: visible` when the other axis is anything else, so the
declared value computes to `auto` and the row clips its own menu. Either keep the row short enough not to
scroll (group the tabs, per ADR-0071) or position the menu `fixed`.

# Changelog

All notable changes to this product. Format: `X.XX.XXX` (display, see the workspace `versioning.md`); stays `0.x` while pre-1.0. Tag every release.

## [0.03.000] · 2026-07-04

### Added
- **`usePausedViz` + `createVizLoop`**, a no-compute-bomb animation loop for canvases/3D views:
  default paused, run-once-then-stop (looping opt-in), optional `durationMs` hard cap, and auto-halt
  on a hidden tab (visibilitychange). The state machine (`createVizLoop`) is framework-free with
  injected `requestAnimationFrame`/`cancelAnimationFrame`, unit-tested with a fake clock (10 tests).
  `usePausedViz` is the React wrapper. Animated views should mount through it instead of calling rAF
  directly. Enforces the portfolio "no autoplay, no compute bomb" rule at the shell level.
- **`CaseSelector` v2**, shared source + case picker. Chips show `ID · name`; cases render in
  labelled category groups; an optional first-level `Synthetic | Real | Uploaded` source control
  filters the deck and shows a locked-knobs explanation on non-synthetic lanes; a "modified from CASE"
  divergence badge with reset; opt-in `?case=` deep-linking. Pure model (`caseModel.ts`) unit-tested
  (6 tests). Closes the inherited selector defects portfolio-wide (deep-review 1.6.1-1.6.4).
- Establishes the shell's first test harness (`npm test` → `node --test` + `tsx`; 16 tests).

## [0.02.000] · 2026-07-03

### Added
- Adopt the `X.XX.XXX` versioning scheme: a `VERSION` file as the single source of truth, this `CHANGELOG`, and the first git tag. Baseline documenting the current shipped state; later changes are versioned by nature (major/minor/patch).
## [0.06.007] - 2026-09-10

### Fixed

- Architecture dialogs keep keyboard focus within the modal and return it to the opener on close. Tabs support arrow keys, Home and End with explicit tab-panel relationships.
- Architecture diagrams offer a contained native-size reading view and a fit toggle in English and Spanish. Native-size viewing preserves authored text size on mobile while retaining the selected theme and language.
- A real Chromium consumer checks keyboard navigation, Escape, focus restoration, native-size scrolling and diagram fit in both languages and themes at mobile and desktop widths (`npm run test:browser`).
## [0.06.008] - 2026-09-10

### Fixed

- All configured page routes remain reachable on mobile through a compact second header row. Links scroll horizontally inside the header, retain their active-page semantics and remain visible when reached by keyboard focus.
- Real-browser navigation tests exercise all six routes by click and keyboard at 320, 390 and 1440 px, in EN/ES and both themes. They verify viewport containment and a header below 100 px so the main instrument retains most of the viewport.
