# 07 The gate (`caos-shell-gate`)

The gate measures a built product in a real browser and fails on what a reader would meet. It never judges content;
it measures, on the element a reader sees, the traps recorded in the failure history (CAOS_MANAGE
`wip/template-archetype/recurring-failures-2026-10-04.md`). It needs `playwright` in the consuming project.

```bash
npx caos-shell-gate --serve frontend/dist --expect-brand "Contraste"        # the build, served as GitHub Pages serves it
npx caos-shell-gate --url https://contraste.fasl-work.com --expect-brand "Contraste"   # the deployed origin
```

## The walk

Every route (read from the header's route row unless `--routes` is given), every tab and sub-tab, every case (all of
them in the primary mode, the first and the last elsewhere, or `--case-sample`), at five sizes (390x844, 768x1024,
1280x800, 1600x900, 2560x1440), both themes and both languages, each set through the shell's own storage keys and read
back. A state is measured once it declares itself ready (`data-state`, `data-stale`, `data-drawn`), never after a
fixed wait or on network idle. Then the **wide-font pass**: every route, tab and sampled case again, in Spanish, at 390
and 1280 px (`--wide-font-sizes`), with `--font-sans` replaced by `Verdana, "DejaVu Sans", sans-serif` before the first
frame, so a drawing that measures its text measures it in the wider font (a Linux reader's DejaVu Sans is what failed
CAOS_Fragmenta's deploy gate).

## The checks

| Check | Fails on |
|---|---|
| G1 subject | the brand is not `--expect-brand`: nothing else is measured |
| G2 mode | the theme or language asked for is not the one the document shows |
| G3 errors | any `console.error`, page error, or GET answered 400 or above |
| G4 deep links | a route loaded directly (and with a trailing slash) does not answer 200 with that route; an artifact answers HTML; a missing asset does not answer 404; a document holds less text than the floor |
| G5 reach | horizontal overflow; an element outside the viewport or outside the rail; a container that cuts its content; a row that wraps or cuts its tabs; truncated text without its full text in a title; a control a pointer cannot reach (the probe scrolls as a reader does, clear of a header stuck at the top) |
| G6 drawing | nothing drawn; a stage under 30% painted; drawn views under half the viewport on the App route at 1280 px and above; a repeated tick label |
| G7 settle | a state never declares itself ready; a tab cannot be clicked |
| G8 idle | sustained animation frames or DOM mutations at rest |
| G9 reactivity | a registered control does not change the selection key, or a view keeps an old key; the case shown is not the case asked for; the deep link `?case=` fails. A control whose inputs are all disabled is not moved (known shell defect 20) |
| G10 text in drawings | a label of a chart, an instrument SVG or a document figure is cut at the drawing's edge, lies outside it, or overlaps another label; in the native fonts and in the wide-font pass |
| G11 Spanish numbers | a Spanish page shows a number with a decimal point |
| G12 sticky lists | at the end of a long section, the active vertical sub-tab is out of view |
| G13 contrast | a visible text under WCAG AA (4.5:1; 3:1 for large text) against the colour behind it, at the primary size in both themes; disabled controls are exempt, colour transitions are finished first |
| G14 captures | (always written) `index.html` in the output folder shows every capture, grouped by route, the failure list and the failure captures first |
| ADR-0071, ADR-0017 | the document scrolls at 1280 px and above when the route is the viewport; the rail scrolls; prose off-centre; a bibliography dump; an equation without a caption; a section without references or a reason |

## Options

`--base-path`, `--routes`, `--workbench` (the routes with the case workbench, default `/`; pass `''` for a product whose
App is a `SurfacePage`), `--sizes`, `--themes`, `--langs`, `--case-sample`, `--single-case`, `--idle-ms`, `--settle-ms`,
`--text-floor`, `--instrument-min`, `--stage-fill-min`, `--wide-font-sizes`, `--no-wide-font`, `--out`. Exit 1 on any
failure, 2 on misuse. The report (`gate-report.json`) lists every failure, the number of states and captures, and the
smallest margins against the G6 floors.

## The gate proves itself (G15)

`npm run test:gate` builds the fixture product (`test/gate-fixture`), runs the gate on it clean in the full matrix
(every check must pass), and once per planted defect (the check that owns it must fail with its own message): 34
plants, one per check and per distinct trap. A check without a plant is a check that can agree with a broken app.
