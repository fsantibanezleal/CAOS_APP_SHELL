# 04 Views

## The workbench (`CaseWorkbench`)

The App route of a product about cases, the whole route in one component:

```tsx
<CaseWorkbench
  caseId={selected}
  cases={{ cases, selectedId: selected, onSelect, layout: 'select', deepLink: true }}
  variants={{ variants, activeId, onSelect: setVariant }}
  controls={{ beta, gamma }}               // with case and variant, the state key every view is checked against
  rail={<>{knobs}<Readout ... /></>}        // or sections: [{ id, label, content }]
  groups={[{ id: 'dynamics', label: { en: 'Dynamics', es: 'Dinámica' }, lane: 'live', provenance: 'synthetic', content }]}
  compare={{ content: <CompareView /> }}
  context={{ content: <ContextView /> }}
/>
```

The rail holds, in order, the case picker, the variants and the product's parameters (`Knob`, `ChipGroup`) and live
values (`Readout`, `Gauge`, `Verdict`). The instrument holds at most six groups (the product's question groups, the
variant comparison, the context write-up); the open group is held in `?view=`. Each view is a `PlotCard` with its
`lane` and `provenance` and the state key it was computed for (`useWorkbenchState().stateKey`); a view showing data
for an earlier selection is overlaid as stale. Everything that loads declares `data-state="loading"` until it is
ready; the gate waits for that, never for the network.

## The surface (`SurfacePage`)

The App route of a product that is not one case's: a hub, an explorer, a console.

```tsx
<SurfacePage
  title={{ en: 'Explorer', es: 'Explorador' }}
  lede="Every dataset of the atlas."
  actions={<ChipGroup ... />}
  tabs={[{ id: 'map', label: 'Map', content: <MapView /> }, { id: 'table', label: 'Table', content: <TableView /> }]}
  instrument                                 // measure what is drawn in it (ADR-0071 rule 8)
/>
```

Under `contain` the head and the tab row keep their height and the open view fills the rest and scrolls inside it;
below 900 px the document scrolls. This is the containment 15 to 19 products wrote for themselves before 0.8.0
(`.app-shell` at 100dvh, `.page` and `.page-body` as flex columns with `min-height: 0`, `.tabs` filling, `.tabpanel`
scrolling); a product on 0.8.0 deletes it. Without `tabs`, the children are the body and fill it.

## The document (`DocPage`, `DocSection`)

A documentation route: the page head (title, lede), then sections, each ending in its own references or a stated
reason it cites none (ADR-0017 section 4). `wide` for a page with a vertical sub-tab list. Text blocks (paragraphs,
list items, callouts, captions) keep a `--measure-text` line; figures, tables, grids (`.two-col`, `.fig-row`,
`.def-grid`) take the width. `Equation` requires a caption that defines its symbols; `Cite` requires a DOI or URL.

## Views inside a route

| Component | What it is | Sizing |
|---|---|---|
| `PlotCard` | the frame of every chart or table: title, lane and provenance badges, note, stale overlay | `fill` takes the height its panel leaves; several share it |
| `.caos-views-row` | views side by side | each takes an equal share, a filling card included (known shell defect 23); stacked below 900 px |
| `Stage`, `useStageSize` | the drawing surface: renders its children only at a real size, declares `data-drawn` | its container's box |
| `Readout`, `Gauge`, `Verdict` | values with units, a value against zones, the current diagnosis | the rail's width |
| `Knob`, `ChipGroup`, `VariantBar` | registered controls (`data-control`): the gate moves each and requires a view to react | the rail's width; a chip row is one line |
| `.caos-table` | tabular figures, a sticky header, numbers right-aligned, `.caos-col-text` for words | its rows; cells wrap at 760 px and below |
| `Callout`, `Figure`, `Equation` | notes, figures with captions, equations with captions | the document's measure |
