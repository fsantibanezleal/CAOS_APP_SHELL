## [0.15.000] - 2026-10-15

### Added

- Gate check G19, values whole (SHG-057, BL-066). In every measured state, a short value written in the page's text must sit on
  one line. A value is a run of characters without breaking whitespace in one text node (U+00A0 and U+202F do not end it), 2 to 16
  characters long once the sentence's own punctuation is stripped from its ends, with a digit, at most 4 letters and no other
  character than digits, signs, separators, currency signs and `% ‰ × °`: `35%`, `0,96`, `US$1.2bn`, `2026-10-15`, `-3,2pp`,
  `ADR-0071`. The probe `window.__caosGate.brokenValues()` reads each value's `Range` and counts the groups of its client rects by
  top; a value on more than one line fails as `"35%" breaks across 3 lines (<element>)`, also when it is longer than its container,
  and runs in every route, size, theme and language, in the wide-font pass and in Focus mode. Why: shell 0.14.2 fixed a share that
  broke into "3", "5", "%" at 390px on every product's executive view, and none of G5 to G10 saw it, because the pieces are neither
  clipped nor outside their box. Not read: a value split across elements (`<b>35</b>%`), SVG text (G10), canvas text, `code`, `pre`,
  `kbd`, `samp`, KaTeX, `translate="no"` and `aria-hidden` content; `12 %` with a regular space is two runs and may wrap. The
  self-test plant `value-broken` reproduces the pre-0.14.2 row (a shrinking flex value with `overflow-wrap: anywhere`), the plant
  `value-broken-range` cuts `599-653` inside `653`, and the clean fixture passes in every state.
- Adopting 0.15.0: a product may meet new G19 failures it did not have under 0.14.x. Each names the value and the element: a number,
  percentage, amount or unit that a narrow container, a flex row that lets the value shrink, or `overflow-wrap: anywhere` on a
  parent cuts into pieces. Give the value `white-space: nowrap` (and `flex: none` in a flex row), or write it with U+00A0 between
  the number and its unit where the unit may wrap away. A break right after a hyphen, a dash or a slash is a normal
  line break and passes (the fixture's citation pages `599-653` break at the hyphen at 390px in Spanish and pass); only a break inside
  a segment between those places fails. No shell component or stylesheet changed in this release.

## [0.14.003] - 2026-10-15

### Fixed

- Focus mode: the stage label no longer covers the stage's controls. On Contraste's C10 at 1280px the title ("Portfolio credit
  capital: ASRF, Vasicek fit, copula MC") wrapped to two lines and the label sat over the open group's sub-tab row, because the
  stage cleared the label by a fixed 4.6rem (6.6rem under 900px). `FocusShell` now measures its overlay chrome (the label, the HUD
  tiles, the actions; a layout effect, one `ResizeObserver`, the `resize` event, values written only when they change) and sets
  three lengths on `.caos-focus-stage`: `--caos-focus-clear-top`, `--caos-focus-clear-bottom` and `--caos-focus-label-bottom`.
  The `CaseWorkbench` focus stage pads by them (4.6rem and 6.6rem remain the fallbacks before the first measurement and in a
  non-browser render), the desktop HUD starts under the measured label instead of at a fixed 104px, and under 900px the stage clears
  a bottom HUD. A product that renders its own instrument in `FocusShell` can use the same properties. No prop changes (SHW-038).
- Focus mode: the Focus control no longer shows inside Focus. Since 0.14.1 the rail inside the focus frame carried the Focus button
  beside the case select, a control that opens the mode the reader is already in. The focus frame's rail head is now the case
  picker and the variant bar without it, in every layout; a product's own `cases.accessory` still shows, and the App's rail head is
  unchanged (SHW-037).
- Gate G18 now fails both: a stage control under the Focus chrome (the stage label, the HUD or the Focus actions) and a Focus
  control inside the Focus frame (SHG-056). The self-test plants `focus-chrome-covers` and `focus-enter-inside` prove it, and the
  clean fixture now has a Focus title that wraps at 1280px, so every clean run walks the wrapping path.
- The repository's CI base-integrity guard judged a tracked `.env` wrongly both ways: a real `.env` passed whenever a root
  `.env.example` was tracked, and a tree whose only example file is nested failed. The step now reads `git ls-files` once and
  tests it on here-strings (`git ls-files | grep -q` also fails at random under pipefail, as the products' CI found); any `.env`
  other than an `.example` file fails. `test/ciGuards.test.ts` runs the step itself on planted trees (red on the old step).

## [0.14.002] - 2026-10-15

### Fixed

- The executive view's "Where it comes from" shares stay whole at phone width: the cause row lets its label wrap anywhere, and its
  squeezed value broke into "3", "5", "%" at 390px (seen on the template's example and on every product's executive view). The value
  no longer shrinks or wraps (`.caos-exec-cause-head > .caos-exec-value`); `e2e/executive-view.test.ts` counts the line boxes of every
  visible value at 390px in both languages (it fails without the fix).

## [0.14.001] - 2026-10-15

### Fixed

- The Focus control of `CaseWorkbench` sits on the case select's row (`CaseSelector` takes an `accessory`, rendered after the select
  in one row, the select shrinking to make room), so the rail head is no taller with it. On a row of its own it added 37px to the
  rail head, and rails with little slack scrolled 6 to 10px (ADR-0071 rule 6: Contraste's C04 and C22, 19 gate failures when it
  adopted 0.14.0). With case chips, or with no case picker, the control keeps a row of its own, as in 0.14.0. The visible word
  ("Focus" / "Enfocar") and the accessible name are unchanged (SHW-031).

## [0.14.000] - 2026-10-14

Flip cards, the card carousel, animated illustrations and Focus mode for the App (CAOS_MANAGE `plans/app-shell/0-14-0-plan.md`,
backlog BL-060 to BL-063). Additive: a product that changes nothing renders as before, except that the executive view's four
card groups now flip. The gate gains G16, G17 and G18.

### Added

- `FlipCard` (exported): a small card whose face shows its title and whose back shows its content after a click, Enter or Space,
  and back again. A real button carries `aria-expanded` and `aria-controls` on each face; keyboard focus moves to the face that
  shows; the hidden face is out of the accessibility tree and the tab order (`aria-hidden` and `inert`) while its content stays in
  the markup; Escape closes; `prefers-reduced-motion: reduce` swaps the faces without the turn; theme tokens only; the face says it
  turns (an icon and a hidden "Show details" / "Mostrar detalles"). The rule of use: SMALL cards only (a title of at most 8 words
  in English and 10 in Spanish, a back of at most 40 and 50), where the reader scans the titles and opens the ones that matter.
- `CardDeck` (exported): a list of cards plain, as flip cards (`flip`), as a row up to `carouselAbove` cards (default 4) and as a
  carousel above it: as many cards as fit (at least one), previous and next buttons, swipe on touch, arrow keys, Home and End, a
  position ("2 of 5" / "2 de 5"), no autoplay, every card reachable by keyboard, never a sideways scroll of the page or its panel;
  reduced motion removes the slide. With `FLIP_LIMITS`, `FLIP_TEXT`, `DECK_TEXT`, `perPageFor`, `deckWindow` and `deckPosition`.
- The executive view shows `pain.bearers`, `situation.roles`, `situation.state_of_the_art` and `proposal.four_cs` as flip cards
  (a row of four or fewer, a carousel of five); `context.forces`, `trends.items` and `proposal.actions` stay plain. The data
  contract (`executive.schema.json` 2.0.0) is unchanged.
- Animated illustrations: an executive illustration (or any figure) may be an SVG with CSS keyframes or SMIL inside the file, a
  gentle loop or a single play of at most ten seconds, theme tokens, labels that stay put, and a `@media (prefers-reduced-motion:
  reduce)` block that shows the static final frame. The shell pauses a SMIL animation at its last frame under reduced motion, and
  `cleanSvg` removes an animation that writes a link or an event handler. `analyseSvgAnimation` and `animationFailures` (in
  `gate/areas.mjs`) are the analysis the template's guard script reuses.
- Focus mode for the App: `CaseWorkbench` takes `focus` (`true` or `CaseFocusConfig`). A Focus button in the rail head opens the
  selected case's open group in the full viewport through `FocusShell` (the stage is the view, the rail stays), holds `?focus=1`
  beside `?case=` and `?view=`, and returns with Escape or the exit button to the same case, group and sub-view (the open sub-tab of
  each tab row is kept across the frame change). `removeQueryParam`, `FOCUS_TEXT` and `FOCUS_PARAM` are exported; `FocusShell`
  marks `data-focus-shell`, `data-rail` and `data-focus-exit`. The plan named `WorkbenchShell`; the case, group and view live in
  `CaseWorkbench`, so the control is there, and `WorkbenchShell` is unchanged. `WorkbenchLayout` exports its rail body as `RailBody`.
- The gate: G16 (flip cards and card decks: the size limits, real buttons, Enter and Space, focus, the hidden face out of the
  accessibility tree, the carousel reaching every card without a sideways scroll), G17 (animated drawings: the reduced-motion block,
  ten seconds at most, still under emulated reduced motion) and G18 (Focus mode, entered by clicking for every case and left by the
  exit control and by Escape: the same case and group, no page scroll, the rail without scroll, one tab row); `--require-focus`
  fails an App without a Focus control. 13 plants prove them. The executive-view checks read the back of a flip card and the cards
  a carousel hides, so the floors, the 4 C's and the writing limits still apply to them.

### Fixed (review of 0.14.0)

- The executive-view checks of the gate are back at their 0.13.1 strength: a flip card's back is read with the card turned, hidden 4 C's and hidden bearers' details fail ADR-0017.2 again; only a card the carousel's window hides is exempt.
- Focus mode makes the page behind it inert and no longer nests a `main` in the App's `main` (`FocusShell` takes `landmark={false}`).
- G16 checks that an opened back shows content, that a hidden face keeps no reachable control and that a carousel without controls hides no card; G17 analyses `img` SVG figures and multiplies finite iteration counts; G18 starts from the last group and sub-view, compares both, keeps Tab in the frame and refuses a nested `main`; 10 plants.
- The carousel's focus guard moves focus to the toggle of the face that shows.

### Changed

- The fixture product's executive view holds five bearers (a carousel) and an animated `pain` illustration.

## [0.13.001] - 2026-10-13

### Fixed

- `STANDARD_ROUTES` is again App, Introduction, Methodology, Implementation, Experiments, Benchmark: the App is the leftmost
  tab, always (Felipe, 2026-10-13). 0.13.0 had put the Introduction first when the landing moved to it; the landing is
  unchanged (the root and unknown paths open the Introduction's executive view through `Landing`) and no longer moves
  the tabs. A product on 0.13.0 needs no change beyond the version: its header reads the order from `STANDARD_ROUTES`.
- Every documentation route takes the full width of the page, the Introduction included (Felipe, 2026-10-13: the
  Introduction did not use the full width while Methodology, Implementation, Experiments and Benchmark did): `DocPage`
  always renders the wide document layout; its `wide` prop is kept for compatibility and changes nothing.
- The order test (`test/workbench.test.tsx`), the navigation end-to-end test (`e2e/landing.test.ts`), requirement SHF-011
  and the docs (`docs/01_structure.md`, `docs/06_executive-view.md`) state the order.

## [0.13.000] - 2026-10-13

### Changed

Every product lands on its executive view, and the view is the standard Felipe set on 2026-10-13 (CAOS_MANAGE `conventions/problem-context-first.md`): an executive frame of the industry's problem, not of the product, never tied to a client and never a pitch. A landing block (the problem's title, a key statement, two or three headline figures with linked sources) sits above five sub-tabs (the pain, the context, the current situation, the trends, the proposal with the 4 C's Choice, Context, Cost and Control), each opening with its key message line and holding its depth floor. Sources are links. The view and every lede take the full width of the document column. BREAKING: `executive.schema.json` 2.0.0 replaces the 0.12.0 fields; the App moves to `/app` (old links forward with their query string), one router edit per product.

- The executive view is redefined (schema 2.0.0, breaking): it frames the industry's problem for a decision maker, general,
  never tied to a client and never a pitch (CAOS_MANAGE `conventions/problem-context-first.md`, decided 2026-10-13). The data file
  is `title`, `key_statement`, `headline_figures` (2 or 3: heading, value, unit, source), one object per sub-tab (`pain`,
  `context`, `situation`, `trends`, `proposal`, each with its `key_message` and its supporting fields at the floors of the
  structure as minimum and maximum counts of rows), the three `illustrations` `pain`, `situation` and `proposal`, and `sources`.
  The 0.12.0 fields (`executive`, `organisation`, `initiative`, `why_now`, `vision`, `outcomes`, a top-level `four_cs`,
  `dialogue`) are gone; a product rewrites its `content/executive.json` and its three illustrations (`docs/06_executive-view.md`
  has the fields, the floors and the writing limits).
- The view shows a landing block (the title, the key statement, the headline figures) above five sub-tabs titled "The pain",
  "The context", "The current situation", "The trends", "The proposal" (Spanish "El problema", "El contexto", "La situación
  actual", "Las tendencias", "La propuesta"), each opening with its key message line, then the numbered linked sources and two
  onward links ("How the work explores this problem", "Open the App"). The sections come from one definition,
  `EXEC_SECTION_DEFS` in `executive.ts`. No rubric label and no rubric question is printed; the gate fails a view that prints one.
- The 4 C's are required in the proposal: `FOUR_CS` holds Choice, Context, Cost and Control with Felipe's definitions in English
  and Spanish (2026-10-13), `proposal.four_cs` has exactly those four rows in that order, each with `applies` (what the C means
  for the proposal). The pending state of section 3 is gone.
- Sources are links: each `sources` entry is `{ id, title, url, note? }` with an https `url`; every figure and every claim of the
  state of the art and of the trends cites one by id, every source is cited, and the notes number in the order of first use. The
  validator and the gate fail a source without a url, with a non-https url, over the writing limits, or citing a file name or
  number in place of the link (`file 7`, `archivo 7`, a `.pdf` name, "Published on").
- Extra rules of the validator, mirrored by the gate on the rendered page: the causes' weights add to at most 100; each action's
  owner is a role of the current situation; a paragraph has at least 25 words; one sentence for the key messages, captions,
  actions and checks, two for the key statement.
- General, never a client, never a pitch: the validator and the gate fail promotional or client-bound wording ("our client",
  "nuestro cliente", "contact us", "contáctenos", "buy", "comprar", "price", "precio", "offer", "oferta" and their plurals, whole
  words, either case) in any text field; one gate plant per word.
- Gate: it gathers the facts of every sub-tab it visits (both languages) and checks the landing block, the five sub-tabs, the key
  message lines, every floor on the rendered rows, the 4 C's, the sources, the onward links, the rubric text, the full width and the
  illustrations; about fifty executive plants. The `G5: shrunk-tabs` plant is repaired (below).
- Full width: the lede of every `DocPage` takes the full width of the document column (the 70ch measure on `.lede` is gone) and the
  executive view takes the full width of the column too (an illustration may stay centred inside its figure). A browser test
  measures both at 1280 and 1600 px; the gate fails a lede or an executive block narrower than the column (plants `lede-narrow`,
  `exec-narrow`). In the shell's own browser harness only the lede was narrow; a narrower Introduction in a product comes from the
  product's own CSS or a non-prose wrapper.
- Landing (breaking for the router of a product): every product lands on the Introduction with its executive view open. New
  exports `Landing`, `LANDING_ROUTE` and `APP_ROUTE`; `STANDARD_ROUTES` is now Introduction (`/introduction`), App (`/app`),
  Methodology, Implementation, Experiments, Benchmark. A product changes its router once: `/` and `*` render `<Landing />`, `/app`
  renders the App, `fixedRoutes` names `/app`, a static site materialises `app/index.html` (`docs/06_executive-view.md`, The
  landing). An old App link such as `/?case=B2#x` is forwarded to `/app?case=B2#x`. The gate default `--workbench` is `/app`,
  checks that the root opens the Introduction on its executive view and that an old App link keeps its query string and hash
  (plant `landing-app`); its static server keeps the query string through its trailing-slash redirect.
- The gate plant `G5: shrunk-tabs` failed on develop and on the 0.12.0 release commit in the current Chromium (153.0.8010.12): the
  plant shrinks the tab row with a flex rule, which that Chromium absorbs without overflowing the tabs, so the gate's cut measure
  read zero. The plant now also caps the row's height below its tabs, which reproduces the cut that known shell defect 16 describes;
  the gate's measure is unchanged.
- The executive view's source notes wrap a long word explicitly (`overflow-wrap: anywhere`, as its facts and why-now
  line already do; BL-053). A long URL in a note was reported to widen a 390 px page by CAOS_Contraste BL-070; the
  overflow was not reproduced in the shell's browser test or in Contraste's build, and the rule makes the wrap explicit
  either way.
- The executive-view browser test renders the view as products do (a `DocPage` with the two `Tabs` of an
  Introduction) and adds a long-URL note case at 390 px.

## [0.12.000] - 2026-10-12

### Changed

The executive view of every CAOS app is one standard rendered by the shell (CAOS_MANAGE `conventions/problem-context-first.md`): the four sections of Felipe's executive-pitch rubric, verbatim, from one validated data file, with three authored illustrations of the initiative, the problem and the proposed solution.

- `ExecutiveView` and `executive.schema.json` 1.0.0: the executive view of every Introduction is now one component fed by the
  product's `content/executive.json` (four sections with Felipe's rubric titles and questions, three inline illustrations,
  numbered source notes). It takes no children; invalid data renders an error state listing each field path. Exports:
  `ExecutiveView`, `validateExecutive`, `FOUR_CS`, `EXECUTIVE_SCHEMA_VERSION`. `FOUR_CS` is empty until Felipe names the 4 C's;
  section 3 shows its declared pending state meanwhile.
- BREAKING for products: the Introduction areas `initiative`, `outcomes`, `positioning` and `credibility` are removed from
  `DOC_AREAS` and from the gate's table; a section declaring one fails as an unknown area. The executive view cannot be waived.
- Gate: a new executive-view check on `/introduction` (the view is the shell's `ExecutiveView`, first and default, its data
  valid in the page, the writing limits on the rendered text in both languages, nothing placed beside it, readable fields,
  one source note per figure, and for each illustration: place, caption, inline, loaded, theme tokens only, no `data-chart`,
  labels inside the viewBox and at least 9 px). Self-test plants added (`exec-*`); the plants of the removed areas are replaced.
- Styles: `.caos-exec*` classes for the view; `reserved-classes.json` regenerated.
- Docs: `docs/06_executive-view.md`; requirement rows SHD-034 to SHD-047.
- Package: `executive.schema.json` is published (`files`) and exported as `@fasl-work/caos-app-shell/executive.schema.json`.

## [0.11.002] - 2026-10-12

### Fixed

Found by CAOS_Contraste 0.07.000 on the release gate of shell 0.11.1 (G6 at 138 px, Spanish, 1280x800, wide font):

- The filling card's stage floor now holds on the stage itself: at 1280 px and wider the body of a `PlotCard fill` (the
  box the gate measures) keeps at least `--caos-stage-floor` (140 px), so the card grows when its header or its note
  wraps and the containing panel scrolls. 0.11.1 derived a card height from a fixed chrome, which a header wrapping to
  a third line defeated (a 400 px column with a note left 106 px). The browser test now covers cards without a note and
  the narrow column of a three-view row.

## [0.11.001] - 2026-10-12

### Fixed

Found by CAOS_Contraste 0.07.000, whose CI web baseline (correctly) refused the product rule it had needed:

- A filling `PlotCard` keeps a minimum height of its own at 1280 px and wider, derived from its layout (the header, the padding and the note's 35% cap), so its drawing keeps the gate's stage floor (140 px) when filling cards share a short column, in every language and in the wide font. Products no longer restyle `.caos-plot.fill` to pass G6. Below 1280 px nothing changes. The gate fixture's Fit tab stacks two filling cards in one column.

Adoption: a product drops any rule of its own that gave `.caos-plot.fill` a minimum height (CAOS_Contraste's
`@media (min-width: 1280px) { .caos-plot.fill { min-height: 23rem; } }`).

## [0.11.000] - 2026-10-12

### Added

The shell's first software design document (ADR-0075) and the gate that holds it to its tests (#100):

- `docs/design/SDD.md`: the problem and non-goals, the dimensioning of `src/` measured by a script (45 modules,
  4,251 lines), technology and versions, the public contracts (entries, stylesheets, reserved classes, the `data-*`
  attributes the gate reads, the gate CLI), the components by area, how each component behaves without data, with
  partial data, in error and while loading, verification, versions and adoption, risks, ADR fit.
- `docs/design/features/<area>/requirements.md`: nine areas, 188 EARS requirements at release, each naming the test or gate
  plant that verifies it; every test file and every plant is cited.
- `scripts/check_sdd.py` (`npm run check:sdd`, a step of the `guards` job): the ten sections in order, unique
  `SH[DFWCKNTAG]-NNN` ids, SHALL in every statement, and every gate reference resolved to a test defined in the named
  file (comments stripped) or to a plant id in `test/gate-selftest.mjs`; its own tests run in CI too; after an adversarial review it rejects names inside strings, comments or another test's body, skipped and todo tests, `describe` blocks, plain paths, paths outside the repository, malformed rows and stray ids, planned or superseded areas without a reviewed `.status-allow` entry, and SDD headings inside fences or comments.
- CONTRIBUTING.md and docs/08_releasing.md: a change starts with its requirement row, then a failing test that names
  it, then the code.

The required content of the documentation pages, declared by the page and measured by the gate (ADR-0017 section 2.1;
the core of every product is its tailoring to a real problem, so the Introduction opens for a decision maker):

- The Introduction has two views: `executive` first (areas `initiative`, `outcomes`, `positioning`, `credibility`,
  in business language, no equation, every value claim a number with its unit and source) and `technical` (`problem`,
  `principles`, `math` with a symbol glossary, `pipeline`, `honesty`). The executive view cannot be waived.
- Methodology, Implementation, Experiments and Benchmark each have their named areas and floors (the tables in
  `docs/04_views.md`, from one table, `gate/areas.mjs`).
- A section declares what it covers: `<DocSection area="...">` (and `kind="classical" | "learned"` for a method).
  New components: `Stat` (a value, its unit, its source), `Question` (a business question and its answer) and
  `Glossary`. `DocPage` takes `floorWaivers`: a floor a page cannot meet is declared with its reason, listed in the
  gate report, and reviewed with the pull request that adds it.
- The gate fails (`ADR-0017.2`) a page that lacks a required area, or whose area lacks its required content, in either
  language, counting only what a reader can see where the glyphs are painted. The executive view must be the view the
  page opens on; no Introduction content sits outside the two views; a tab list inside a section belongs to that
  section and is judged across every state; a Methodology method cites references; the Benchmark's live panel needs a
  registered control. The language of a page stays a reviewer's duty.

Adoption: a product on 0.11.0 fails the gate until its five documentation pages declare their areas and its
Introduction carries the executive view. Write the executive brief first, in the product's design document
(CAOS_MANAGE `conventions/problem-context-first.md`; the template's `docs/guides/06_executive-brief.md` and
`07_documentation-pages.md`), then transcribe it to the page.

Contract-first products declare missing data instead of drawing an empty chart (ADR-0080; #99):

- The gate accepts an instrument that draws nothing and shows a `data-state="unavailable"` note a reader can see and
  read (its glyphs painted inside the instrument at a legible size, not clipped, not transparent, at least 12 letters or digits in two words). An invisible, clipped or
  empty note, a reason of punctuation, or any drawing element rendered beside the note fails G6, each with its own
  message. The gate checks that a reason exists, not that it is true.

The gate self-test grows from 37 to 98 plants, one per check and per trap, with legitimate pages that must pass (a method with its own view tabs, outcomes as a list). Two adversarial reviews tried to break these checks; every case they found is a plant.

`yMarks` for reference levels (#94):

- A tone per line (`warn`, `bad`, `good`, `neutral`), and a y range that takes every line in, so a level outside the
  data stays in view.

### Changed

Documentation pages (#96, found on CAOS_Contraste's Methodology):

- Text blocks of `.prose` take the full width of the document column; captions keep their measure and stay centred.
- References are one block at the end of the scope that shows them: the open tab or sub-tab panel, otherwise the end
  of the `DocPage` (`section.caos-doc-references`, each citation once, in the order of first appearance). `DocSection`
  registers its `refs` with the nearest scope instead of rendering a `Refs` row; `ReferenceList` is superseded.
- The gate's ADR-0017.4 fails a bibliography outside the end-of-page block, a references block that is not last, and
  sections that cite references the page never lists (plants `refs-mid`, `refs-missing`).

A filling card (#95):

- A `PlotCard fill` note keeps at most 35% of the card and scrolls beyond it.
- The gate fails a drawing under `--stage-floor` (140 px by default) at 1280 px and above (G6, plant `stage-floor`).

### Fixed

- Known shell defect 35: a knob's range input kept the user agent's side margins, so at phone widths it ran past a
  clipping card (#91). Products drop their `margin-inline: 0` override.
- The end-of-page references tests drive Chromium and now run with the browser suite (`e2e/`); develop CI had failed
  since #97 because the unit job installs no browser.

## [0.10.000] - 2026-10-08

### Added

What CAOS_Fragmenta's parity plot still drew on a canvas of its own (CAOS_APP_SHELL#84; CAOS_MANAGE `plans/app-shell`
BL-029): with these a product draws predicted against measured, its null model and the case the reader picked on
`UPlotChart`.

- `yMarks`: horizontal reference lines, each labelled at its right end above the line, inside the plot, haloed
  (`drawYMarks`; the host declares `data-y-marks`).
- `ChartSeries.size`: the marker diameter of a `points` series (9 px by default), so the selected case can sit in a
  larger series of its own colour.
- On a chart whose series are all `points`, the cursor, the readout, `onCursor` and `onPick` take the point nearest the
  pointer in the plane (`nearestPoint`); uPlot alone takes the nearest in x, which on a scatter named a point far above
  or below the pointer. The readout names only the series that have the point.
- `readout(index)`: the caller's text for the point under the cursor, in place of the list of values (a scatter
  names its case: the blast, its site, its error); `hint`: the readout at rest.
- A parity plot's range takes in its reference lines, so a null model's level is always in view; its two axes tick
  at one step (uPlot spaces x and y ticks differently, so one range read 25, 30, 35 across and 24, 26, 28 up); filling
  a box taller than it is wide, it is centred down as well as across.
- Every chart declares how many ticks each axis labels (`data-ticks-x`, `data-ticks-y`).
- `/chart` exports `drawYMarks` and `nearestPoint`.
- The gate fixture's parity plot carries a reference line and a selected point; `e2e/parity.test.ts` hovers and
  clicks beside a point whose neighbour in x lies far below it, and reads the reference line off the canvas (it fails
  with the nearest-in-x cursor).

### Fixed

- The lock file still said 0.9.3 after 0.9.4; it follows `package.json` again.

## [0.09.004] - 2026-10-08

### Fixed

Found by CAOS_Contraste's case C04 and the 0.9.3 gate on its build:

- Known shell defect 32: a value on the scientific boundary was written in scientific notation when it was a percent.
  `formatNumber` writes a magnitude below 1e-4 as `1E-5`, and a percent is the value times 100; 1e-6 times 100 is
  9.999999999999999e-5 in binary floating point, so a log axis of PDs in percent labelled its 1e-6 tick `1E-4 %`
  between `0.01 %` and `1 %` (CAOS_Contraste C04, Fitch's generators; #81), and `formatTicks` turned a whole axis
  scientific for the same tick. The boundary is now compared with a relative tolerance of 1e-12: `0.0001 %`; a value
  truly below it (9.99e-5) stays `9.99E-5`. `test/base09.test.tsx` holds both, the percent, the plain value and the
  ticks, in English and Spanish.
- Known shell defect 33 (#85): the hover rule `.chip:hover:not(:disabled)` outranked `.chip.on`, so the active chip
  under the pointer, the one a reader has just clicked, wrote its label in the text colour on the accent: 3.04:1 in
  the light theme and 1.64:1 in the dark, under G13's 4.5:1 (every rail section the gate clicks on Contraste). The
  case selector's `.cs-chip` lost its accent the same way. The hover rules now leave the active chip alone;
  `e2e/chips.test.ts` hovers the active chip, an inactive one and the chosen case's chip in Chromium in both themes.

On adoption: nothing to change; a tick or a cell at exactly 0.0001 % reads in fixed notation, and an active chip keeps
its colours under the pointer.

## [0.09.003] - 2026-10-08

### Fixed

- A `Knob` in the rail drew its value under its label: the rail's rule for a labelled control
  (`.caos-wb-rail label`, a column) outranked `.caos-knob-head` (a row, the value at the right), so every knob in
  every rail took one more line than it is designed to, since 0.7.0 (CAOS_APP_SHELL#77). Found by the 0.9.1 gate on
  CAOS_Fragmenta, its one failure left of 890 states: at 1280x800 in Spanish with the wide font, a rail of eight design
  variants and three knobs held 710 px in 686 (ADR-0071 rule 6). The rail's rule now leaves the knob head alone; a
  labelled select in the rail still stacks its text above it. `e2e/rail.test.ts` measures both in Chromium.

On adoption: a product's rail gains about 25 px per knob; nothing to remove.

## [0.09.002] - 2026-10-07

### Fixed

Found by CAOS_Contraste's case C04 on 0.8.x to 0.9.1:

- Known shell defect 31 (#71): a `UPlotChart` log axis whose values reached below about 1e-22 was never drawn. uPlot
  ticks a log axis at 1 to 9 times every power of ten from a precision table that ends there, and below it threw
  "Invalid array length" after stalling the page for several seconds (C04's time-homogeneity p-values of 1e-124 on
  thousands of ratings). Below `LOG_TABLE_FLOOR` (1e-22) a log axis, x or y, now ticks at powers of ten, at most eight
  (`logDecades`), and keeps every label; above it uPlot's own ticks are unchanged. `e2e/charts.test.ts` draws p-values
  down to 1e-124 and 1e-300 on a log y axis and on a log x axis in Chromium with no page error (without the fix every
  case below the floor fails), and reads a year without a group separator in the cursor readout (defect 30). On
  adoption: a product that floored p-values only to keep a chart alive may draw them as they are; a floor for reading
  stays the product's choice.

## [0.09.001] - 2026-10-07

### Fixed

Found by the 0.9.0 gate on CAOS_Fragmenta (2,860 failures in 889 states, most of them the gate's own):

- G10 judged a drawing against every ancestor that hides its overflow, the contained `.app-shell` included, which is as
  high as the viewport: every documentation figure below the fold read "lies outside the drawing" (2,470 of the
  failures). A drawing is now judged against the containers between it and its scroll container; what lies beyond the
  scroll container is a matter of scroll position, not a cut.
- G13 read SVG text against the page behind the drawing, so a label in the page colour on a bar measured 1.06:1. It now
  takes the background from the last filled shape painted under the text's centre, composited over the page.
- The light `good` (`#197c36`) and `magenta` (`#b93785`) cleared 4.5:1 on every surface but not on the `accent-soft`
  highlight (4.46 and 4.44): a selected row of a table carries its tone text there (Fragmenta's comparison table). The
  test of the palette now counts the highlight as a ground.
- G13's message named an SVG text's CSS colour instead of the fill it is painted with, so a light label on a red bar
  was reported as dark text; the measure was right, the message misled.

The gate fixture carries each case in its clean run: a figure after five documentation sections, values in the page
colour on the checkpoint bars, a highlighted row with good-tone text. The 0.9.0 gate fails that fixture (G10 2, G13 8);
0.9.1 passes it.

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
