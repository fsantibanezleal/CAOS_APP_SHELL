# 06 Icons and numbers

## Icons

The base's icon set is [lucide](https://lucide.dev) (`lucide-react`, a peer dependency; 70 of 89 frontends already use
it). lucide renders `svg.lucide`, and the stylesheet sizes it by the place it is in, so a product passes no `size`:

| Where | Size |
|---|---|
| header buttons (`.icon-btn`), the brand mark | `--icon-lg` (18px) |
| inside text-bearing controls: tabs, sub-tabs, chips, buttons, route links, badges, callout titles, plot heads, case chips, rail sections | `1.15em`, the size of the text beside it |
| the console sidebar (`WorkbenchShell`) | `--icon-lg` |

An icon beside text inherits its colour (`currentColor`). The header's icons are the shell's: source (`CodeXml`),
personal site (`Globe`), portfolio (`Briefcase`), architecture (`Info`), language and theme. The product's mark is
`ShellConfig.product.mark` (a lucide icon element); without one the shell shows `Boxes`. An icon that carries meaning
alone has an accessible name; a decorative one is `aria-hidden`.

## Numbers

Every number on screen goes through `formatNumber(value, lang, options)` (or `useFormat()`), never `toFixed` or
`toLocaleString()` without a locale (the template's guard fails both):

- a decimal point in English and a decimal comma in Spanish (`es-CL`: `1.234,57`); the gate fails a Spanish page that
  shows a decimal point (G11), outside code, formulas, versions and anything marked `translate="no"`;
- significant digits by default (`digits: 4`), every integer digit of a count, fixed `decimals` when the caller says so;
- scientific notation below 1e-4 (`6.53E-13`), so a p-value never renders as two hundred zeros (known shell defect 15);
  1e-4 itself is fixed, also as a percent of 1e-6, which floating point leaves a hair under it (`0.0001 %`, known
  shell defect 32);
- `percent: true` writes `12,3 %` with a **no-break space** before the sign, so a wrapped label never leaves `%` alone
  on a line (known shell defect 22); `Knob`, `Readout`, `Gauge` and the chart readout join units the same way (`NBSP`);
- `null`, `undefined` and non-finite values read "not available" / "no disponible", never `NaN`;
- `formatTicks(values, lang, options)` formats an axis's labels together, in one notation (known shell defect 19).
- `grouping: false` writes the integer part without a group separator in both languages: a calendar year on an axis
  (`x.format`), in a readout or in a table reads 2021, never 2,021 or 2.021 (known shell defect 30).

A unit is required on every readout value (`unit`, or `unitless` stated); a unit that is a word is bilingual, a
symbol is written as is.
