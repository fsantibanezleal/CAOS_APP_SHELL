- `ExecutiveView` and `executive.schema.json` 1.0.0: the executive view of every Introduction is now one component fed by the
  product's `content/executive.json` (four sections with Felipe's rubric titles and questions, three inline illustrations,
  numbered source notes). It takes no children; invalid data renders an error state listing each field path. Exports:
  `ExecutiveView`, `validateExecutive`, `FOUR_CS`, `EXECUTIVE_SCHEMA_VERSION`. `FOUR_CS` is empty until Felipe names the 4 C's;
  section 3 shows its declared pending state meanwhile.
- BREAKING for products: the Introduction areas `initiative`, `outcomes`, `positioning` and `credibility` are removed from
  `DOC_AREAS` and from the gate's table; a section declaring one fails as an unknown area. The executive view cannot be waived.
- Gate: a new executive-view check on `/introduction` (the view is the shell's `ExecutiveView`, first and default, its data
  valid in the page, the writing limits on the rendered text in both languages, nothing placed beside it, readable fields,
  one source note per figure, and for each illustration: place, caption, inline, loaded, theme tokens only, no `data-chart`,
  labels inside the viewBox and at least 9 px). Self-test plants added (`exec-*`); the plants of the removed areas are replaced.
- Styles: `.caos-exec*` classes for the view; `reserved-classes.json` regenerated.
- Docs: `docs/06_executive-view.md`; requirement rows SHD-034 to SHD-047.
