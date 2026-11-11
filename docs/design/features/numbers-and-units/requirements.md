# Requirements: numbers-and-units

Status: live

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the test or the gate plant that fails when it is violated. A behaviour with no test is not a row here: it is listed as a gap in the delegation report and gets its row when its test exists.

| ID | Requirement | Gate |
|---|---|---|
| SHN-001 | THE `formatNumber` function SHALL write a decimal point in English and a decimal comma with dot grouping in Spanish, a percent with a no-break space before the sign, and an absent or non-finite value as not available (no disponible in Spanish). | `test/base07.test.tsx::S8: numbers follow the interface language, and absent values read as not available` |
| SHN-002 | THE `formatNumber` function SHALL write a magnitude below 1e-4 in scientific notation, never as a row of zeros, and a fixed `decimals` SHALL be the caller's explicit choice. | `test/base07.test.tsx::S8: a magnitude below 1e-4 is written in scientific notation, never as a row of zeros (known defect 15)` |
| SHN-003 | THE `formatNumber` function SHALL show every integer digit of a count and round only the fraction to the significant digits. | `test/base07.test.tsx::S8: a count shows every integer digit; significant digits round only the fraction` |
| SHN-004 | THE `formatNumber` function SHALL write 1e-4 as a fixed number, also as the percent of 1e-6 that floating point leaves under it, and 9.99e-5 in scientific notation. | `test/base09.test.tsx::formatNumber: 1e-4 is fixed, also as the percent of 1e-6 that floating point leaves under it (known shell defect 32)` |
| SHN-005 | WHERE `grouping: false` is given, THE `formatNumber` and `formatTicks` functions SHALL write the integer part without a group separator in both languages, so that a year reads 2021. | `test/base08.test.tsx::defect 30 (#62): a year is written without a group separator when grouping is false` |
| SHN-006 | THE `formatTicks` function SHALL format the ticks of an axis in one notation, scientific for all non-zero ticks when any is below 1e-4, and an absent tick SHALL be an empty label. | `test/base08.test.tsx::BL-013 (defect 19): one tick notation per axis` |
| SHN-007 | THE `NBSP` constant SHALL be the no-break space that joins a unit or a percent sign to its number. | `test/base08.test.tsx::BL-012 (defect 22): a percent and a unit are joined to their number by a no-break space` |
| SHN-008 | THE units of a Readout SHALL follow the language: a word unit translates, a symbol stays, and a Spanish count shows its thousands group. | `test/units-es.test.tsx::a word unit follows the interface language, a symbol stays as written (failure class 5)` |
| SHN-009 | WHEN a Spanish page shows a number with a decimal point, THE gate SHALL fail it under G11. | `test/gate-selftest.mjs::decimal-point` |
| SHN-010 | THE `formatNumber` function SHALL build one `Intl.NumberFormat` per locale and per set of formatter options and reuse it (1,000 calls with one locale and one option set build at most one), and its text SHALL be byte-identical to a formatter built afresh for every branch (fixed decimals with and without grouping, scientific, integer, significant digits with and without grouping, percent, zero, negative, not available) in en and es (known defect 68). | `test/formatNumberCache.test.ts::SHN-010 formatNumber builds one Intl.NumberFormat per locale and options, not one per call (known defect 68)`, `test/formatNumberCache.test.ts::SHN-010 a cached formatter prints exactly what a fresh one prints, for every branch in both languages (known defect 68)` |
