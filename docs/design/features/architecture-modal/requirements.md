# Requirements: architecture-modal

Status: live

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the test or the gate plant that fails when it is violated. A behaviour with no test is not a row here: it is listed as a gap in the delegation report and gets its row when its test exists.

| ID | Requirement | Gate |
|---|---|---|
| SHA-001 | THE ArchitectureModal SHALL wrap each diagram in the element the language stylesheet keys on (`data-arch-lang`). | `test/architectureModal.test.tsx::the diagram is wrapped in the element the language stylesheet keys on` |
| SHA-002 | THE ArchitectureModal SHALL recognise an inline SVG string and not treat it as a path to fetch. | `test/architectureModal.test.tsx::an inline svg string is recognised and not treated as a fetch path` |
| SHA-003 | THE `validateArchitectureConfig` function SHALL accept five or more tabs with inline SVG and report a configuration with fewer than five tabs, an SVG that is not inline, a token the shell does not define, hex colours, or a missing label or body in one language. | `test/adrRuntimeChecks.test.tsx::the architecture configuration is validated: tab count, inline SVG, tokens, hex colours, languages (ADR-0058, S11)` |
| SHA-004 | WHEN the architecture modal is open, THE modal SHALL contain keyboard focus, move it between tabs with the arrow keys and Home, show the diagram of the active language readable and fitted, scroll when not fitted, and WHEN closed return focus to its opener, at each width, language and theme of the test. | `e2e/architecture.test.ts::architecture modal contains focus and offers readable diagrams at ${width}px ${es?'ES':'EN'} ${light?'light':'dark'}` |
