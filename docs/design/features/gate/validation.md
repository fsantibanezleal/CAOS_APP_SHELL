# Validation: root SVG label coordinates

SHG-076 uses the same helper as the real in-page executive measurement. Transform the four local
getBBox corners by root.getScreenCTM().inverse().multiply(text.getScreenCTM()), then compare their
axis-aligned bounds to the root viewBox. Browser tests cover translated inside/outside labels,
rotation, nonuniform scale, nested SVG viewports and root CSS transforms. Visible geometry remains
measurable even outside the viewBox; clipping is not permission to ignore it.

SHG-077 makes missing/singular/nonfinite matrices and DOM exceptions explicit failures for visible
labels. No local-coordinate fallback can certify an unmeasured transform. Hidden-label filtering,
the existing illustration metric shape and the strict 9 px rendered-font floor remain unchanged.
The product's real process drawings remain product-owned; this fix is neither a redraw nor a waiver.

SHG-078 measures rendered font size with the smallest singular value of the text's complete screen
matrix, including nested/group/text transforms and the SVG viewport. The 9 px threshold is unchanged.
Browser red cases use 18 px text scaled to 4.5 px, a just-below-floor scale, and missing matrices.
Green cases include exact-floor 9 px, above-floor text, locally small text enlarged above the floor,
root CSS rotation, group rotation, nonuniform compression and skew. A conservative least-stretch
measure prevents compressed glyphs passing because their other axis is large. Missing, singular,
nonfinite or throwing font mappings enter the existing small array as font scale unavailable.
