import { useCallback, useEffect, useRef, useState } from 'react';
import { readCaseParam } from '../case/caseModel';
import { removeQueryParam, replaceQueryParam } from '../lib/urlView';
import { FOCUS_PARAM } from '../workbench/focus';

/** What the hook needs of a product's Focus configuration: `CaseFocusConfig` and `SurfaceFocusConfig` both satisfy it. */
export interface FocusModeConfig {
  /** The query parameter (default `focus`). */
  param?: string;
  /** Called when Focus opens (`true`) and closes (`false`), for a product that records it. */
  onChange?: (on: boolean) => void;
}

export interface FocusModeOptions {
  /**
   * False while what Focus would open is not available (a surface whose open view has no stage): Focus is then never shown, and a
   * `?focus=1` left in the URL is removed. Default true.
   */
  enabled?: boolean;
  /** Whether a `?focus=1` in the URL at the first render may open Focus (a surface checks the view the link names). Default true. */
  initialAllowed?: () => boolean;
}

export interface FocusMode {
  /** True when the frame shows: configured, on, and enabled. */
  show: boolean;
  /** Opens or closes Focus: writes the URL, moves keyboard focus on the next commit and calls `onChange`. */
  setFocus: (on: boolean) => void;
  /** Attach to the control that opens Focus: keyboard focus returns to it when Focus closes. */
  enterRef: React.MutableRefObject<HTMLButtonElement | null>;
  /** What the reader had open in the tab rows of the views; provide it as `ViewMemoryContext` around both frames. */
  memory: Map<string, string>;
}

/**
 * Focus mode (ADR-0070), the one behaviour `CaseWorkbench` and `SurfacePage` share: the state held in the URL (`?focus=1`), Escape
 * to leave, the page behind the frame inert, keyboard focus moved to the exit control on entry and back to the entering control on
 * return, and the view memory the frame's remount reads. The component renders the frame (`FocusShell`) when `show` is true.
 * `cfg` null means the App has no Focus mode: nothing here acts.
 */
export function useFocusMode(cfg: FocusModeConfig | null, options: FocusModeOptions = {}): FocusMode {
  const enabled = options.enabled ?? true;
  const param = cfg?.param ?? FOCUS_PARAM;
  const [on, setOn] = useState(
    () => cfg !== null && typeof window !== 'undefined' && readCaseParam(window.location.search, param) === '1' && (options.initialAllowed?.() ?? true),
  );
  const enterRef = useRef<HTMLButtonElement | null>(null);
  const memory = useRef(new Map<string, string>());
  const turned = useRef<'in' | 'out' | null>(null);
  const onChangeRef = useRef(cfg?.onChange);
  onChangeRef.current = cfg?.onChange;
  const setFocus = useCallback(
    (next: boolean) => {
      turned.current = next ? 'in' : 'out';
      setOn(next);
      if (next) replaceQueryParam(param, '1');
      else removeQueryParam(param);
      onChangeRef.current?.(next);
    },
    [param],
  );
  const show = cfg !== null && on && enabled;
  // A link that asked for Focus where Focus is not available (or Focus left on when its view became unavailable) is cleaned up:
  // the parameter goes and nothing opens. This is not a closing, so the keyboard stays where it is and `onChange` is not called.
  useEffect(() => {
    if (cfg === null || enabled) return;
    if (on) setOn(false);
    if (typeof window !== 'undefined' && readCaseParam(window.location.search, param) === '1') removeQueryParam(param);
  }, [cfg === null, enabled, on, param]);
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      setFocus(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show, setFocus]);
  // The page behind the focus frame (the header, the footer, the skip link, whatever else is not on the way to the frame) is inert
  // while Focus is open: no Tab into it, nothing of it in the accessibility tree.
  useEffect(() => {
    if (!show) return undefined;
    const frame = document.querySelector('[data-focus-shell]');
    if (!frame) return undefined;
    const made: Element[] = [];
    for (let node: Element | null = frame; node && node !== document.body; node = node.parentElement) {
      for (const sib of Array.from(node.parentElement?.children ?? [])) {
        if (sib !== node && !sib.hasAttribute('inert') && sib.tagName !== 'SCRIPT' && sib.tagName !== 'STYLE') {
          sib.setAttribute('inert', '');
          made.push(sib);
        }
      }
    }
    return () => {
      for (const el of made) el.removeAttribute('inert');
    };
  }, [show]);
  // Keyboard focus follows the reader: to the exit control when Focus opens, back to the Focus control when it closes.
  useEffect(() => {
    if (turned.current === 'in' && show) document.querySelector<HTMLElement>('[data-focus-exit]')?.focus();
    else if (turned.current === 'out' && !show) enterRef.current?.focus();
    turned.current = null;
  }, [show]);
  return { show, setFocus, enterRef, memory: memory.current };
}
