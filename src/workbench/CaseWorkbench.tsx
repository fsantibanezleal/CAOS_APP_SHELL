import type { ReactNode } from 'react';
import { Tabs } from '../content/Tabs';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { type Lane, LaneBadge } from './LaneBadge';
import { type VariantBarProps, VariantBar } from './VariantBar';

/** One group of views of the selected case, named for the question the user is asking (ADR-0071 rule 5). */
export interface WorkbenchGroup {
  id: string;
  label: BiText;
  /** Which lane produced this group's views; shown as a badge on the panel. */
  lane?: Lane;
  content: ReactNode;
}

export interface CaseWorkbenchProps {
  /** The regimes of the case; omit only for a case with no meaningful parametric or temporal family. */
  variants?: VariantBarProps;
  /** The instrument: the case's own question groups (for example Model, Validation, Impact, Findings). */
  groups: WorkbenchGroup[];
  /** The comparison across the case's variants (one metric per regime; selecting one loads it). */
  compare?: { label?: BiText; lane?: Lane; content: ReactNode };
  /** The deep write-up of the case: problem, variables, equations, assumptions, what each variant shows, how to read
   * the views (ADR-0016 §9.B). Always present. */
  context: { label?: BiText; content: ReactNode };
  ariaLabel?: BiText;
}

export const MAX_WORKBENCH_GROUPS = 6;

function panel(lane: Lane | undefined, content: ReactNode): ReactNode {
  return (
    <div className="caos-cw-panel">
      {lane && (
        <div className="caos-cw-panel-head">
          <LaneBadge lane={lane} />
        </div>
      )}
      {content}
    </div>
  );
}

/**
 * The per-case workbench (ADR-0016 §9 as amended 2026-10-04): the variant bar, then ONE row of at most six groups
 * in a fixed order: the instrument groups, the variant comparison, the context write-up. The live lane is a
 * property of each view (its badge and its controls), not a separate tab, unless a product's live engine is a
 * distinct reduced model, in which case that product adds it as an instrument group.
 */
export function CaseWorkbench({ variants, groups, compare, context, ariaLabel }: CaseWorkbenchProps) {
  const lang = useShellLang();
  const tabs = groups.map((g) => ({ id: g.id, label: pick(g.label, lang), content: panel(g.lane, g.content) }));
  if (compare) {
    tabs.push({
      id: 'compare',
      label: pick(compare.label ?? { en: 'Compare variants', es: 'Comparar variantes' }, lang),
      content: panel(compare.lane, compare.content),
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
    <div className="caos-cw" data-case-workbench="" data-group-count={tabs.length}>
      {variants && <VariantBar {...variants} />}
      <Tabs tabs={tabs} ariaLabel={pick(ariaLabel ?? { en: 'Case views', es: 'Vistas del caso' }, lang)} />
    </div>
  );
}
