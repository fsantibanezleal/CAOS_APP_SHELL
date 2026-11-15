import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * The readout of a chart keeps the tallest height it has reached while the chart keeps its width, its language and its zoom (SHC-106,
 * issue 224, known defect 45).
 *
 * The readout wraps (it cut its text with an ellipsis before 0.26.1), so its number of lines follows its text: the hint at rest, the values
 * under the cursor, a caller's readout. A filling chart's plot takes the height the readout leaves, so a readout that grew and shrank with
 * each move of the pointer would resize the plot under it, and at the plot's lower edge the pointer would fall out of the plot and back in.
 * The readout therefore takes, as its minimum height, the tallest height it has reached; a new key (the width, the language or the zoom)
 * measures it afresh. Runs before paint, so the reader never sees the readout at its natural height first.
 */
export function useReadoutHeight(ref: RefObject<HTMLElement | null>, key: string, text: string): void {
  const mark = useRef<{ key: string; height: number }>({ key: '', height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (mark.current.key !== key) mark.current = { key, height: 0 };
    el.style.minHeight = '';
    const height = el.getBoundingClientRect().height;
    if (height > mark.current.height) mark.current.height = height;
    el.style.minHeight = `${mark.current.height}px`;
  }, [ref, key, text]);
}
