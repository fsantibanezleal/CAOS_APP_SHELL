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

### Focus mode for the App (`focus`, 0.14.0, ADR-0070)

`CaseWorkbench` takes a `focus` prop (`true`, or a `CaseFocusConfig`). With it, the rail head shows a **Focus** button ("Focus" /
"Enfocar") on the case select's row (the select shrinks to make room, so the rail head is no taller; with case chips or no case
picker the button keeps a row of its own); pressing it opens the selected case's **open group** in the full viewport through `FocusShell`:
the stage is that group (its views, sub-tabs and cards, the group row is gone), the rail stays on the right with the same controls
acting on the same state, and the stage is labelled in place (the case name and the group name, or the `title` and `description` the
product gives; `hud` lays up to four readouts over the stage). Nothing is rebuilt from scratch: the case, the group, the variant and
the values belong to the product, and the sub-tab the reader had open in each tab row of the view is kept (`ViewMemoryContext`).

| What | How |
|---|---|
| URL | `?focus=1` beside `?case=` and `?view=`; a link with all three opens Focus on that case and group (`param` renames `focus`) |
| Leave | the exit button ("Back to the App" / "Volver a la App") or Escape; the App returns on the same case, group and sub-view, `focus` leaves the URL and keyboard focus returns to the Focus button |
| Keyboard | on opening, keyboard focus moves to the exit button; the page behind the frame (header, footer, skip link) is `inert` while Focus is open, so Tab stays in the frame, and the frame is a `div` (`FocusShell landmark={false}`), never a second `main` |
| Callback | `onChange(on)` for a product that records it |
| Viewport | the page never scrolls, the stage takes at least half of the viewport at 1280 px and more, the rail does not scroll there, one tab row at most |

A product with a simulation or dynamic scenarios MUST offer it (ADR-0070); `caos-shell-gate --require-focus` fails an App without the
control. Without `focus` the App renders exactly as before. (The plan of 0.14.0 named `WorkbenchShell` for this; the case, the group
and the view live in `CaseWorkbench`, the App route, so the control is there. `WorkbenchShell`, the authenticated console frame, is
unchanged.)

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

### Focus mode for a surface App (`focus`, `TabDef.focus`, 0.16.0, ADR-0070)

A console with a simulation, a drawing or a live run opens it in the full viewport the way a workbench's case does. The surface
takes `focus` (`true`, or a `SurfaceFocusConfig`: `param`, `onChange`), and each view with a stage takes `focus` on its
`TabDef` (`true`, or a `ViewFocusConfig`: `title`, `description`, `hud`, `rail`). A list or a form sets nothing.

```tsx
<SurfacePage
  title={{ en: 'Console', es: 'Consola' }}
  tabs={[
    { id: 'tasks', label: 'Tasks', content: <TaskList /> },                      // no stage: no Focus control
    {
      id: 'engine',
      label: 'Engine',
      focus: {
        title: { en: 'Engine run', es: 'Corrida del motor' },                   // default: the view's label
        hud: [{ label: { en: 'Peak', es: 'Pico' }, value: peak }],              // readouts over the stage
        rail: <><Knob ... /><ChipGroup ... /></>,                              // the parameter column (ADR-0070 requirement 2)
      },
      content: <SubTabs ... />,                                                // the stage; its sub-tab is kept across Focus
    },
  ]}
  focus={{ onChange: (on) => record(on) }}
/>
```

| What | How |
|---|---|
| Control | a **Focus** button ("Focus" / "Enfocar", named "Open this view in focus mode" / "Abrir esta vista en modo enfoque") at the end of the head's actions, on the heading's row, so it adds no row; it shows only while the open view sets `focus` and is absent on the others. A surface with no head gets one, holding the control, on a focusable view: give it a `title` or `actions` for a head that stays |
| Frame | `FocusShell` (`landmark={false}`): the open view is the stage, `rail` the right column; the title is the view's label and the description the surface's title unless the config says otherwise. Without a `rail` the stage is the whole frame and the view keeps its own controls in its body; with one the product moves them there (the shell moves no DOM) |
| URL | `?focus=1` beside `?view=` (`param` renames `focus`); a link with both opens Focus on that view. A link with `focus=1` for a view with no stage, for an unknown view, or with no view when the first view has no stage, opens nothing and the parameter is removed |
| Leave | the exit button or Escape: the same view and sub-view (the view memory `CaseWorkbench` keeps), `focus` leaves the URL, keyboard focus returns to the Focus button |
| Keyboard, page | on opening keyboard focus moves to the exit button, the page behind the frame is `inert`, the page holds one `main` and the frame no Focus control |
| Callback | `onChange(on)` when the reader opens and closes it |
| Marks | the stage carries `data-surface-focus`, `data-focus-view` and `data-focus-group` (the open view's id) for the gate |

The behaviour is the one `CaseWorkbench` has, one piece of code (`useFocusMode`, exported for a product with a frame of its own).
A surface without `focus`, or whose views set none, renders exactly as before. Needs `tabs`: a surface with one body has no view
to focus. `caos-shell-gate --workbench '' --require-focus` fails a surface App none of whose views offers the control.

## The document (`DocPage`, `DocSection`)

A documentation route: the page head (title, lede), then sections. Each `DocSection` declares `refs` (the citation
ids it cites) or a `noRefsReason` (a stated reason it cites none); it no longer renders a references row. Since 0.11.0
the references are ONE block at the end of the scope that shows them (ADR-0017 section 4): the open tab panel when the
sections sit in a `Tabs` or `SubTabs` panel (the innermost panel), otherwise the end of the `DocPage`. The block is
`<section class="caos-doc-references" data-doc-references>` with a "References" / "Referencias" heading and an ordered
list of the full citations, each once, in the order of first appearance across the scope's sections in document order;
inline `Cite` links stay in the text. `DocPage` and each rendered tab panel provide the scope (`DocRefsScope`, exported
with `DocReferences` and `firstAppearance`); `ReferenceList` stays exported but is superseded and reports itself.
`wide` for a page with a vertical sub-tab list. Text blocks (paragraphs, list items, callouts) take the full width of
the document column (0.11.0; before it a 78-character cap left a wide page's text at the left); captions keep a
`--measure-text` line, centred under their figure; the page body of a prose route keeps its max width and is centred.
Figures, tables and grids (`.two-col`, `.fig-row`, `.def-grid`) take the width. `Equation` requires a caption that
defines its symbols; `Cite` requires a DOI or URL.

## The areas of the documentation pages (ADR-0017 section 2.1)

A documentation page is not "five sections": it carries named areas, and `caos-shell-gate` (check `ADR-0017.2`) fails a built page that lacks one, or whose area lacks the content its rule names, in either language. A section declares its area: `<DocSection area="math">` renders `data-area`; a Methodology section also takes `kind="classical"` or `kind="learned"` (`data-method-kind`). The vocabulary is fixed per page and an unknown area fails. The tables below are transcribed from `gate/areas.mjs`, the one table the gate reads; `test/docFloors.test.ts` keeps them in step.

A **topic** is a leaf panel of the page: a tab of `Tabs`, a sub-tab of `SubTabs` or an item of `TabGroups`, counted across the groups (at most six top-level groups, ADR-0071 rule 5); a page without tabs is one topic. A tab list inside a `DocSection` belongs to that section: its panels are not topics, the gate visits each of them, and the section is judged on what it held across all of them (the distinct dense paragraphs, callouts, equations and figures together, the largest of every other count). A **dense paragraph** is a visible `<p>` of at least 40 words in the displayed language, equations removed, and not mostly a link; the same text counted once. A **figure** is an SVG (inline, or an `img` of an `.svg`) inside a `Figure` with a caption. Hidden elements never count, and neither does text a reader cannot read: the glyphs must be painted inside the page and not clipped (text pushed out of its box by `text-indent`, cut by `clip-path`, or set in a font under 8 px is not read; a `clip-path` other than `none` and `inset()` counts as cutting the element away). The gate measures each page once per language, at its primary size (1280 px or the first size at or above it) and first theme, visiting every topic.

### Introduction (`/introduction`)

The page opens with two top-level topics: `executive` first and open on load (the gate fails an executive view that is not the view the page opens on) and `technical`; every section of the page sits in one of the two views (a section outside both fails, and so does an equation or a symbol glossary anywhere on the page while the executive view is open). The executive view is not composed by the product: it is the shell's `ExecutiveView` fed by the product's `content/executive.json` (schema `executive.schema.json`), with the four sections of the executive-pitch rubric, three illustrations and numbered source notes; it has no areas, it is checked by the gate as a whole (`docs/06_executive-view.md`), and it cannot be waived, as a whole or by part. The areas `initiative`, `outcomes`, `positioning` and `credibility` of shell 0.11 no longer exist; a section declaring one fails as an unknown area.

| Area | View | What it is | What the gate requires in it |
|---|---|---|---|
| `problem` | technical | the industrial or scientific problem, with the concrete equipment, setting and who it serves | at least 2 dense paragraphs |
| `principles` | technical | the physics or the domain principles the product rests on | at least 2 dense paragraphs |
| `math` | technical | the governing mathematics | at least 1 captioned equation, at least 10 glossary items |
| `pipeline` | technical | the end-to-end pipeline, from the data to the screen | at least 4 steps in an ordered list |
| `honesty` | technical | what is exact and what is illustrative; what the product is not | exactly 1 honest callout, at least 1 dense paragraph |

What a count means: a glossary item counts when its term and its definition are visible and hold a letter or a digit; a step counts when it is visible and holds a letter or a digit; a statement is quantified when the reader sees its number, its unit and its source (an attribute alone does not count); hidden or empty items are not counted, and the failure message gives the count of what is visible.

Page-level floors: `intro-figure` (at least 1 overview figure in the technical view); `intro-equations` (at least 3 captioned equations in the technical view).

### Methodology (`/methodology`)

| Area | What it is | What the gate requires in it |
|---|---|---|
| `method` (one per topic; `kind` is `classical` or `learned`) | one method family, as the build runs it: its exact behaviour and constants | at least 4 dense paragraphs, at least 2 captioned equations, at least 1 figure with a caption, exactly 1 honest callout, at least 1 reference cited |

Page-level floors: `method-topics` (at least 6 topics, one per method family); `method-learned` (at least 2 topics of kind learned).

### Implementation (`/implementation`)

| Area | What it is | What the gate requires in it |
|---|---|---|
| `architecture` | offline pipeline, compact artifacts, the thin live lane, the browser | at least 1 figure with a caption |
| `reproducibility` | determinism, seeds, versions, how a result is reproduced | at least 1 callout, at least 1 dense paragraph |
| `engine` | the exact algorithm steps, constants, windows and scaling of one engine | at least 2 dense paragraphs, at least 1 captioned equation, at least 1 callout |
| `lanes` | the live and precompute boundary, and what admits a feature to the live lane | at least 2 dense paragraphs |
| `contract` | the artifact and data contracts | at least 1 table or code block(s), at least 1 dense paragraph |
| `deployment` | where and how it is deployed | at least 1 dense paragraph |

Page-level floors: `impl-topics` (at least 8 topics).

### Experiments (`/experiments`)

| Area | What it is | What the gate requires in it |
|---|---|---|
| `question` | a distinct experimental question and its answer (one section per question) | at least 2 dense paragraphs |
| `metrics` | the exact metric equations with their real constants | at least 2 captioned equations |
| `protocol` | the leakage-safe, held-out protocol, with the forbidden anti-pattern shown | at least 1 figure with a caption |
| `datasets` | the datasets, their redistribution class and their live or roadmap status | at least 1 table |

Page-level floors: `exp-topics` (at least 6 topics).

### Benchmark (`/benchmark`)

| Area | What it is | What the gate requires in it |
|---|---|---|
| `results` | held-out numbers read from committed artifacts | at least 1 table or chart(s) |
| `comparison` | a learned model and a classical baseline on the same real data | at least 1 table or chart(s) |
| `robustness` | an honest robustness or degradation curve | at least 1 chart |
| `live` | a live in-browser inference panel on real held-out data (a control counts when it is registered with the panel, `data-control`; a plain button does not) | at least 1 control |
| `provenance` | per row: dataset, difficulty source, redistribution | at least 1 table |
| `caveat` | the honest limits of the comparison | exactly 1 honest or strong callout |

### Every documentation page, and the waiver

Page-level floor on every documentation page: `lede-words` (a lede of at least 35 words). Every equation is captioned and the references are one block at the end of the page or open topic (ADR-0017 sections 2 and 4).

What the gate cannot measure stays a review duty: that the paragraphs are rigorous and name the real constants, that every symbol is defined, that no visible string holds an internal reference, that the Benchmark numbers come from committed artifacts. The language of a page is a reviewer's duty: the gate counts the words of the language displayed, but cannot tell that a Spanish page shows English paragraphs, so the reviewer reads each page in each language. A known limit: a paragraph is counted once per distinct text, but two paragraphs that differ by a word are two.

A page that cannot carry an area or a floor for a stated reason declares a **waiver**: `<DocPage floorWaivers={[{ floor: "comparison", reason: { en: "...", es: "..." } }]}>` renders `data-floor-waiver="comparison: <reason>"` on the page root (several entries separated by `; `, so a reason holds no semicolon). A waiver names an area (`math`, `live`, `comparison`) or a page-level floor (`method-learned`, `method-topics`, `lede-words`, ...) of that page. The gate skips the waived floor and nothing else, lists every waiver in its summary (`waivers` in `gate-report.json`) and in `index.html`, and fails a waiver whose reason has fewer than 12 letters or digits in two words (a reason of punctuation does not count), whose floor is not in the table of its page, or that names an area of the executive view. The pull request that adds a waiver is where it is reviewed.

## Views inside a route

| Component | What it is | Sizing |
|---|---|---|
| `PlotCard` | the frame of every chart or table: title, lane and provenance badges, note, stale overlay | `fill` takes the height its panel leaves; several share it. In a filling card the note keeps at most 35% of the card and scrolls beyond it, so the drawing keeps a floor (0.11.0); below 900 px, where the document scrolls and the body has a fixed height, the note is not capped. The gate fails a drawing under 140 px at 1280 px and above (G6) |
| `ViewsRow` (`.caos-views-row`) | views side by side | `<ViewsRow shares={[3, 2]}>` gives each view a column the shell owns and splits the row by `shares` (equal without); a filling card keeps its height chain; stacked below 900 px |
| `Stage`, `useStageSize` | the drawing surface: renders its children only at a real size, declares `data-drawn` | its container's box |
| `Readout`, `Gauge`, `Verdict` | values with units, a value against zones, the current diagnosis | the rail's width |
| `Knob`, `ChipGroup`, `VariantBar` | registered controls (`data-control`): the gate moves each and requires a view to react | the rail's width; a knob is its label and value on one row over its slider (a long label wraps beside the value); a chip row is one line, and wraps in the rail |
| `.caos-table` | tabular figures, a sticky header, numbers right-aligned, `.caos-col-text` for words | its rows; cells wrap at 760 px and below |
| `Callout`, `Figure`, `Equation` | notes, figures with captions, equations with captions | the document's column; a caption keeps its measure |

## Small cards: `FlipCard` and `CardDeck` (0.14.0)

**The rule of use.** A flip card is for a SMALL card (a title of about eight words, a back of about forty) in a place where the reader
scans the titles first and opens the ones that matter. A long card, a card with badges and a cited signal, or an ordered sequence
stays plain. The gate fails a flip card over the limit: a title of 8 words in English and 10 in Spanish, a back of 40 words in
English and 50 in Spanish (the plan's "about eight" and "about forty", with the quarter that Spanish runs longer; the limits are
`FLIP_LIMITS`).

`FlipCard` (`title`, `label`, `children`; `defaultOpen`, `open`, `onOpenChange`):

- the face shows the title on a real `button` with `aria-expanded` and `aria-controls` naming the back; a click, Enter or Space turns
  the card, and the back has its own button that turns it back (Escape closes an open card too). Keyboard focus moves to the control
  of the face that shows and never rests on a hidden one;
- the back content stays in the markup (search, copy and the gate read it); the hidden face is out of the accessibility tree and the
  tab order (`aria-hidden` and `inert` at once, `visibility: hidden` after the turn);
- the face says it turns: a small icon and a visually hidden "Show details" / "Mostrar detalles" (the back says "Hide details" /
  "Ocultar detalles");
- `prefers-reduced-motion: reduce` swaps the faces without the turn; theme tokens only; the card is as tall as its back, so a row of
  cards keeps one height.

`CardDeck` (`cards`, `flip`, `carouselAbove` default 4, `ariaLabel`): a list of cards (`{ title, label, body, attrs }`) plain, or as
flip cards with `flip`. Up to `carouselAbove` cards they are a **row**; above it a **carousel**: one window of as many cards as fit
(at least one; `perPageFor`), previous and next buttons, a swipe on touch, the arrow keys, Home and End while it has focus, and a
position ("2 of 5" / "2 de 5", "1 to 3 of 5" when several show). No autoplay. The carousel pages through its cards (it does not
scroll a strip), so neither the page nor its panel scrolls sideways (ADR-0071); the cards the window hides are not in sight or in
the tab order but stay in the markup; reduced motion removes the slide; when every card fits, the controls are not drawn.

```tsx
<CardDeck flip ariaLabel="Who bears it" cards={bearers.map((b) => ({ id: b.id, title: b.who, label: b.who, body: <p>{b.cost}</p> }))} />
```

The executive view uses them for `pain.bearers`, `situation.roles`, `situation.state_of_the_art` and `proposal.four_cs`
(`docs/06_executive-view.md`). A product page may use both under the same rule; the gate (G16) measures them wherever they appear.
