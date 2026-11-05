# Document framing and illustration geometry

## Browser-suite resource admission

`npm run test:browser` runs the complete `e2e/**/*.test.ts` inventory with at most two files concurrently.
Each file launches a real browser. Node's host-dependent default admitted up to 31 files on a 32-thread
device; the full 356-test run recorded three target crashes, a navigation timeout and a selected-text
height assertion while the owned process tree reached 14.65 GB RSS. A fixed worker bound avoids treating
CPU count as a browser-memory budget. It changes neither coverage, assertions nor timeouts. The failed
run remains evidence; every unresolved assertion still needs investigation and the complete successor
browser and gate suites must pass before release. This scheduling control does not qualify performance.

## Readability across scrollable documents

The gate measures each active document tab across real scroll positions, then evaluates one
complete metric for that state. Overlapping observations share text-node identities: paragraphs,
equations, glossary entries, rows, statements and executive fields count once. Long paragraphs
require every rendered word fragment to be witnessed; a visible first line is insufficient.
Glyph ink bounds avoid mistaking a font's invisible leading for clipped heading text. The existing
font minimum, document bounds, clipping, opacity and visibility checks still apply. Pointer hit
tests reject covered text and source titles; a source URL without a readable title does not pass.

Only user-scrollable ancestors and nested containers are traversed. Overflow-hidden content and
inactive panes are never exposed for measurement. Flip cards and carousel windows are visited
through their controls, with transitions settled; no attribute manipulation admits hidden faces.
The gate restores card/deck state, scroll positions and focus before continuing other checks.
Traversal has sample/time limits and fails explicitly if it cannot finish or restore state.

Registered controls without text, such as native range inputs, contribute only after their actual
control box has been witnessed inside the viewport and clipping bounds with successful pointer
hits. A readable label or `data-control` attribute alone is insufficient. Scroll observations share
the same control identity; permanently hidden or covered controls remain excluded (SHG-083).

Clipping includes the document boundary and every outer clipping ancestor, not only descendants.
An ancestor hit is not proof of readable text: ordinary pointer-transparent fall-through is
distinguished from positioned opaque pseudo-element paint. Unmeasurable covering paint fails
closed. Restoration checks the actual active element, including default BODY/document focus,
and reports an explicit failure if focus, tabs, cards, decks or scroll positions cannot be restored.

Tracked in [issue 170](https://github.com/fsantibanezleal/CAOS_APP_SHELL/issues/170).
SHG-079 through SHG-086 cover the contract. Browser coverage lives in `e2e/surface.test.ts`;
runner-level long-document and hidden/tiny/clipped/source plants live in `test/gate-selftest.mjs`.
Use `node --test --test-name-pattern 'document traversal' test/gate-selftest.mjs` for that focused
fixture group. Full gate self-validation remains required before a shell release.

## Document surfaces

`SurfacePage` accepts an optional boolean `document`. The false/unset default retains generic
surface markup, typography and reading measure. Opting in marks its one wide root `data-doc-page`
and `caos-surface-doc`, allows the heading and lede to take the whole document column, and preserves
the body, tabs, deep links, reference scope, error boundary and shared Focus behavior. The root owns
padding. No outer `.page-body`, product shell-class override or duplicated Focus wrapper is needed.

The scoped browser fixture uses the shell stylesheet without product CSS at 1280x800 and 390x844,
both languages and themes. It measures heading/lede/body widths against the padded root's content
column and checks Escape/button return to the chosen view and sub-view. It also measures the
generic surface's retained lede cap. A geometry pass does not judge prose or scientific correctness.

## SVG label coordinates

The executive illustration gate compares label bounds with the outer illustration's viewBox in
root SVG user coordinates. `getBBox()` alone is local to the text element and does not include
ancestor translations, rotations, scales or nested SVG viewport mappings. The in-page measurement
maps all four corners through:

```js
root.getScreenCTM().inverse().multiply(text.getScreenCTM())
```

The inverse removes the root's screen/CSS/viewport mapping before the text's full transform is
applied. The axis-aligned envelope of those four root-space corners is compared with the original
viewBox, using the existing one-unit tolerance. All four corners matter for rotated or skewed text.
Root CSS transforms must not be mistaken for movement inside the viewBox.

Missing, singular or nonfinite matrices and DOM geometry exceptions return an explicit unmeasurable
bound. A visible label with that result is listed in the existing `outside` metric with “bounds
unavailable”, so it fails the existing executive bounds check. No local-space fallback certifies
unknown transformed geometry. Existing missing/loading illustration errors remain unchanged.

The visible-label filter and strict 9 px rendered-font threshold are unchanged. Rendered font size
is the computed text font size multiplied by the minimum singular value of its complete 2D screen
matrix. This accounts for group/text/viewport scale and nonuniform compression or skew without
mistaking a rotated root's axis-aligned width for font enlargement. Normalize the matrix before
computing its largest singular value, then obtain the smallest through the determinant ratio;
missing, singular, nonfinite or unsupported mappings explicitly fail in the existing small metric.
No root-width-only or unscaled-font fallback can certify readable text. Clipping an outlying
label is not a geometry waiver. Correct coordinate measurement does not excuse a small label, a
blank diagram, literal colors, inadequate coverage or unreadable process content. It makes a real
inside label pass and a real outside label fail in the same coordinate system.

## Scoped verification

```sh
node --import tsx --test test/surfacePage.test.tsx test/surfaceFocus.test.tsx test/executive.test.ts test/executiveGate.test.ts
node --import tsx --test e2e/surface.test.ts e2e/surface-focus.test.ts e2e/doc-layout.test.ts e2e/executive-view.test.ts
python scripts/check_sdd.py .
```

Requirements and cases: [documents](design/features/documents/requirements.md),
[document validation](design/features/documents/validation.md),
[gate](design/features/gate/requirements.md), [geometry validation](design/features/gate/validation.md).
The release owner separately runs the full unit/browser/gate suites before publishing and adoption.
