# Validation: workbench and showcase primitives

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
