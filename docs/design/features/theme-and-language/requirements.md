# Requirements: theme-and-language

Status: live

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the test or the gate plant that fails when it is violated. A behaviour with no test is not a row here: it is listed as a gap in the delegation report and gets its row when its test exists.

| ID | Requirement | Gate |
|---|---|---|
| SHT-001 | THE token list `SHELL_TOKENS` SHALL name only custom properties the stylesheet defines, and the reserved-class list SHALL reserve the shell's classes. | `test/base07.test.tsx::S11 and S17: the token list and the reserved-class list match the stylesheets` |
| SHT-002 | THE layout, type, space, radius, icon and z-order values SHALL be tokens the token list names. | `test/base08.test.tsx::BL-001: the layout, type, space, radius, icon and z-order values are tokens the token list names` |
| SHT-003 | EVERY text colour of both themes SHALL read at WCAG AA (4.5:1) on the page, surface, raised surface and accent-soft grounds, and the accent foreground SHALL read on the accent. | `test/base08.test.tsx::G13 at the source: every text colour of both themes reads at WCAG AA on every surface` |
| SHT-004 | THE stylesheet SHALL define a class by one plain rule, never twice with the second overriding the first. | `test/base08.test.tsx::BL-002: a class has one plain rule (0.7 defined .tablist twice, the second overriding the first)` |
| SHT-005 | THE reserved-class list SHALL separate components from modifiers and reserve no stray word. | `test/base08.test.tsx::BL-016: the reserved list separates components from modifiers and reserves no stray word` |
| SHT-006 | THE stylesheet SHALL size lucide icons by their context, never by the product, and the public entry SHALL bundle against the installed Lucide ESM exports. | `test/base08.test.tsx::BL-009: lucide icons are sized by their context, never by the product`, `test/lucideCompatibility.test.ts::the public shell entry bundles against the installed current Lucide ESM exports` |
| SHT-007 | THE `THEME_BOOT_SCRIPT` SHALL be a self-contained expression that sets the theme and the language before the first frame. | `test/workbench.test.tsx::THEME_BOOT_SCRIPT is a self-contained expression that sets the theme and the language` |
| SHT-008 | WHEN the interface language changes, THE shell SHALL translate its strings through the language store that the page reads. | `e2e/docReferences.test.ts::switching the language keeps the order and translates the heading` |
| SHT-009 | WHEN the theme asked for is not the one the document shows, or the language asked for is not the one of `<html lang>`, THE gate SHALL fail under G2. | `test/gate-selftest.mjs::mode-theme`, `test/gate-selftest.mjs::mode-lang` |
| SHT-010 | WHEN a visible text is under WCAG AA against the colour behind it, THE gate SHALL fail under G13. | `test/gate-selftest.mjs::low-contrast` |
