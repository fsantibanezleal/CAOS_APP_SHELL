# Document framing and illustration geometry

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
