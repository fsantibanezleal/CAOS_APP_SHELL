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

- **`ShellConfig.fixedRoutes` and `ShellConfig.fixed`** — the per-route opt-in to the contained
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

- **`CaseSelector layout="select"`** — the compact one-of-N picker ADR-0071 rule 7 asks for:
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
- **`usePausedViz` + `createVizLoop`** — a no-compute-bomb animation loop for canvases/3D views:
  default paused, run-once-then-stop (looping opt-in), optional `durationMs` hard cap, and auto-halt
  on a hidden tab (visibilitychange). The state machine (`createVizLoop`) is framework-free with
  injected `requestAnimationFrame`/`cancelAnimationFrame`, unit-tested with a fake clock (10 tests).
  `usePausedViz` is the React wrapper. Animated views should mount through it instead of calling rAF
  directly. Enforces the portfolio "no autoplay, no compute bomb" rule at the shell level.
- **`CaseSelector` v2** — shared source + case picker. Chips show `ID · name`; cases render in
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
