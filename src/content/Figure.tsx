import type { ReactNode } from 'react';

/** Wraps an inline SVG schematic (or any figure) with a centered caption. Theme-aware figures use
 * the `dg-*` / `fig-svg` classes from styles.css and CSS palette variables (follow light/dark). */
export function Figure({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="figure">
      {children}
      {caption && <figcaption className="figure-caption">{caption}</figcaption>}
    </figure>
  );
}
