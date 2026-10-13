# The executive view

Every CAOS app has an Introduction with two views: the **executive view**, shown first, and the technical view. The executive
view is one standard for every app: the same four sections, the same fields, the same illustrations, rendered by the shell's
`ExecutiveView` from one data file the product fills. A product writes content; it never designs this view (it takes no
children and no section can be added, removed or reordered).

The binding text is CAOS_MANAGE `conventions/problem-context-first.md` (Felipe, 2026-10-12: "the 4 initial are the expected
content on the intro sections. The intro must have 2 visions, the executive and the technical." and "i need clear rules so
any product produces a consistent output."). This page transcribes the parts the shell implements; where it quotes Felipe's
rubric it is verbatim.

## The four sections (Felipe's rubric, verbatim)

The four sections are the first four goals of the executive-pitch rubric Felipe gave on 2026-10-12, in this order, with these
titles. Each section must read as the HIT, never as the MISS.

| # | Section title | Question | HIT | MISS |
|---|---|---|---|---|
| 1 | Industry & Exec Tailoring | Built for a C-suite exec? | Named exec owned initiative, quantified why they need to act now. | Generic; no exec story or data. |
| 2 | AI Transformation Story | Outcomes, not a feature tour | Vision first; each product ties to non-technical business outcome, presents quantified proof points | Product tour; no vision or outcomes. |
| 3 | 4Cs Positioning | Value story, not features dump | Ties the 4 C's back to the exec's problems. | Lists the C's without tying to the exec. |
| 4 | Delivery & Credibility | Trust them in front of a CxO? | Composed, two-way dialogue with business relevant questions. | Rushed, monologues at the exec, asks few questions. |

Golden rule: "If you were the CxO sitting in that room, would you give this rep 30 more minutes of your time or delegate them
down to someone on your team?"

The view writes the titles and the questions itself, in both languages (Spanish: "Industria y foco ejecutivo", "Historia de
transformación con IA", "Posicionamiento 4C", "Entrega y credibilidad"; the questions "¿Pensado para un ejecutivo de primer
nivel?", "Resultados, no un recorrido de funciones", "Historia de valor, no lista de funciones", "¿Confiaría en ellos frente a
un ejecutivo?").

## The layout: one sub-tab per section

The view shows its sections as the sub-tabs of the shell's `SubTabs`, the first selected, as every documentation page shows a
topic with subsections: never one long scroll. The sections, their ids, their titles and their rubric questions come from ONE
definition, `EXEC_SECTION_DEFS` in `src/content/executive.ts` (the gate keeps a copy in `gate/areas.mjs`, `EXEC_SECTIONS`, that a
unit test holds equal), so when the section structure changes it changes in that list. The rubric question and the content of a
section sit inside its tab; the three illustrations stay in their sections (`initiative` and `problem` in section 1, `solution`
in section 2); the source notes sit below the sub-tabs and stay visible whichever tab is open. Every sub-tab is reachable by
keyboard (arrow keys, Home and End). The view and the lede of the page take the full width of the document column; only an
illustration may stay centred at its natural size inside its figure.

## Sources are links

Each `sources` entry is `{ field, title, url, note? }`: `url` is required and `https://` only; `title` is the publication in
plain words; `note` is optional and at most one sentence (a page number, for example). The note renders the title as a link to
the url, then the note. The validator and the gate fail a source without a url, with a non-https url, with a title or note over
the writing limits, or with a text that cites a file in place of the link (`file` and a digit, `archivo` and a digit, a `.pdf`
name without a written-out https link, "Published on").

## General, never a client, never a pitch

The view is general (Felipe, 2026-10-13: "I'm not selling or promoting that to anybody"): no named client, no offer, no price, no
contact, no call to buy. The validator and the gate fail these whole words in any text field, in English and in Spanish and in
either case: "our client", "nuestro cliente", "contact us", "contáctenos", "buy", "comprar", "price", "precio", "offer", "oferta"
(and their plurals).

## The landing

Every product lands on the Introduction, whose executive view is its first and default view (Felipe, 2026-10-13). The shell
exports `Landing`, `LANDING_ROUTE` (`/introduction`), `APP_ROUTE` (`/app`) and `STANDARD_ROUTES` in the new order (Introduction,
App, Methodology, Implementation, Experiments, Benchmark). A product that moves from 0.12 changes its router by hand, once:

```tsx
<Route path="/" element={<Landing />} />
<Route path="/app" element={<App />} />
<Route path="*" element={<Landing />} />
```

and its `fixedRoutes`, if it sets any, names `/app` instead of `/`. An old link to the App (the root with a query string such as
`?case=B2`, or a hash) is forwarded to `/app` with both kept; the root alone and any unknown path open the Introduction. A
product that builds a static site materialises `app/index.html` beside the other routes. The gate checks the landing: the root
must open the Introduction on its executive view, and `/?case=...#...` must reach `/app` with both kept.

## Using it

```tsx
import { ExecutiveView } from '@fasl-work/caos-app-shell';
import executive from '../content/executive.json';

<Tabs ... tabs={[{ id: 'executive', label: ..., content: <ExecutiveView data={executive} base={import.meta.env.BASE_URL} /> }, { id: 'technical', ... }]} />
```

`base` is where the product's site is served from (default `/`); the illustration files are fetched from it. The executive
tab holds the `ExecutiveView` and nothing else: the gate fails any `DocSection`, paragraph, figure or equation placed beside it.

## The data file `content/executive.json`

Valid against `src/content/executive.schema.json` (version 2.0.0, the contract; bundled into the package, and exposed as a file when the release adds it to `files`). Every text field is
`{ "en": ..., "es": ... }`; nothing outside these fields is allowed.

| Section | Field | Rule |
|---|---|---|
| 1 | `executive` | One C-suite role (for example Chief Risk Officer). One, never a list. |
| 1 | `organisation` | One industry and one context (for example "a Chilean commercial bank"). One, never several regions. |
| 1 | `initiative` | One sentence: what that executive owns and must achieve. |
| 1 | `why_now` | `figure` (`value`, `unit`) and `deadline`: one figure and one date or deadline. |
| 2 | `vision` | One sentence: what changes for the executive's business. Comes first. |
| 2 | `outcomes` | 3 to 5 rows, each `capability` (what the product does, plain words), `outcome` (the business result, non-technical), `proof` (`value`, `unit` and a one-line `statement`). |
| 3 | `four_cs` | Exactly 4 rows, one per C, in the owner's order: `c` (the C's name) and `exec_problem` (one sentence tying it to this executive's problem). Absent until the names are given. |
| 4 | `dialogue` | 3 to 5 pairs: `question` (a business question that executive asks) and `answer` (at most 2 sentences). |
| 1, 2 | `illustrations` | Exactly `initiative`, `problem`, `solution`, each with its SVG `file` (one path, or `{ "en", "es" }` with one per language) and its `caption` (one sentence). |
| all | `sources` | The source of every figure, by field: `{ field, title, url, note? }` with `field` the path of the figure (`why_now.figure`, `outcomes[0].proof`, ...), `title` (the publication, in plain words), `url` (https, the page or document itself) and an optional one-sentence `note`. Shown as numbered linked notes under the view, never inline. A source is always a link: never a file name, a file number, a page of prose or a citation without its URL. |

An invalid file renders an error state in the view that lists each field path and its problem, and fails the gate with the
same list. A field missing from the file is a validation error, never an empty rendering.

### The 4 C's

The names and the order of the 4 C's are Felipe's to give. Until he does, `FOUR_CS` in `src/content/executive.ts` is empty:
`four_cs` must be absent from every data file, and section 3 shows its title, its question and the declared state "Pending: the
4 C's are defined by the product owner" ("Pendiente: las 4 C las define el responsable del producto") as
`data-state="unavailable"`. When `FOUR_CS` holds 4 names, `four_cs` becomes required, in that order, each `c` equal to its name.

### Writing limits

Checked by `validateExecutive` on the data and by the gate on the rendered page, in both languages alike:

- every sentence at most 30 words (a sentence ends at `.`, `?` or `!` followed by a space or the end; a decimal point is not an end);
- `answer` at most 2 sentences; `initiative`, `vision`, `proof.statement`, `exec_problem` and `caption` one sentence each;
- no equation, no formula, no code (a `$`, `\(`, `\[` or a TeX command fails);
- no inline citation (`(Source`, `[1]`, `(ECB`, a parenthesised author and year): the source goes in `sources`;
- no acronym the executive would not use without its words in full the first time (a review duty, not a machine check).

## The illustrations (high quality, never graphs)

Felipe, 2026-10-12: "i need high quality diagrams, not graphs, illustrations of the initiative, the problem, the proposed
solutions."

| Illustration | Placed in | What it shows |
|---|---|---|
| `initiative` | Section 1, after the initiative sentence | The executive in the organisation's real setting, the initiative they own and its deadline. |
| `problem` | Section 1, after the why-now line | What goes wrong today in that setting, and what it costs: the actors, the systems and the failure, drawn as a scene. |
| `solution` | Section 2, after the vision | The same setting with the product in place: what it does, who uses it, and where each business outcome appears. |

The standard each meets:

- An illustration, not a graph: a drawn scene or concept picture of people, places, systems and their flow; no axes, no plotted
  data, no chart, no screenshot, no stock image.
- Hand-authored SVG with a `viewBox`, fetched from the product's `file` and inserted into the page (never an `img` tag, which
  cannot read the theme); scripts and event handlers are removed on insertion. Prefix its ids so the three drawings do not collide.
- Coloured only with the shell's theme tokens (`var(--color-...)`), `none` or `currentColor`, correct in light and dark; any
  other `fill`, `stroke`, `stop-color` or style colour fails. Palette per CAOS_MANAGE `conventions/visual-standards.md`.
- Labels in plain business words, in English and Spanish, inside the drawing and readable at the rendered size (at least 9 px
  once scaled to the column), with no equation and no acronym. One drawing may carry both label sets: mark each `text` with
  `data-lang="en"` or `data-lang="es"` and the view shows the displayed language's. Labels are measured in both languages and in
  the wide fallback font (give `text` no font family of its own: the view sets `var(--font-sans)`).
- One caption sentence under each, saying what the reader should take from it.
- The problem and the solution illustrations share the same setting and layout, so the change is visible between them.
- No `data-chart`. Whether a drawing reads as a scene and not as a chart in disguise is the reviewer's judgement.

## Checking it locally

```
npx caos-shell-gate --serve dist --expect-brand <Brand> --routes /introduction
```

`validateExecutive(data)` (exported by the package; call it in a unit test of the product) returns the list of `{ path, message }` problems (empty when valid). The gate, on `/introduction`,
checks that the executive view is the first and default view; that the `ExecutiveView` is present, in the executive view,
with `data-executive-schema="2.0.0"` and `data-executive-valid="true"`; the four titles and questions in order; section 3
filled or pending; the writing limits on the rendered text; that no section, text or equation sits beside the view; that the
fields are readable; one numbered note per figure; and for each illustration its place, its caption, that it is inline, loaded,
token-coloured, free of `data-chart`, and that every label sits inside its `viewBox` and is not too small. It also keeps the
older checks: the contrast of the text, and the labels of the drawing against each other, in the wide font.

The view cannot be waived, as a whole or in part: a `floorWaivers` entry naming it is refused.

## Where it is enforced

| Place | What it does |
|---|---|
| CAOS_APP_SHELL | Owns `executive.schema.json`, `ExecutiveView` and the gate check above. |
| CAOS_PRODUCT_TEMPLATE | Its example carries a filled `content/executive.json` and renders `ExecutiveView`; `check_sdd.py` fails a product whose file is missing or invalid. |
| CAOS_MANAGE `tools/agents/sizing_check.py` | A product sizing names the executive brief file and fails when it is missing or invalid against the shell schema. |
| Release review | A reviewer reads the rendered view against the HIT and MISS of each section and the golden rule; a section that reads like its MISS blocks the release. |
