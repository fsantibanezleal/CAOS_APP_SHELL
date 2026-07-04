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
