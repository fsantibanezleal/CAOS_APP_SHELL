/**
 * The one set of widths the stylesheet changes layout at (styles.css header), for code that must agree with it (a
 * drawing that chooses a compact form, a test that sizes a viewport). CSS media queries cannot read custom
 * properties, so the numbers are written in both places and a unit test keeps them equal.
 */
export const BREAKPOINTS = {
  /** A phone: the brand keeps only its mark; the header drops its separators. */
  phone: 480,
  /** The compact header, single-column grids, the vertical sub-tab list as a row. */
  compact: 760,
  /** The workbench stacks its rail over the instrument and the contained document scrolls. */
  stack: 900,
  /** The gate's large screen: the viewport rules of ADR-0071 are measured from here up. */
  large: 1280,
} as const;
