# Validation: document readability and drawing geometry

## Reviewed document traversal design (issue 170)

Latest DG2 review design, before code: use one known-safe geometry predicate for the painted pseudo
itself and every ancestor, rather than testing only the ancestor styles. Trust only plain positioned
rectangles with identity transform/translate/rotate/scale, no motion path, zoom, filter or other
unmapped paint expansion/coordinate mapping. Unknown geometry takes the existing fail-closed path;
do not attempt a partial transform engine. Test the exact own-translate white-page plant against
its transparent-paint visible companion and a plain, measurable nonoverlapping painted positive.
Retain independent transform-channel, ancestor, clipping, punctuation, source/control and focus cases.

DG2 containing-block follow-up, reviewed before implementation: positioned pseudo paint must not
combine local dimensions with a transformed viewport origin. Until a complete coordinate mapping
is established, paint with any transformed or alternative fixed-containing-block ancestor is unknown
and fails closed. Check transform/filter/perspective/contain/will-change and independent transform
properties throughout the ancestry; do not assume a fixed pseudo is viewport-relative. Test the exact
scale-two white-page counterexample, fixed containing blocks and the visible pointer-transparent
positive separately. Retain the full clipping, focus, glyph, source and native-control cases.

The real-runner positive exposed a separate hit-sampling error on narrow middle-dot separators:
the final fractional coordinate can round onto the neighbouring element although the complete
glyph is visible. Retain full-fragment clipping/font coverage, and choose hit samples inside fully
contained CSS pixel cells so browser hit-test rounding cannot leave the measured fragment. Do not
admit ancestor hits or skip punctuation. Verify complete visible rows and independently covered
punctuation, then rerun the unchanged real executive/technical positive and negative plants.

Independent-review repair design (SHG-084/085/086), reviewed before code changes: extend clipping
through the document element and all outer ancestors, without changing clip-path interpretation
or exposing hidden overflow. Do not accept an arbitrary ancestor as a clear text hit; ordinary
pointer-transparent prose requires a genuine fall-through path and exclusion of ancestor-painted
covering pseudo-elements. Restore default BODY/document focus explicitly and verify activeElement,
as well as existing scroll/card/tab state. Each review finding gets independent positive/negative
production-measurement browser cases; the closed native-control/identity cases remain required.

SHG-083 follow-up review: the full clean fixture exposed a textless native range input missing from
the witnessed-element collection. Register actual control-box evidence during the same scroll
samples, preserving viewport, clipping, visibility and pointer checks. The active DOM identity
counts once. A control's existence or metadata alone is insufficient; test below-fold range input
and hidden/clipped/covered negatives before updating the collector.

SHG-079/080/081/082 were reviewed before implementation against the real OreFlow failure and the
existing readability helpers. Keep the metric schema and all floors. For each active document state,
collect text-node word-fragment coverage through real overlapping scroll positions; a node counts
only once all its rendered fragments were witnessed inside the viewport and existing clip bounds,
at the existing font floor, with unobstructed hit tests. Never scroll overflow-hidden containers.
Recompute the existing metrics once against the collected node evidence, rather than summing viewport
counts. Inactive panes and unvisited card faces contribute nothing. Operate real flip/deck controls,
restore state in finally, and fail explicitly on action/time budgets, changing active state or failed
restoration. Plain docPage remains a current-position diagnostic; the runner uses complete traversal.

The positive oracle is a real long document surface with executive/technical content and source links.
Negative oracles retain the same text but hide, clip, shrink, cover or deactivate it. Additional checks
cover a paragraph taller than a viewport, nested scrollers, duplicate observations and restoration.
The unmodified product candidate is the integration oracle; a focused pass is not a base release.

### Scoped validation of issue 170

`npm test` passes 302 tests. `node --import tsx --test e2e/surface.test.ts` covers the scoped cases,
including independent review subcases. These cover long/nested scrolling, complete paragraph
fragments, stable glossary/list/row/stat counts, hidden/clipped/tiny/indented/inactive/covered text,
source-title readability and actionability, real flip/deck controls and failed-budget restoration.

The real-runner document fixture passes in EN/ES, while hidden, tiny-font, permanently clipped and
unreadable-source plants fail. The final source was also checked with the positive fixture and
source plant selected explicitly:
`node --test --test-name-pattern 'document traversal: (complete|source)' test/gate-selftest.mjs`.
The actual consumer Introduction, using its unchanged compiled shared UI and the patched runner,
passes 110 measured states at desktop/phone sizes, EN/ES and both themes, including wide fonts.
Its previous 46 content failures are closed without changing content, components, styles or floors.
The SDD checker passes 398 live requirements with real gates. Full base browser/selftest matrices,
exact candidate CI, publication and downstream installed-package adoption remain release-owner work.

The live-control follow-up fixes the missing witness for textless native inputs. A real below-fold
range input is observed through the existing clipping/visibility checks and successful pointer hits;
registered wrappers require their actual input/control target too. Repeated positions count its
identity once. The scoped runner check
`node --test --test-name-pattern 'document traversal: below-fold benchmark' test/gate-selftest.mjs`
passes the real Benchmark in EN/ES and rejects a permanently hidden control against the unchanged
live-control floor. Browser negatives also retain clipping, inactive-pane, overlay and pointer-disabled
exclusions. This corrects the two Benchmark failures found during the interrupted full G15 run;
the complete base suite must still be rerun.

Independent-review repairs add three distinct contracts. Document and outer ancestor clip-paths
and zero-height hidden overflow are rejected by the raw clipping measurement itself, independently
of obstruction checks; pointer-transparent prose prevents the tests from masking that cause.
Opaque positioned ancestor pseudo-elements are excluded, including covers that are pointer
transparent, while ordinary visible pointer-transparent prose remains readable. Default BODY focus
and an explicitly focused tab restore exactly; a forced inability to restore focus throws a clear
failure. Tab/card/deck/scroll postconditions are verified too. The actual settled consumer was checked
in fresh BODY/tab-focus contexts with repeated identical metrics and complete state snapshots.
Prior consumer gate measurements do not replace independent review of these later repairs.

The subsequent DG2 counterexample uses a scale-two containing ancestor and a pointer-transparent
white pseudo-cover over two complete paragraphs. Both absolute and fixed variants reject the real
dense floor. Fixed paint under filter, perspective, containment and will-change also fails closed;
the scaled pointer-transparent prose positive has no paint and remains readable. The real-runner
positive's narrow middle-dot separator is retained as glyph evidence, with hit samples chosen
inside contained pixel cells; independently covered punctuation remains unreadable. No punctuation
is skipped and no whole row receives credit from partial text. Final scoped receipts belong to the
candidate validation record; complete matrices and independent clearance remain separate.

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

## SHG-087: artifact reads interrupted by navigation

The consumer trial on OreFlow008 observes a valid391107-byte model request before the gate closes
its page context. Reading that response can fail because of navigation; this is not proof that the
resource is HTML or empty. The reader keeps the original full URL and request headers. Only a
failed body read or304 response admits one bounded independentGET, stripping conditional/range
headers so the complete document is requested. Successful empty/malformed/HTML bodies fail without
retry. A failed or non-2xx retry fails. CompleteJSON parse is required, not just its leading brace.

RealHTTP/browser regression closes the first context after response headers, confirms a complete
retry at exactly the original URL and retained header, and retains missing/invalid/HTML/empty/
conditional cases as independent negative probes. The report records every transport retry.
No readiness marker, idle-rate threshold, traversal floor or public product result is relaxed.

The canceled-response regression additionally uses an actual browser session cookie. Complete
on-wire headers are captured through Request.allHeaders before context teardown; the partial
header map is insufficient. Cookie- and bearer-protected controls must both pass without
recording credential values. Unavailable authorization metadata fails explicitly.
