# 03 Navigation

## Every row is one line

The route row, the tab rows, the sub-tab rows, the chip rows and the rail's section row follow one rule (ADR-0071
rule 4): one line; when it does not fit it scrolls sideways (wheel, trackpad, drag, keyboard), its scrollbar hidden and
its hidden end faded (`useOverflowFade` sets `data-fade-start` and `data-fade-end`, the stylesheet masks them); the
active item is scrolled into view, and so is any item that receives keyboard focus. A row never shrinks in a flex column
(`flex: none`): a row that shrank under a tall panel cut its tabs (known shell defect 16, which 16 to 24 products had to
fix for themselves before 0.8.0 made it the rule everywhere). The gate fails a row that wraps (ADR-0071.4) or cuts its
tabs (G5).

## The levels

| Level | Component | Peers | Notes |
|---|---|---|---|
| Routes | the header's route row (`ShellConfig.routes`, usually `STANDARD_ROUTES`) | six | `NavLink` inside a router; reachable by a pointer click from the App route at every width (G5) |
| Views of a route | `Tabs`; the groups of `CaseWorkbench`; the views of `SurfacePage` | at most six (ADR-0071 rule 5); more is reported | only the open panel is rendered, inside a `PanelBoundary` |
| Grouped views | `TabGroups`: one row of groups, then the open group's sub-tabs | six groups | no hover menus: every view is reached by plain clicks |
| Second level | `SubTabs` (pills), or `orientation="vertical"` for a deep document | six | the vertical list is sticky: it stays in view at the end of a long section (known shell defect 24, G12) |
| Rail sections | `WorkbenchLayout` with `rail` as sections | as few as fit | a chip row with arrow keys, Home and End; it fades like every row |

`Tabs` and `SubTabs` take `value` and `onChange` (controlled) or `initial` (uncontrolled), roving tab index, arrow keys,
Home and End.

## Views in the URL

The open view is part of the address, so a reader can share it and a reload keeps it:

| Parameter | Held by | Default |
|---|---|---|
| `?case=` | `CaseSelector` with `deepLink` | on in the template |
| `?view=` | `CaseWorkbench` (its open group) and `SurfacePage` (its open view) | on; `deepLinkView={false}` turns it off, a string renames it |

Both are written with `replaceState`, keeping the router's history state (React Router keeps its entry key and index
there; the 0.7 case selector replaced it with `null`). A view the URL names that the route does not have is ignored.
A product that holds the selection itself passes `group` (workbench) or `value` (surface) and the URL is left alone.
`useUrlView(ids, param, value, onChange)` is the same logic for a tab row of a product's own.
