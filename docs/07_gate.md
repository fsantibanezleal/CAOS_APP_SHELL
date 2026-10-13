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
| G6 drawing | nothing drawn (unless the instrument declares `data-state="unavailable"` on a note a reader can see, with a reason of 12 or more letters or digits in two words, and renders no drawing element, 0.11.0; an unreadable note, a missing reason and a collapsed or invisible chart each fail with their own message); a stage under 30% painted; drawn views under half the viewport on the App route at 1280 px and above; a repeated tick label; a visible `PlotCard fill` whose body (the drawing's stage) is under `--stage-floor` (140 px by default) at 1280 px and above, because its note took the height ("the drawing of <card> keeps <h> px under its note", 0.11.0) |
| G7 settle | a state never declares itself ready; a tab cannot be clicked |
| G8 idle | sustained animation frames or DOM mutations at rest |
| G9 reactivity | a registered control does not change the selection key, or a view keeps an old key; the case shown is not the case asked for; the deep link `?case=` fails. A control whose inputs are all disabled is not moved (known shell defect 20) |
| G10 text in drawings | a label of a chart, an instrument SVG or a document figure is cut at the drawing's edge, lies outside it, or overlaps another label; in the native fonts and in the wide-font pass |
| G11 Spanish numbers | a Spanish page shows a number with a decimal point (`0.25`, `2.7e-08`); a Spanish thousands group (`27.345`) passes; code, formulas, versions and `translate="no"` are not read |
| G12 sticky lists | at the end of a long section, the active vertical sub-tab is out of view |
| G13 contrast | a visible text under WCAG AA (4.5:1; 3:1 for large text) against the colour behind it, at the primary size in both themes, in the first language and, on the documentation routes, in every language; disabled controls are exempt, colour transitions are finished first |
| G14 captures | (always written) `index.html` in the output folder shows every capture, grouped by route, the failure list and the failure captures first |
| ADR-0071, ADR-0017 | the document scrolls at 1280 px and above when the route is the viewport; the rail scrolls; prose off-centre; a bibliography outside the end-of-page references block (`.reference-list`); a references block with content after it (it must be the last block of the page or open tab); a section that declares `refs` while its page or tab shows no references block; an equation without a caption; a section without references or a reason; and the required areas of the documentation pages (below) |

## Options

`--base-path`, `--routes`, `--workbench` (the routes with the case workbench, default `/`; pass `''` for a product whose
App is a `SurfacePage`), `--sizes`, `--themes`, `--langs`, `--case-sample`, `--single-case`, `--idle-ms`, `--settle-ms`,
`--text-floor`, `--instrument-min`, `--stage-fill-min`, `--stage-floor` (the least height in pixels a filling card's drawing keeps, 140), `--wide-font-sizes`, `--no-wide-font`, `--out`. Exit 1 on any
failure, 2 on misuse. The report (`gate-report.json`) lists every failure, the number of states and captures, and the
smallest margins against the G6 floors, and every waiver a documentation page declared (`waivers`).

## The required areas of the documentation pages (`ADR-0017.2`, 0.11.0)

The Introduction, Methodology, Implementation, Experiments and Benchmark pages are measured against the named areas of ADR-0017 section 2.1, not against a count of sections: a page of five arbitrary sections fails. A section declares its area (`<DocSection area="math">`, `data-area`; a method also `kind`, `data-method-kind`); the gate fails a page that lacks an area, an area whose section lacks the content its rule names, an unknown area, a method with no valid kind, fewer topics or learned methods than the page floor, a lede under 35 words, an Introduction with no executive view first, an executive view that is not the view the page opens on, a section of the Introduction outside the two views, and an executive view that holds an equation or a glossary anywhere on the page. The areas, their rules and the floor ids are in [docs/04_views.md](04_views.md), transcribed from the one table, `gate/areas.mjs`.

How it measures: each page once per language, at the primary size and first theme (the topics do not change with the size or the theme), visiting every topic (a walk that visits fewer topics than it found tabs fails); what a reader cannot see never counts (an element that is not rendered, is transparent, is off-screen or clipped, or sits in the 1 by 1 px screen-reader-only pattern; text pushed out of its box, cut by `clip-path` or in a font under 8 px; hidden descendants are not in the rendered text); a tab list inside a section belongs to the section: the walk visits it, its panels are not topics, and the section is judged on what it held across every state (the union of its distinct paragraphs, callouts, equations and figures, the largest of every other count); a paragraph counts once per distinct text (a known limit: two paragraphs that differ by a word are two); words are taken from the displayed language with equations removed. Each failure is reported once per route, area, topic and language, with the measured number and the floor, for example `Methodology, method area, topic "Theory" (EN): 3 dense paragraphs, the floor is 4`.

A page that cannot carry a floor for a stated reason declares `floorWaivers` on `DocPage` (`data-floor-waiver="<floor>: <reason>"`). The gate skips only the floor named, lists every waiver in `gate-report.json` (`waivers`) and in `index.html`, and fails a waiver whose reason has fewer than 12 letters or digits in two words (a reason of punctuation fails), whose floor is not in the table of its page, or that names an area of the executive view (the executive view cannot be waived). Plants: `floor-no-executive`, `floor-exec-second`, `floor-initiative-nostat`, `floor-outcomes-two`, `floor-positioning-three`, `floor-credibility-two`, `floor-exec-equation`, `floor-five-sections`, `floor-glossary-nine`, `floor-pipeline-unordered`, `floor-honesty-none`, `floor-area-unknown`, `floor-method-topics`, `floor-method-dense`, `floor-method-equations`, `floor-method-figure`, `floor-method-honest`, `floor-method-learned`, `floor-lede-short`, `floor-impl-architecture`, `floor-exp-datasets`, `floor-bench-caveat`, `floor-es-area`, `floor-waiver-reason`, `floor-waiver-unknown`, `floor-hidden`, `floor-duplicate`, `floor-waiver-other`, `floor-exec-not-default`, `floor-math-outside`, `floor-glossary-hidden`, `floor-steps-hidden`, `floor-steps-empty`, `floor-stat-hidden-unit`, `floor-waiver-punct`, `floor-exec-transparent-es`, `floor-method-norefs`, `floor-live-button`; the clean fixture walks the waiver path with one valid waiver.

Limits that stay a review duty (ADR-0017 section 2.1): the language of a page. The gate counts the words of the language displayed, so a Spanish page that shows English paragraphs passes; the reviewer reads each page in each language. Likewise whether a positioning item names the problem it answers (the gate requires a sentence of at least 6 words), whether a method cites the right references (the gate requires at least one), and whether a live control drives a real panel (the gate requires one registered with `data-control`).

The self-test's plant `stage-floor` is a filling card with a twenty-line note whose cap (the shell's 35%, 0.11.0) is removed by the plant, as it was before; the gate must fail it under G6 with "the drawing of ... keeps N px under its note (floor 140 px)".

A view whose data is absent says so instead of drawing an empty chart (ADR-0080 decision 3): inside `[data-instrument]` it
renders an element with `data-state="unavailable"` whose text states why. When nothing is drawn in the instrument, G6
accepts that declared state and every other check still runs. The exact rule, decided per measured state (size, theme,
language, case):

- The element counts only when a reader can see it: rendered (not `display: none`, not `visibility: hidden`), opacity
  above 0, and a box of at least 40 by 12 px that lies inside the instrument and inside every box that clips it
  (overflow and `clip-path`); and its glyphs are where the box is: a line of its text lies inside what is not clipped
  and its font is at least 8 px. A note that is transparent, has no box, sits off-screen, uses the 1 by 1 px
  screen-reader-only pattern, is cut off, has its text pushed out of its box by `text-indent`, cut by `clip-path`
  (any shape other than `none` and `inset()` counts as cutting it away) or set in a 1 px font fails G6 with "no reader can see the note"; a `display: none` or `visibility: hidden` note is
  not a declaration at all and fails "nothing is drawn".
- The reason is the text a reader sees (rendered text: a `display: none` descendant is not in it): at least 12 letters
  or digits, in at least two words. Punctuation, whitespace and hidden text do not count; an element without a reason
  fails G6 naming `data-state="unavailable"` and the missing reason.
- No drawing element may be rendered in the instrument: a canvas, image, video, table, svg drawing, `data-plot` or
  `data-drawn` element present, whatever its size or visibility (a collapsed or invisible chart too), cancels the
  exemption and fails G6 "a drawing is present but not visible". A blank chart beside the note still fails "is blank". An
  icon (`lucide`, or inside a button or link, or a small `aria-hidden` svg) and a card that holds the note are not drawings.
- The gate checks that a reason exists and can be read, not that it is a true reason: whether the sentence says why the
  data is absent is the reviewer's responsibility.

Plants: `unavailable-unexplained`, `unavailable-short`, `unavailable-punct`, `unavailable-hidden-text`,
`unavailable-beside-blank`, `unavailable-hidden`, `unavailable-opacity`, `unavailable-zero`, `unavailable-offscreen`,
`unavailable-sronly`, `unavailable-fontsize`, `unavailable-clippath`, `unavailable-textindent`, `unavailable-tinyfont`,
`unavailable-collapsed-chart`, `unavailable-invisible-chart`.

The executive view of the Introduction is checked whole (`docs/06_executive-view.md`; plants `exec-*`): the shell's
`ExecutiveView` on a valid `content/executive.json`, first and default, its writing limits on the rendered text in both
languages, its illustrations inline, loaded, token-coloured, labelled inside their viewBox, and nothing placed beside it.

The content checks of the documentation pages use the same reader-visibility rule: a paragraph, glossary item,
statement, question, row or item counts only when it is rendered, opaque, inside the page and not clipped, and on the
text rendered, with the glyph test above (plants `area-hidden-filler`, `area-hidden-textindent`, `area-hidden-tinyfont`,
`area-hidden-clippath`). A glossary item counts when its term and its definition are visible and hold a letter or a digit,
a step of an ordered list when it is visible and holds a letter or a digit, and a quantified statement when the reader
sees its unit and its source (in the rendered text), not when they are attributes alone.

## The gate proves itself (G15)

`npm run test:gate` builds the fixture product (`test/gate-fixture`), runs the gate on it clean in the full matrix
(every check must pass), and once per planted defect (the check that owns it must fail with its own message): 107
plants, one per check and per distinct trap, then the legitimate pages that the gate once failed
(`legit-engine-subtabs`, `legit-method-view-tabs`), which must pass every check in both languages.
A check without a plant is a check that can agree with a broken app.
