# Requirements: controls-and-readouts

Status: live

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the test or the gate plant that fails when it is violated. A behaviour with no test is not a row here: it is listed as a gap in the delegation report and gets its row when its test exists.

| ID | Requirement | Gate |
|---|---|---|
| SHK-001 | THE Knob and the ChipGroup SHALL register as controls (`data-control`) so that the gate can move them, and a Knob SHALL show its value. | `test/base07.test.tsx::S10: controls are registered for the reactivity gate` |
| SHK-002 | THE Readout SHALL format its numbers in the interface language, show an absent value as not available, and tone a value with its tone class. | `test/workbench.test.tsx::readouts format numbers in the interface language and show absent values honestly (S7, S8)` |
| SHK-003 | THE Gauge SHALL expose a meter role with its current value, and THE Verdict SHALL expose its tone and its message for the current code. | `test/workbench.test.tsx::readouts format numbers in the interface language and show absent values honestly (S7, S8)` |
| SHK-004 | THE PlotCard SHALL declare its lane and its provenance (`data-lane`, `data-provenance`). | `test/workbench.test.tsx::readouts format numbers in the interface language and show absent values honestly (S7, S8)` |
| SHK-005 | A percent and a unit SHALL be joined to their number by a no-break space in the Knob and in the Readout. | `test/base08.test.tsx::BL-012 (defect 22): a percent and a unit are joined to their number by a no-break space` |
| SHK-006 | WHILE a Knob sits in a card that clips, THE Knob SHALL keep its range input inside the card at 390 x 844. | `e2e/knob.test.ts::a knob inside a clipping card keeps its range input inside the card at 390 x 844` |
| SHK-007 | THE Knob in the rail SHALL keep its value on the label row, a long label SHALL wrap beside the value, and a labelled select SHALL stay stacked. | `e2e/rail.test.ts::a knob in the rail keeps its value on the label row; a long label wraps beside it; a labelled select stays stacked` |
| SHK-008 | THE active chip SHALL keep its contrast and its label colour under the pointer, an inactive chip SHALL answer the pointer, and the chosen case's chip SHALL keep its accent, in both themes. | `e2e/chips.test.ts::the active chip keeps its contrast under the pointer (${theme})` |
| SHK-009 | WHILE a PlotCard fills its panel, THE note SHALL take at most 35 percent of the card and scroll beyond it, and the body SHALL keep the rest. | `e2e/plot-note.test.ts::a twenty-line note in a 600 px filling card takes at most 35% of the card and scrolls` |
| SHK-010 | BELOW 900 px, THE note of a filling PlotCard SHALL NOT be capped, because the document scrolls. | `e2e/plot-note.test.ts::below 900 px the note is not capped (the document scrolls)` |
| SHK-011 | THE unit of a readout value SHALL follow the interface language when it is a word and stay as written when it is a symbol. | `test/units-es.test.tsx::a word unit follows the interface language, a symbol stays as written (failure class 5)` |
| SHK-012 | WHEN a visible PlotCard fill keeps its drawing under the stage floor at 1280 px and above, THE gate SHALL fail it. | `test/gate-selftest.mjs::stage-floor` |
