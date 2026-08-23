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
