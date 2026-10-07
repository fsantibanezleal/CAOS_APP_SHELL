import type { ReactNode } from 'react';
import { useShellLang } from '../lib/lang';
import { type BiText, pick } from '../lib/text';
import { useUrlView, viewParamOf } from '../lib/urlView';
import { type TabDef, Tabs } from './Tabs';

export interface SurfacePageProps {
  /** The route's heading; omit it when the header's active route already names the surface. */
  title?: BiText;
  /** One line under the title: what the surface is for. */
  lede?: ReactNode;
  /** Controls that act on the whole surface (a source picker, an export button), at the right of the head. */
  actions?: ReactNode;
  /** The surface's views: one row of at most six (ADR-0071 rule 5); the open one is held in the URL. */
  tabs?: TabDef[];
  /** Controlled selection, when the product holds it itself. */
  value?: string;
  onChange?: (id: string) => void;
  /** The query parameter that holds the open view (default `view`); `false` keeps it out of the URL. */
  deepLinkView?: boolean | string;
  ariaLabel?: BiText;
  /** Mark the body as the instrument, so the gate measures what is drawn in it (ADR-0071 rule 8). */
  instrument?: boolean;
  /** The body when there are no tabs: it fills the viewport. */
  children?: ReactNode;
}

/**
 * The third route type, beside the workbench (`WorkbenchLayout`, a rail and an instrument for one case) and the
 * document (`DocPage`, a scrolling reading column): a SURFACE fills the viewport with views that are not one case's,
 * such as a hub, an explorer or a console. Under `ShellConfig.contain` its head and tab row keep their height and the
 * open panel scrolls inside; below 900 px the document scrolls. The containment fifteen to nineteen products wrote for
 * themselves (CAOS_MANAGE audit 2026-10-07, section 3), owned here so no product writes it again.
 */
export function SurfacePage({ title, lede, actions, tabs, value, onChange, deepLinkView = true, ariaLabel, instrument, children }: SurfacePageProps) {
  const lang = useShellLang();
  const [open, select] = useUrlView((tabs ?? []).map((t) => t.id), tabs ? viewParamOf(deepLinkView) : null, value, onChange);
  const head = title !== undefined || lede !== undefined || actions !== undefined;
  return (
    <div className="page-body wide caos-surface" data-surface="">
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
          <Tabs tabs={tabs} value={open} onChange={select} ariaLabel={pick(ariaLabel ?? title ?? { en: 'Views', es: 'Vistas' }, lang)} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
