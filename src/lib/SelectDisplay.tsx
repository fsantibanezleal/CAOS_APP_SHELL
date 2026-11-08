import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * The shell's select display (shell 0.17.0 for the case select, 0.25.0 for `VariantBar`): a native select on top of a display, transparent, so the
 * keyboard, the screen reader and the native list are the select's own and the selected name is shown whole.
 *
 * `names` are the texts of the visible options and `selectedName` the one the select holds; `children` is the native `<select>` (its class is
 * `select cs-select cs-select-native`). One component for every shell select of this kind, so a rule of the display (ADR-0071 rule 7, the
 * gate's G5 reading of `.cs-select-display`) holds for all of them.
 */
export function SelectDisplay({ names, selectedName, children }: { names: string[]; selectedName: string; children: ReactNode }) {
  // The select shows the selected name whole, at any length, in a display with the native select on top of it, transparent (shell 0.17.0, the
  // consumer trial: real case names are 200 to 400 px and a rail leaves a select 181 px of room). There is no line cap: the name wraps to the lines
  // it needs (a token wider than the room breaks inside), and the display is as tall as the longest name of the visible list needs at the current
  // width, measured in the DOM (the display's own font, padding and content width), so the rail head never moves when the reader switches cases
  // and a list whose names all fit keeps one line, as tall as a plain select. A product that finds the head too tall shortens its names.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [minHeight, setMinHeight] = useState<number | null>(null);
  const nameKey = names.join('\u0001');
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const display = wrap?.querySelector<HTMLElement>('.cs-select-display');
    if (!wrap || !display) return undefined;
    const all = nameKey ? nameKey.split('\u0001') : [];
    const measure = () => {
      const st = getComputedStyle(display);
      const room = display.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
      if (!(room > 0)) return;
      // a temporary unclamped copy of the text element, inside the display (so the cascade is the real one), at the display's content width
      const copy = document.createElement('span');
      copy.className = 'cs-select-text';
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('style', `position:absolute;visibility:hidden;left:0;top:0;width:${room}px;display:block;overflow:visible;max-height:none;-webkit-line-clamp:unset;line-clamp:unset`);
      display.append(copy);
      let tallest = 0;
      for (const n of all) {
        copy.textContent = n;
        tallest = Math.max(tallest, copy.getBoundingClientRect().height);
      }
      const line = parseFloat(getComputedStyle(copy).lineHeight) || parseFloat(st.fontSize) * 1.25;
      copy.remove();
      const frame = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom) + parseFloat(st.borderTopWidth) + parseFloat(st.borderBottomWidth);
      const next = tallest > line * 1.5 ? Math.ceil((tallest + frame) * 100) / 100 : null;
      setMinHeight((prev) => (prev === next ? prev : next));
    };
    measure();
    let width = wrap.getBoundingClientRect().width;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      const w = wrap.getBoundingClientRect().width;
      if (w !== width) {
        width = w;
        measure();
      }
    });
    ro?.observe(wrap);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [nameKey]);
  return (
    <div className="cs-select-wrap" ref={wrapRef}>
      <div className="cs-select-display" style={minHeight === null ? undefined : { minHeight }} aria-hidden="true">
        <span className="cs-select-text">{selectedName}</span>
      </div>
      {children}
    </div>
  );
}
