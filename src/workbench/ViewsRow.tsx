import { Children, type ReactNode } from 'react';

export interface ViewsRowProps {
  /** The views side by side: `PlotCard`s, or components that render one. */
  children: ReactNode;
  /** The share of the row each view takes, in order (`[3, 2]`: the first takes three fifths); equal when absent. */
  shares?: number[];
}

/**
 * Views side by side in an instrument panel, each in a column the shell owns, so a filling `PlotCard` keeps its height
 * chain and the row splits by `shares` (CAOS_Fragmenta's design row, three fifths for the response surface). Before
 * 0.9.0 a product wrote this column itself (`.fr-viewcol`). Below 900 px the views stack.
 */
export function ViewsRow({ children, shares }: ViewsRowProps) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div className="caos-views-row" data-views={items.length}>
      {items.map((child, i) => {
        const share = shares?.[i];
        return (
          <div key={i} className="caos-views-col" data-share={share ?? 1} style={share && share > 0 ? { flexGrow: share } : undefined}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
