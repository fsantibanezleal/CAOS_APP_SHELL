import { isValidElement, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
import { readCaseParam } from '../case/caseModel';
import { useShellLang } from '../lib/lang';
import { PanelBoundary } from '../lib/PanelBoundary';
import { type BiText, pick } from '../lib/text';
import { useUrlView, viewParamOf } from '../lib/urlView';
import { PanelPathContext, ViewMemoryContext } from '../lib/viewMemory';
import { FocusShell } from '../shell/FocusShell';
import { useFocusMode } from '../shell/useFocusMode';
import { FOCUS_PARAM, FOCUS_TEXT, type SurfaceFocusConfig, type ViewFocusConfig } from '../workbench/focus';
import { DocRefsScope } from './Cite';
import { type TabDef, Tabs } from './Tabs';

export interface SurfacePageProps {
  /** The route's heading; omit it when the header's active route already names the surface. */
  title?: BiText;
  /** One line under the title: what the surface is for. */
  lede?: ReactNode;
  /** Controls that act on the whole surface (a source picker, an export button), at the right of the head. */
  actions?: ReactNode;
  /** The surface's views: one row of at most six (ADR-0071 rule 5); the open one is held in the URL. A view with a stage sets `focus`. */
  tabs?: TabDef[];
  /** Controlled selection, when the product holds it itself. */
  value?: string;
  onChange?: (id: string) => void;
  /** The query parameter that holds the open view (default `view`); `false` keeps it out of the URL. */
  deepLinkView?: boolean | string;
  ariaLabel?: BiText;
  /** Mark the body as the instrument, so the gate measures what is drawn in it (ADR-0071 rule 8). */
  instrument?: boolean;
  /**
   * Focus mode for the App (ADR-0070, shell 0.16.0): while the open view sets `TabDef.focus`, a Focus control at the end of the tab row
   * opens that view in the full viewport through `FocusShell` (the view is the stage, its `rail` the parameter column), holds
   * `?focus=1` beside `?view=` in the URL, and returns with Escape or the exit button to the same view and sub-view. `true` takes all
   * the defaults. Omit it and the surface is exactly what it was. Needs `tabs`: a surface with one body has no view to focus.
   */
  focus?: boolean | SurfaceFocusConfig;
  /** The body when there are no tabs: it fills the viewport. */
  children?: ReactNode;
}

/** The text of a view's label, for the Focus frame's title and name (a label may be any node). */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

const viewFocus = (tab: TabDef | undefined): ViewFocusConfig | null => (!tab || !tab.focus ? null : tab.focus === true ? {} : tab.focus);

/**
 * The third route type, beside the workbench (`WorkbenchLayout`, a rail and an instrument for one case) and the
 * document (`DocPage`, a scrolling reading column): a SURFACE fills the viewport with views that are not one case's, such
 * as a hub, an explorer or a console. Under `ShellConfig.contain` its head and tab row keep their height and the
 * open panel scrolls inside; below 900 px the document scrolls. The containment fifteen to nineteen products wrote for
 * themselves (CAOS_MANAGE audit 2026-10-07, section 3), owned here so no product writes it again.
 *
 * Its views that have a stage (a simulation, a drawing, a live run) open in Focus mode (0.16.0, ADR-0070): the same behaviour as
 * `CaseWorkbench`'s, one piece of code (`useFocusMode`). The control sits at the end of the tab row (a slot beside the tab list) with
 * its space reserved, so it adds no row and moves nothing; it is hidden while the open view has no stage.
 */
export function SurfacePage({ title, lede, actions, tabs, value, onChange, deepLinkView = true, ariaLabel, instrument, focus, children }: SurfacePageProps) {
  const lang = useShellLang();
  const ids = (tabs ?? []).map((t) => t.id);
  const viewParam = tabs ? viewParamOf(deepLinkView) : null;
  const [open, select] = useUrlView(ids, viewParam, value, onChange);
  const focusCfg: SurfaceFocusConfig | null = focus === true ? {} : focus || null;
  const openTab = tabs?.find((t) => t.id === open) ?? tabs?.[0];
  const openFocus = focusCfg ? viewFocus(openTab) : null;
  const mode = useFocusMode(focusCfg, {
    enabled: openFocus !== null,
    // a link opens Focus only on a view with a stage: the view it names (the first one when it names none), never an unknown one
    initialAllowed: () => {
      const named = value ?? (viewParam && typeof window !== 'undefined' ? readCaseParam(window.location.search, viewParam) : null);
      if (named !== null && !ids.includes(named)) return false;
      return viewFocus(tabs?.find((t) => t.id === (named ?? ids[0]))) !== null;
    },
  });
  // The control sits at the end of the tab row, in a slot beside the tab list (never in the head, which stays what it was). Its space is
  // reserved while the surface has `focus` and any view sets it; on a view with no stage it is hidden from sight, the accessibility tree
  // and the keyboard, so neither the row nor the tabs move.
  const reserve = focusCfg !== null && Boolean(tabs?.some((t) => viewFocus(t) !== null));
  const idle = openFocus === null;
  const enter = reserve && (
    <button
      ref={mode.enterRef}
      type="button"
      className="btn caos-focus-enter"
      data-focus-enter=""
      aria-label={FOCUS_TEXT.enterViewLabel[lang]}
      title={FOCUS_TEXT.enterViewLabel[lang]}
      aria-hidden={idle ? true : undefined}
      tabIndex={idle ? -1 : undefined}
      style={idle ? { visibility: 'hidden' } : undefined}
      onClick={() => mode.setFocus(true)}
    >
      <Maximize2 size={14} aria-hidden="true" />
      <span>{FOCUS_TEXT.enter[lang]}</span>
    </button>
  );
  if (mode.show && openTab && openFocus) {
    const label = textOf(openTab.label);
    const surfaceTitle = title !== undefined ? pick(title, lang) : '';
    return (
      <ViewMemoryContext.Provider value={mode.memory}>
        <FocusShell
          title={openFocus.title !== undefined ? pick(openFocus.title, lang) : label}
          description={openFocus.description !== undefined ? pick(openFocus.description, lang) : surfaceTitle}
          hud={(openFocus.hud ?? []).map((h) => ({ label: pick(h.label, lang), value: h.value }))}
          onExit={() => mode.setFocus(false)}
          exitLabel={FOCUS_TEXT.exit[lang]}
          stageLabel={FOCUS_TEXT.stage[lang]}
          landmark={false}
          stage={
            <div className="caos-surface-focus" data-surface-focus="" data-view-param={viewParam ?? ''} data-focus-param={focusCfg?.param ?? FOCUS_PARAM} data-focus-view={openTab.id} data-focus-group={openTab.id} data-instrument="">
              <div className="tabs">
                <div className="tabpanel" role="tabpanel" tabIndex={0} aria-label={label || undefined} data-panel={openTab.id}>
                  <PanelPathContext.Provider value={`/${openTab.id}`}>
                    <PanelBoundary panel={openTab.id}>
                      <DocRefsScope>{openTab.content}</DocRefsScope>
                    </PanelBoundary>
                  </PanelPathContext.Provider>
                </div>
              </div>
            </div>
          }
          rail={openFocus.rail !== undefined && openFocus.rail !== null ? <div className="caos-focus-rail-body">{openFocus.rail}</div> : null}
        />
      </ViewMemoryContext.Provider>
    );
  }
  const head = title !== undefined || lede !== undefined || actions !== undefined;
  const page = (
    <div className="page-body wide caos-surface" data-surface="" data-view-param={reserve ? (viewParam ?? '') : undefined}>
      {head && (
        <div className="caos-surface-head">
          <div className="caos-surface-heading">
            {title !== undefined && <h1 className="caos-surface-title">{pick(title, lang)}</h1>}
            {lede !== undefined && <p className="caos-surface-lede">{lede}</p>}
          </div>
          {actions !== undefined && <div className="caos-surface-actions">{actions}</div>}
        </div>
      )}
      <div className="caos-surface-body" data-instrument={instrument ? '' : undefined}>
        {tabs ? (
          <Tabs tabs={tabs} value={open} onChange={select} ariaLabel={pick(ariaLabel ?? title ?? { en: 'Views', es: 'Vistas' }, lang)} trailing={enter || undefined} />
        ) : (
          children
        )}
      </div>
    </div>
  );
  // the frame mounts the view again: what the reader had open in its tab rows is kept (only when Focus is configured)
  return focusCfg ? <ViewMemoryContext.Provider value={mode.memory}>{page}</ViewMemoryContext.Provider> : page;
}
