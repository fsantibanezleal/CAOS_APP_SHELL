import { type ReactNode, useMemo } from 'react';
import { MAX_PEER_TABS, Tabs } from '../content/Tabs';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { type Lane, LaneBadge } from './LaneBadge';
import { makeStateKey, type Provenance, WorkbenchStateContext } from './state';
import { type VariantBarProps, VariantBar } from './VariantBar';

/** One group of views of the selected case, named for the question the user is asking (ADR-0071 rule 5). */
export interface WorkbenchGroup {
  id: string;
  label: BiText;
  /** Which lane produced this group's views, and what data they rest on; shown as badges on the panel. */
  lane?: Lane;
  provenance?: Provenance;
  content: ReactNode;
}

export interface CaseWorkbenchProps {
  /** The selected case (written as `data-case`). */
  caseId: string;
  /** The data source of the case (for example `real` or `synthetic`), written as `data-source`. */
  source?: string;
  /** Every control value of the instrument; with the case and variant it forms the state key (S10). */
  controls?: Record<string, unknown>;
  /** A workbench whose views have no live control declares it, so the reactivity gate does not expect one. */
  replayOnly?: boolean;
  /** The regimes of the case; omit only for a case with no meaningful parametric or temporal family. */
  variants?: VariantBarProps;
  /** The instrument: the case's own question groups (for example Model, Validation, Impact, Findings). */
  groups: WorkbenchGroup[];
  /** The comparison across the case's variants (one metric per regime; selecting one loads it). */
  compare?: { label?: BiText; lane?: Lane; provenance?: Provenance; content: ReactNode };
  /** The deep write-up of the case: problem, variables, equations, assumptions, what each variant shows, how to read
   * the views (ADR-0016 s9.B). Always present. */
  context: { label?: BiText; content: ReactNode };
  /** Controlled group selection (for example held in the URL). */
  group?: string;
  onGroupChange?: (id: string) => void;
  ariaLabel?: BiText;
}

export const MAX_WORKBENCH_GROUPS = MAX_PEER_TABS;

function panel(lane: Lane | undefined, provenance: Provenance | undefined, content: ReactNode): ReactNode {
  return (
    <div className="caos-cw-panel">
      {lane && (
        <div className="caos-cw-panel-head">
          <LaneBadge lane={lane} provenance={provenance} />
        </div>
      )}
      {content}
    </div>
  );
}

/**
 * The per-case workbench (ADR-0016 s9 as amended 2026-10-04): the variant bar, then ONE row of at most six groups in
 * a fixed order: the instrument groups, the variant comparison, the context write-up. The live lane is a property of
 * each view (its badge and its controls), not a separate tab, unless a product's live engine is a distinct reduced
 * model, in which case that product adds it as an instrument group.
 *
 * It provides the selection's state key to every `PlotCard` and `Readout` inside it, so a view still showing data
 * for an earlier selection says so, and it writes `data-case`, `data-variant`, `data-source` and `data-state-key`
 * on its host so the gate can check that the instrument shows what was asked for.
 */
export function CaseWorkbench(props: CaseWorkbenchProps) {
  const { caseId, source, controls, replayOnly, variants, groups, compare, context, group, onGroupChange, ariaLabel } = props;
  const lang = useShellLang();
  const variantId = variants?.activeId;
  const stateKey = useMemo(
    () => makeStateKey({ caseId, variantId: variantId ?? null, source: source ?? null, controls: controls ?? {} }),
    [caseId, variantId, source, controls],
  );
  const tabs = groups.map((g) => ({ id: g.id, label: pick(g.label, lang), content: panel(g.lane, g.provenance, g.content) }));
  if (compare) {
    tabs.push({
      id: 'compare',
      label: pick(compare.label ?? { en: 'Compare variants', es: 'Comparar variantes' }, lang),
      content: panel(compare.lane, compare.provenance, compare.content),
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
  return (
    <WorkbenchStateContext.Provider value={{ stateKey, caseId, variantId, source }}>
      <div
        className="caos-cw"
        data-case-workbench=""
        data-group-count={tabs.length}
        data-case={caseId}
        data-variant={variantId ?? ''}
        data-source={source ?? ''}
        data-state-key={stateKey}
        data-replay-only={replayOnly ? '1' : undefined}
      >
        {variants && <VariantBar {...variants} />}
        <Tabs
          tabs={tabs}
          value={group}
          onChange={onGroupChange}
          ariaLabel={pick(ariaLabel ?? { en: 'Case views', es: 'Vistas del caso' }, lang)}
        />
      </div>
    </WorkbenchStateContext.Provider>
  );
}
