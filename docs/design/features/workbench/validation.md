# Validation: workbench and showcase primitives

## SHW-064 to SHW-066, SHC-104, SHC-105, SHN-010 and SHG-092 to SHG-094: eight open known defects and the G21 tolerance (0.26.0)

Each row has a test that fails on 0.25.0 (the 0.25.0 source with the 0.26.0 tests, run in a copy of tag v0.25.000) for the reason the product found.

| Row | Defect | Test, red on 0.25.0 | Why it was red | 0.26.0 |
|---|---|---|---|---|
| SHW-064 | 63: a filling `PlotCard` header shrank under content taller than the card | `e2e/fill-floor.test.ts` SHW-064 | the header was 24 px (its 1.5rem min-height) at 390 x 480 in en, its two-line title and badges under the body | the header keeps its natural height (at least 40 px), title and badges inside it, the body under them, at 390 and 1280 px in en and es |
| SHC-104 | 64: a moving mark rebuilt the chart every frame | `e2e/moving-mark.test.ts` SHC-104 | ArrowRight while the mark moved left the readout on its hint ("Hover the chart to read the values") | the readout moves on ArrowRight and holds through one second of a mark moving every frame; the canvas is the same; a series change rebuilds |
| SHW-065 | 65: the header band swung through transient layouts | `e2e/scene-callouts.test.ts` SHW-065 | a stage that opened at 0 px reported 363.97 px and then the settled 86.75 px | one settled band per layout, in `onLayout` and on every frame of `--caos-callout-band`, for a stage opening at 0 px, cards out of layout for 400 ms, a story step mounted at 2560 x 1440 and a resize |
| SHW-066 | 67: the value shared the eyebrow's row | `e2e/scene-callouts.test.ts` SHW-066 | at 164 px the value began at 100.5 px while its eyebrow ended at 127.7 px (four lines beside the value) | the value is under the eyebrow; the eyebrow is at least 70% of the card's content box and two lines at most; nothing cut at 164 and 184 px in en and es |
| SHG-092 | 66: a deck whose cards all fit kept `data-deck-mode="carousel"` | `e2e/card-deck.test.ts` (five cards at 1800 px), gate plant `legit-deck-fits-wide` | the mode was `carousel`; the walk at 1600 x 900 threw "document carousel has no traversal control" in en and es, then four floors read as unvisited | the deck is a row; the walk passes |
| SHG-093 | 50: G18 reported a control clipped by its own scrolling panel under the HUD | gate plants `surface-legit-focus-hud-clipped` and `surface-focus-hud-covers` | the legit page (run on 0.25.0 as `legit-focus-hud-clipped`, before its id took the `surface-` prefix that gives the fixture its Console route) failed G18 "the HUD covers the control "Planted control under the HUD"" at 1280 x 800 | the clipped control is not reported; the visible one still is |
| SHN-010 | 68: `formatNumber` built an `Intl.NumberFormat` on every call | `test/formatNumberCache.test.ts` SHN-010 (constructions counted) | 1,000 calls with one locale and one option set built 1,000 formatters | at most one per locale and options; the text of every branch in en and es equals a fresh formatter's |
| SHG-094 | G21 judged 30 fps on a vsync quantisation step | gate plants `showcase-legit-p05-33ms` and `showcase-p05-50ms` | the legit page failed "story fifth-percentile frame rate is 29.9 fps"; the 50 ms plant failed with the old message (rate only) | 33.4 ms passes; 50 ms fails, naming the interval (50.0 ms) and the rate (20.0 fps) |
| SHC-105 | 43: a time axis read UTC days in the reader's time zone | `e2e/time-zone.test.ts` SHC-105 (America/Santiago) | the readout read "Day Jan 2, 2022" (en) and "Day 2 ene 2022" (es) for 2022-01-03 | the readout, the data table and the axis name 3 January; `'local'` still reads the 2nd |

## SHW-063 and SHC-103: the variant select, the chart readout under a scrolled page (0.25.0)

CEFOP_DinHot's full gate of its release build (shell 0.23.2) found two gaps; each has tests that fail on 0.24.0 for the reason the gate gave.

| Row | Defect | Test, red on 0.24.0 | Why it was red |
|---|---|---|---|
| SHW-063 | known defect 61: `VariantBar` had chips only, so 14 methods named by their names scrolled the rail (G5, ADR-0071.6, G18) | `test/variantBarSelect.test.tsx`, `e2e/variant-select.test.ts`, gate plants `variants-long-chips` and `legit-variants-select` | no `layout` prop: no `<select data-control="variant">`, 12 chips outside the rail (spans 31..376 in a rail of 16..248), the rail 1017 px of content in 713 px |
| SHC-103 | known defect 62: the readout moved on the browser's re-dispatch of the pointer position after a scroll | `e2e/chart-scroll-readout.test.ts`, gate plants `legit-chart-in-document` and `legit-chart-pointer-redispatch` (and `chart-readout-scroll-move`, which keeps the walk's check honest) | the readout followed a scroll-synthesised pointer; on the shell's own fixture the walk reported "document text changed during traversal (P: Step 1 . Alpha 3)" on three tabs of /experiments |

The gate's walk of the fixture showed a second event than the one in the issue: when the walk scrolls the plot away from the resting pointer the browser sends a `mouseleave` at the pointer's own coordinates, and uPlot clears the readout on it. A chart therefore holds that leave and applies it at the next real move of the pointer.

## SHW-059 to SHW-062: callout state, measured header layout, phone stepper (0.24.0)

An ADR-0082 review of CAOS_ChancaDEM on shell 0.23.2 found four defects in the shared showcase primitives; each is
fixed here, with a test that fails on 0.23.2 for the reason the review gave.

| Row | Defect | Test, red on 0.23.2 | Why it was red |
|---|---|---|---|
| SHW-059 | known defect 58: a callout's state only as its border colour (review M11) | `test/showcase.test.tsx`, `test/calloutsEs.test.tsx`, `e2e/scene-callouts.test.ts` (SHW-059) | no `data-callout-state-label` in the card |
| SHW-060 | known defect 60: header cards in declaration order on nominal heights (review M1, M3) | `test/showcase.test.tsx` (SHW-060) | boxes in declaration order; the grown card laid out at 68 px |
| SHW-061 | known defect 60 in the browser: wrapped sources, anchors in reverse x | `e2e/scene-callouts.test.ts` (SHW-061) | at 390 en the nip and css cards overlapped by 79.5 x 19.3 px; no `--caos-callout-band` |
| SHW-062 | review m4: the phone stepper cut its verbs | `e2e/story-stepper.test.ts` (SHW-062) | at 320 en the verb "Measure" was cut by 27 px |
| SHW-062 | a step wider than its row (main CI on Linux, first 0.24.0 candidate) | `e2e/story-stepper.test.ts` (SHW-062, the long-verb case) | a verb longer than the row made a 561 px step in a 280 px row; End could not show it whole |

Measured on the shell's showcase fixture callouts (`ShowcaseInstrument`) in a StoryFrame stage, eyebrow and value
overflow (`scrollWidth - clientWidth`, px) per card, before and after:

| Context | 0.23.2 | 0.24.0 |
|---|---|---|
| 390 en | 0, 0, 0 | 0, 0, 0 |
| 390 es | eyebrow 58 (feed), 34 (power) | 0, 0, 0 (the eyebrow wraps; the cards grow to 68 px) |
| 1280 en | 0, 0, 0 | 0, 0, 0 |
| 1280 es | eyebrow 43 (feed), 19 (power) | 0, 0, 0 (cards 71 px) |

The Spanish eyebrows were already cut on 0.23.2, before any state label existed; the label sits on a row of its own,
so it narrows neither the eyebrow nor the value. The eyebrow now wraps, which the measured layout makes safe.

The layout keeps the anchor x order unless that order makes two leaders cross; then the slot order with the fewest
crossings is taken, the anchor order winning every tie. At 390 with three cards in two rows the anchor order alone
crosses two leaders (the third card sits centred under the first row while its anchor is at the right).
