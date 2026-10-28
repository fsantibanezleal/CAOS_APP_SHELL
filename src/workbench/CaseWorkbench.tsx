import { type ReactNode, useContext, useMemo } from 'react';
import { Maximize2 } from 'lucide-react';
import { CaseSelector, type CaseSelectorProps } from '../case/CaseSelector';
import { DocRefsScope } from '../content/Cite';
import { MAX_PEER_TABS, Tabs } from '../content/Tabs';
import { useShellLang } from '../lib/lang';
import { PanelBoundary } from '../lib/PanelBoundary';
import { PanelPathContext, ViewMemoryContext } from '../lib/viewMemory';
import { useUrlView, viewParamOf } from '../lib/urlView';
import { FocusShell } from '../shell/FocusShell';
import { useFocusMode } from '../shell/useFocusMode';
import { type BiText, pick } from '../lib/text';
import type { Lane } from './LaneBadge';
import { makeStateKey, type Provenance, WorkbenchStateContext } from './state';
import { type VariantBarProps, VariantBar } from './VariantBar';
import { type CaseFocusConfig, FOCUS_PARAM, FOCUS_TEXT } from './focus';
import { RailBody, type RailSection, WorkbenchLayout } from './WorkbenchLayout';

/** One group of views of the selected case, named for the question the user is asking (ADR-0071 rule 5). */
export interface WorkbenchGroup {
  id: string;
  label: BiText;
  /** Which lane produced this group's views, and what data they rest on. Each view shows its own badges (PlotCard,
   * Readout); these are written on the panel as `data-lane` and `data-provenance`. */
  lane?: Lane;
  provenance?: Provenance;
  content: ReactNode;
}

export interface CaseWorkbenchProps {
  /** The selected case (written as `data-case`). */
  caseId: string;
  /** The case picker, shown first in the rail. Omit only for a workbench with a single case. */
  cases?: CaseSelectorProps;
  /** The data source of the case (for example `real` or `synthetic`), written as `data-source`. */
  source?: string;
  /** Every control value of the instrument; with the case and variant it forms the state key (S10). */
  controls?: Record<string, unknown>;
  /** A workbench whose views have no live control declares it, so the reactivity gate does not expect one. */
  replayOnly?: boolean;
  /** The notes of the case's filling cards are text the reader needs whole: at 1280 px and wider each takes the height it
   * needs instead of 35% of its card, the body keeping the stage floor (`data-caos-note-fit`, 0.19.5, SHC-101). */
  noteFit?: boolean;
  /** The regimes of the case, shown in the rail under the case picker; omit only for a case with no meaningful
   * parametric or temporal family. */
  variants?: VariantBarProps;
  /** The rest of the rail: the case's parameters (Knob, ChipGroup) and its live values (Readout, Gauge, Verdict),
   * as one node or as sections shown one at a time (ADR-0071 rule 6). */
  rail?: ReactNode | RailSection[];
  railLabel?: BiText;
  /** The instrument: the case's own question groups (for example Model, Validation, Impact, Findings). */
  groups: WorkbenchGroup[];
  /** The comparison across the case's variants (one metric per regime; selecting one loads it). */
  compare?: { label?: BiText; lane?: Lane; provenance?: Provenance; content: ReactNode };
  /** The deep write-up of the case: problem, variables, equations, assumptions, what each variant shows, how to read
   * the views (ADR-0016 s9.B). Always present. */
  context: { label?: BiText; content: ReactNode };
  /** Controlled group selection, when the product holds it itself. */
  group?: string;
  onGroupChange?: (id: string) => void;
  /** The query parameter that holds the open group, so a view can be shared and reloaded (default `view`); `false`
   * keeps it out of the URL. Ignored when `group` is controlled. */
  deepLinkView?: boolean | string;
  ariaLabel?: BiText;
  /**
   * Focus mode for the App (ADR-0070, shell 0.14.0): a Focus control at the end of the group tab row opens the selected case's open group in
   * the full viewport through `FocusShell` (the stage is the view, the rail stays), holds `?focus=1` beside `?case=` and
   * `?view=` in the URL, and returns with Escape or the exit button to the same case, group and sub-view. `true` takes all
   * the defaults. Omit it and the App is exactly what it was.
   */
  focus?: boolean | CaseFocusConfig;
}

export const MAX_WORKBENCH_GROUPS = MAX_PEER_TABS;

function panel(id: string, lane: Lane | undefined, provenance: Provenance | undefined, content: ReactNode): ReactNode {
  return (
    <div className="caos-cw-panel" data-group={id} data-lane={lane} data-provenance={provenance}>
      {content}
    </div>
  );
}

/**
 * The App route of a product (ADR-0016 s9, ADR-0071 as amended 2026-10-04): the control rail beside the instrument on
 * the full viewport. The rail holds, in order, the case picker, the variants of the case, and the product's
 * parameters and live values; the instrument holds ONE row of at most six question groups in a fixed order (the
 * instrument groups, the variant comparison, the context write-up) and the open group's views, which take the
 * height that row leaves. Pickers, parameters and numbers sit in the rail so the drawing keeps the instrument
 * (rule 8: at least half the viewport is drawn).
 *
 * It provides the selection's state key to every `PlotCard` and `Readout` in the rail and the instrument, so a view
 * still showing data for an earlier selection says so, and it writes `data-case`, `data-variant`, `data-source` and
 * `data-state-key` on the instrument so the gate can check that the instrument shows what was asked for.
 */
export function CaseWorkbench(props: CaseWorkbenchProps) {
  const { caseId, cases, source, controls, replayOnly, noteFit, variants, rail, railLabel, groups, compare, context, group, onGroupChange, deepLinkView = true, ariaLabel, focus } = props;
  const lang = useShellLang();
  const focusCfg: CaseFocusConfig | null = focus === true ? {} : focus || null;
  // Focus mode, one piece of code with the surface's (useFocusMode): held in the URL (`?focus=1`), opened by the control or by a link,
  // closed by Escape or the exit button; the page behind the frame is inert and keyboard focus follows the reader.
  const { show: showFocus, setFocus, enterRef, memory } = useFocusMode(focusCfg);
  // the place of this workbench in the page: the Focus frame mounts the open group again at the place its panel had
  const placeAbove = useContext(PanelPathContext);
  const variantId = variants?.activeId;
  const stateKey = useMemo(
    () => makeStateKey({ caseId, variantId: variantId ?? null, source: source ?? null, controls: controls ?? {} }),
    [caseId, variantId, source, controls],
  );
  const tabs = groups.map((g) => ({ id: g.id, label: pick(g.label, lang), content: panel(g.id, g.lane, g.provenance, g.content) }));
  if (compare) {
    tabs.push({
      id: 'compare',
      label: pick(compare.label ?? { en: 'Compare variants', es: 'Comparar variantes' }, lang),
      content: panel('compare', compare.lane, compare.provenance, compare.content),
    });
  }
  tabs.push({
    id: 'context',
    label: pick(context.label ?? { en: 'Context', es: 'Contexto' }, lang),
    content: <div className="prose caos-cw-context">{context.content}</div>,
  });
  if (tabs.length > MAX_WORKBENCH_GROUPS) {
    throw new Error(
      `CaseWorkbench: ${tabs.length} groups; at most ${MAX_WORKBENCH_GROUPS} peers, then group by question (ADR-0071 rule 5)`,
    );
  }
  // The open group: the product's when controlled, else the one the URL names (`?view=`), else the first.
  const [openGroup, selectGroup] = useUrlView(tabs.map((t) => t.id), viewParamOf(deepLinkView), group, onGroupChange);
  const enter = focusCfg && (
    <button
      ref={enterRef}
      type="button"
      className="btn caos-focus-enter"
      data-focus-enter=""
      aria-label={FOCUS_TEXT.enterLabel[lang]}
      title={FOCUS_TEXT.enterLabel[lang]}
      onClick={() => setFocus(true)}
    >
      <Maximize2 size={14} aria-hidden="true" />
      <span>{FOCUS_TEXT.enter[lang]}</span>
    </button>
  );
  // The Focus control sits at the end of the group tab row, in the slot Tabs reserves beside the tab list (shell 0.17.0, BL-074, the place
  // the surface's has had since 0.16.0): the case select takes the rail head's whole width, so no case name is cut, and the rail head and
  // the tab row are no taller than without the control (ADR-0071 rule 6). In 0.14.1 it shared the select's row and cut the names.
  const pickers =
    cases || variants ? (
      <>
        {cases && <CaseSelector lang={lang} {...cases} />}
        {variants && <VariantBar {...variants} />}
      </>
    ) : null;
  // inside Focus the same pickers; the Focus control is not among them (it would open the mode the reader is already in; shell 0.14.3)
  const railHead = pickers;
  const focusPickers = pickers;
  const instrumentData = {
    'data-case-workbench': '',
    'data-group-count': tabs.length,
    'data-case': caseId,
    'data-variant': variantId ?? '',
    'data-source': source ?? '',
    'data-state-key': stateKey,
    'data-replay-only': replayOnly ? '1' : undefined,
    'data-caos-note-fit': noteFit ? '' : undefined,
  };
  if (showFocus && focusCfg) {
    const open = tabs.find((t) => t.id === openGroup) ?? tabs[0];
    const caseName = cases?.cases.find((c) => c.id === caseId)?.name ?? caseId;
    return (
      <ViewMemoryContext.Provider value={memory}>
        <WorkbenchStateContext.Provider value={{ stateKey, caseId, variantId, source }}>
          <FocusShell
            title={focusCfg.title !== undefined ? pick(focusCfg.title, lang) : caseName}
            description={focusCfg.description !== undefined ? pick(focusCfg.description, lang) : (open?.label ?? '')}
            hud={(focusCfg.hud ?? []).map((h) => ({ label: pick(h.label, lang), value: h.value }))}
            onExit={() => setFocus(false)}
            exitLabel={FOCUS_TEXT.exit[lang]}
            stageLabel={FOCUS_TEXT.stage[lang]}
            landmark={false}
            stage={
              <div className="caos-cw caos-cw-focus" {...instrumentData} data-focus-group={open?.id} data-focus-param={focusCfg.param ?? FOCUS_PARAM} data-instrument="">
                <div className="tabs">
                  {open && (
                    <div className="tabpanel" role="tabpanel" tabIndex={0} aria-label={open.label} data-panel={open.id}>
                      <PanelPathContext.Provider value={`${placeAbove}/${open.id}`}>
                        <PanelBoundary panel={open.id}>
                          <DocRefsScope>{open.content}</DocRefsScope>
                        </PanelBoundary>
                      </PanelPathContext.Provider>
                    </div>
                  )}
                </div>
              </div>
            }
            rail={
              <div className="caos-focus-rail-body">
                <RailBody rail={rail ?? null} railHead={focusPickers} railLabel={railLabel} />
              </div>
            }
          />
        </WorkbenchStateContext.Provider>
      </ViewMemoryContext.Provider>
    );
  }
  return (
    <ViewMemoryContext.Provider value={memory}>
      <WorkbenchStateContext.Provider value={{ stateKey, caseId, variantId, source }}>
        <WorkbenchLayout rail={rail ?? null} railHead={railHead} railLabel={railLabel}>
          <div className="caos-cw" {...instrumentData}>
            <Tabs
              tabs={tabs}
              value={openGroup}
              onChange={selectGroup}
              ariaLabel={pick(ariaLabel ?? { en: 'Case views', es: 'Vistas del caso' }, lang)}
              trailing={enter || undefined}
            />
          </div>
        </WorkbenchLayout>
      </WorkbenchStateContext.Provider>
    </ViewMemoryContext.Provider>
  );
}
