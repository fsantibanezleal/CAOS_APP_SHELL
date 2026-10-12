- The documentation pages state their required areas (ADR-0017 section 2.1) and the gate measures them: `caos-shell-gate` fails (`ADR-0017.2`) an Introduction, Methodology, Implementation,
  Experiments or Benchmark page that lacks a named area or whose area lacks the content it requires, in either language. The Introduction opens with an executive view and a technical view.
  The areas, their rules and the floor ids are in `docs/04_views.md`, from one table (`gate/areas.mjs`).
- `DocSection` takes `area` (and `kind` for a method), `DocPage` takes `floorWaivers` (a waiver needs a reason of 12 characters or more and is listed in the gate report), `Callout` renders `data-callout`,
  and the new `Glossary`, `Stat` and `Question` components render `data-glossary`, `data-stat` and `data-qa`.
- The content checks of the documentation pages count only what a reader can see: rendered, opaque, inside the page, not clipped, on the rendered text (a paragraph, statement, glossary item or answer hidden by transparency, off-screen positioning or a clipping box is not counted).
- The gate self-test grows from 41 to 79 plants, one per floor and per trap (28 for the areas, 10 for the reader-visibility rules); the fixture product carries every area.
