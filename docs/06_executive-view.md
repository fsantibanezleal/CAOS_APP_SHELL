# The executive view

Every CAOS app has an Introduction with two views: the **executive view**, shown first, and the technical view. The executive
view complements the technical view: it frames, in executive language, the problem the work addresses and why the work is
pertinent; it is not a description of the product, a feature list, a pitch or an offer. It is one standard for every app: the same
five sections, the same fields, the same illustrations, rendered by the shell's `ExecutiveView` from one data file the product
fills. A product writes content; it never designs this view (it takes no children and no section can be added, removed or
reordered).

The binding text is CAOS_MANAGE `conventions/problem-context-first.md` (Felipe, 2026-10-12 and 2026-10-13). This page
transcribes the parts the shell implements; where it quotes Felipe it is verbatim.

Felipe, 2026-10-13: "It is an executive view to cover what the pain in the industry is, its context, its current situation, its
current trends, and the proposal." The view frames the industry's problem, which is wider than what any app covers ("the
problem can be wider than what we cover in the app, they are not the same"). It is a substantive executive document, not "a small
short content only oriented to fill the space".

## The structure

**Above the sub-tabs (the landing block):** the problem's title (`title`); a key statement of one or two sentences naming the
pain and the direction proposed (`key_statement`); two or three headline figures (`headline_figures`), each a short heading, one
figure with its unit and its linked source.

**Five sub-tabs**, the first open, titled exactly as below. Each opens with one key message line (a reader can stop at the five
lines), then its supporting content. The rubric of the executive-pitch guide gives the ideas and the language of these sections,
never their labels: the view prints no rubric label and no rubric question.

| # | Sub-tab (en / es) | Key message | Supporting content (floor) |
|---|---|---|---|
| 1 | The pain / El problema | What goes wrong, for whom, how big | Two paragraphs; three to five bearers, each with cost and measure; at least two sourced industry figures; the causes as three to five non-overlapping branches weighted by size; the pain illustration |
| 2 | The context / El contexto | The force that keeps the pain going | One or two paragraphs; the setting; three or four forces, each with its direction; at least one sourced rule or figure |
| 3 | The current situation / La situación actual | How it is handled today and where that falls short | Three to five roles, each with what it decides and what it needs, and how they interact; three to five approaches of the state of the art, each with what it achieves and where it falls short; one sourced status figure with its date; the situation illustration |
| 4 | The trends / Las tendencias | The shift that makes it urgent, with its horizon | Three to five trends (regulatory, technological, market, practice), each with its direction, its horizon (now, two years, ten years), a sourced signal, its effect on the roles of tab 3, and how sure the signal is |
| 5 | The proposal / La propuesta | The approach in one sentence and the first action with its owner | One or two paragraphs tied to the causes of tab 1; the 4 C's, each applied to the approach; three to six actions, each with its owner (a role of tab 3), its horizon and how success is checked; the risks and what is still unknown; the proposal illustration; at most one closing line on the part of the problem the work explores |

**Below the sub-tabs:** the numbered linked sources, then two onward links worded as destinations: "How the work explores this
problem" / "Cómo explora el trabajo este problema" (the technical view) and "Open the App" / "Abrir la App". The sub-tabs are the
shell's `SubTabs`; the sections, their ids, their titles and the key of their data come from ONE definition, `EXEC_SECTION_DEFS`
in `src/content/executive.ts` (the gate keeps a copy in `gate/areas.mjs`, `EXEC_SECTIONS`, that a unit test holds equal).

## The data file `content/executive.json`

Valid against `src/content/executive.schema.json` (version 2.0.0, the contract; bundled into the package). Every text field is
`{ "en": ..., "es": ... }`; nothing outside these fields is allowed. The 0.12.0 fields (`executive`, `organisation`,
`initiative`, `why_now`, `vision`, `outcomes`, a top-level `four_cs`, `dialogue`) no longer exist.

| Where | Field | Rule |
|---|---|---|
| landing | `title`, `key_statement` | The problem's title; one or two sentences |
| landing | `headline_figures` | 2 or 3: `heading`, `value`, `unit`, `source` (a source id) |
| 1 | `pain` | `key_message`; `paragraphs` (2 or 3); `bearers` (3 to 5: `who`, `cost`, `measure`); `figures` (2 to 4, as the headline figures); `causes` (3 to 5: `cause`, `weight` a whole percent, the weights add to at most 100) |
| 2 | `context` | `key_message`; `paragraphs` (1 or 2); `setting`; `forces` (3 or 4: `force`, `direction` rising, easing or steady); `evidence` (1 to 4: `statement`, `source`) |
| 3 | `situation` | `key_message`; `roles` (3 to 5: `role`, `decides`, `needs`); `interaction` (one sentence); `state_of_the_art` (3 to 5: `approach`, `achieves`, `falls_short`, `source`); `status` (`heading`, `value`, `unit`, `date`, `source`) |
| 4 | `trends` | `key_message`; `items` (3 to 5: `trend`, `kind` regulatory, technological, market or practice, `direction`, `horizon` now, two_years or ten_years, `signal` with `statement` and `source`, `effect`, `confidence` low, medium or high) |
| 5 | `proposal` | `key_message`; `paragraphs` (1 or 2); `four_cs` (exactly 4: `c`, `applies`); `actions` (3 to 6: `action`, `owner`, `horizon`, `check`); `risks` (1 to 4); `unknowns` (1 to 4); optional `handoff` (one line) |
| 1, 3, 5 | `illustrations` | Exactly `pain`, `situation`, `proposal`, each with its SVG `file` (one path, or `{ "en", "es" }` with one per language) and its `caption` (one sentence) |
| all | `sources` | `{ id, title, url, note? }`: see below |

The floors are minimum and maximum counts of rows (`minItems`, `maxItems` in the schema); the validator, the schema and the gate
hold the same numbers and a unit test keeps them equal. An invalid file renders an error state in the view that lists each field
path and its problem, and fails the gate with the same list. A field missing from the file is a validation error, never an empty
rendering.

### Sources are links

Each `sources` entry is `{ id, title, url, note? }`: `id` (lower case letters, digits, hyphens) is what the figures and claims
cite; `url` is required and `https://` only; `title` is the publication in plain words; `note` is optional and at most one
sentence (a page number, for example). Every figure and every claim of the state of the art and of the trends names a source;
every source is cited by at least one; the notes are numbered in the order of first use (the landing, then the sub-tabs) and
render the title as a link to the url, then the note. The validator and the gate fail a source without a url, with a non-https
url, with a title or note over the writing limits, or with a text that cites a file in place of the link (`file` and a digit,
`archivo` and a digit, a `.pdf` name without a written-out https link, "Published on"). A source is always a link: never a file
name, a file number or a prose citation.

### The 4 C's (Felipe, 2026-10-13)

They frame the proposal, verbatim, in this order; each product says what each C means for its proposal and its roles
(`proposal.four_cs[i].applies`, one sentence). `four_cs` is required, exactly these four rows in this order, each `c` equal to
its name in both languages.

| C | Definition |
|---|---|
| Choice (Elección) | flexibility across proprietary and open models. (flexibilidad entre modelos propietarios y abiertos.) |
| Context (Contexto) | AI grounded in business meaning, so decisions are accurate. (IA anclada en el significado del negocio, para que las decisiones sean exactas.) |
| Cost (Costo) | visibility of what the AI spends. (visibilidad de lo que gasta la IA.) |
| Control (Control) | one governance over data, models and agents. (una sola gobernanza sobre datos, modelos y agentes.) |

### General, never a client, never a pitch

Felipe, 2026-10-13: "That app is not designed for a specific client. It must be general ... I'm not selling or promoting that to
anybody." The view names the family of roles involved and keeps a language oriented to them, but it is never tied to a specific
client: no named bank, company, hospital or person; no offer, price, contact or call to buy. Named institutions appear only as
the sources of public facts. The validator and the gate fail these whole words in any text field, in English and in Spanish and in
either case: "our client", "nuestro cliente", "contact us", "contáctenos", "buy", "comprar", "price", "precio", "offer", "oferta"
(and their plurals).

### Writing limits

Checked by `validateExecutive` on the data and by the gate on the rendered page, in both languages alike:

- every sentence at most 30 words (a sentence ends at `.`, `?` or `!` followed by a space or the end; a decimal point is not an end);
- one sentence each for the key messages, the interaction, the evidence statements, the signals, what each C means, the actions and
  their checks, the risks, the unknowns, the handoff and the captions; at most two for the key statement;
- a paragraph has at least 25 words (no one-line sections, no restating the title);
- no equation, no formula, no code (a `$`, `\(`, `\[` or a TeX command fails);
- no inline citation (`(Source`, `[1]`, `(ECB`, a parenthesised author and year): the source goes in `sources`;
- no acronym without its words in full the first time (a review duty, not a machine check).

## The layout: one sub-tab per section, full width

The view shows its sections as the sub-tabs of the shell's `SubTabs`, the first selected, as every documentation page shows a topic
with subsections: never one long scroll. Every sub-tab is reachable by keyboard (arrow keys, Home and End), and every sub-tab reads
well when entered directly. The view and the lede of the page take the full width of the document column (ADR-0017 1.2); only an
illustration may stay centred at its natural size inside its figure. The gate measures both.

## Flip cards and the carousel (0.14.0)

Four card groups of the view are SMALL cards the reader scans by title and opens when one matters, so they are flip cards
(`FlipCard`, `CardDeck`; `docs/04_views.md`): `pain.bearers` (the face is `who`; the back is the cost and the measure),
`situation.roles` (`role`; what it decides and needs), `situation.state_of_the_art` (`approach`; what it achieves, where it falls
short and its source mark) and `proposal.four_cs` (the C's name; its definition and what it means for the proposal). The other three
stay plain, because a flip would hide what they are for: `context.forces` (a one-line card), `trends.items` (a card with badges and
a cited signal) and `proposal.actions` (an ordered sequence). A group of four cards or fewer is a row; a group of five is a
carousel at the widths where five cards do not fit (previous and next, swipe, arrow keys, "2 of 5"; every card reachable by keyboard).
The writing limits above still apply to every field; a flip card's title is at most 8 words (10 in Spanish) and its back at most 40
(50 in Spanish), which the data limits (one sentence per field, 30 words) keep for a bearer, a role, an approach or a C. The text of
a back is in the page while the face shows: the gate reads it for the floors, the 4 C's and the writing limits.

## The illustrations (high quality, never graphs)

Felipe, 2026-10-12: "i need high quality diagrams, not graphs, illustrations of the initiative, the problem, the proposed
solutions." Every executive view carries exactly three illustrations of the problem space, never of the app:

| Illustration | Placed in | What it shows |
|---|---|---|
| `pain` | Sub-tab 1, after the paragraphs | What goes wrong in the industry: the actors, the systems and the failure, drawn as a scene. |
| `situation` | Sub-tab 3 | How the problem is handled today: the roles and the current approaches, and where they fall short. |
| `proposal` | Sub-tab 5 | The same setting with the proposed approach in place, and where it changes the outcome. |

The standard each meets:

- An illustration, not a graph: a drawn scene or concept picture of people, places, systems and their flow; no axes, no plotted
  data, no chart, no screenshot, no stock image.
- Hand-authored SVG with a `viewBox`, fetched from the product's `file` and inserted into the page (never an `img` tag, which
  cannot read the theme); scripts and event handlers are removed on insertion. Prefix its ids so the three drawings do not collide.
- Coloured only with the shell's theme tokens (`var(--color-...)`), `none` or `currentColor`, correct in light and dark; any
  other `fill`, `stroke`, `stop-color` or style colour fails. Palette per CAOS_MANAGE `conventions/visual-standards.md`.
- Labels in plain business words, in English and Spanish, inside the drawing and readable at the rendered size (at least 9 px
  once scaled to the column), with no equation, no acronym and no named organisation. One drawing may carry both label sets: mark
  each `text` with `data-lang="en"` or `data-lang="es"` and the view shows the displayed language's. Labels are measured in both
  languages and in the wide fallback font (give `text` no font family of its own: the view sets `var(--font-sans)`).
- One caption sentence under each, saying what the reader should take from it.
- The pain and the proposal illustrations share the same setting and layout, so the change is visible between them.
- No `data-chart`. Whether a drawing reads as a scene and not as a chart in disguise is the reviewer's judgement.

### Animated illustrations (0.14.0)

Felipe, 2026-10-13: "in the intro promote the use of animation, not only static illustration." The standard promotes an animated
scene **where the illustration explains a change, a flow or a sequence** (the pain growing, the roles handing work over, the
proposal's before and after); a still remains right for a single state. An animated illustration is still an SVG file:

- the animation lives inside the file: CSS keyframes (a `<style>` with `@keyframes` and `animation`) or SMIL (`animate`,
  `animateTransform`, `animateMotion`, `set`); no script, and an animation that writes a link or an event handler is removed;
- a gentle loop or a single play of **at most ten seconds** (one cycle with its longest delay); the labels never move or fade, so
  they stay readable in every frame; animate shapes, strokes and positions, and wrap a group (`<g class="a"><g transform=...>`)
  before giving it a CSS `transform`, which replaces the group's own;
- theme tokens, labels in both languages, as above;
- **a `@media (prefers-reduced-motion: reduce)` block inside the file that shows the static final frame**: for CSS keyframes the
  block sets `animation: none` and the final values (`opacity: 1`, the end position); the shell pauses a SMIL animation at its last
  frame itself, and the block still has to be there. Under reduced motion nothing in the drawing moves.

The gate (G17) fails an animated illustration without the block, with a block that does not stop the CSS animation, that plays for
more than ten seconds, or that is still moving when the page is run with reduced motion emulated. The template's guard script runs
the same analysis (`analyseSvgAnimation`, `animationFailures` of `gate/areas.mjs`).

## The landing

Every product lands on the Introduction, whose executive view is its first and default view (Felipe, 2026-10-13: "the shell and
the apps must land at the Introduction, executive view"). The shell exports `Landing`, `LANDING_ROUTE` (`/introduction`),
`APP_ROUTE` (`/app`) and `STANDARD_ROUTES` always in the order App, Introduction, Methodology, Implementation,
Experiments, Benchmark: the App stays the leftmost tab and the landing never moves it (0.13.0 had put the Introduction
first; 0.13.1 restores the App, Felipe 2026-10-13). A product that moves from 0.12 changes its router by hand, once:

```tsx
<Route path="/" element={<Landing />} />
<Route path="/app" element={<App />} />
<Route path="*" element={<Landing />} />
```

and its `fixedRoutes`, if it sets any, names `/app` instead of `/`. An old link to the App (the root with a query string such as
`?case=B2`, or a hash) is forwarded to `/app` with both kept; the root alone and any unknown path open the Introduction. A product
that builds a static site materialises `app/index.html` beside the other routes. The gate checks the landing: the root must open
the Introduction on its executive view, and `/?...#...` must reach `/app` with both kept.

## Using it

```tsx
import { ExecutiveView } from '@fasl-work/caos-app-shell';
import executive from '../content/executive.json';

<Tabs ... tabs={[{ id: 'executive', label: ..., content: <ExecutiveView data={executive} base={import.meta.env.BASE_URL} /> }, { id: 'technical', ... }]} />
```

`base` is where the product's site is served from (default `/`); the illustration files are fetched from it. The executive tab
holds the `ExecutiveView` and nothing else: the gate fails any `DocSection`, paragraph, figure or equation placed beside it. The
link "How the work explores this problem" selects the sibling tab whose id is `technical` (pass `onOpenTechnical` to override).

## Checking it locally

```
npx caos-shell-gate --serve dist --expect-brand <Brand> --routes /introduction
```

`validateExecutive(data)` (exported by the package; call it in a unit test of the product) returns the list of `{ path, message }`
problems (empty when valid). The gate, on `/introduction`, checks that the executive view is the first and default view; that the
`ExecutiveView` is present, in the executive view, with `data-executive-schema="2.0.0"` and `data-executive-valid="true"`; the
landing block; the five sub-tabs by title and order, each visited in both languages, each opening with its key message line; every
floor on the rendered rows; the 4 C's with their names and definitions; the writing limits and the no-client, no-promotion wording
on the rendered text; that no rubric label or question is printed; that no section, text or equation sits beside the view; that
the fields are readable; the numbered source notes, each a link; the two onward links; the full width of the view and of the
lede; and for each illustration its place, its caption, that it is inline, loaded, token-coloured, free of `data-chart`, and that
every label sits inside its `viewBox` and is not too small; for the flip groups and the carousel, G16 (`docs/07_gate.md`); for an animated
illustration, G17. It also keeps the older checks: the contrast of the text, and the
labels of the drawing against each other, in the wide font.

The view cannot be waived, as a whole or in part: a `floorWaivers` entry naming it is refused.

## Where it is enforced

| Place | What it does |
|---|---|
| CAOS_APP_SHELL | Owns `executive.schema.json`, `ExecutiveView`, `Landing` and the gate check above. |
| CAOS_PRODUCT_TEMPLATE | Its example carries a filled `content/executive.json` and renders `ExecutiveView`; `check_sdd.py` fails a product whose file is missing or invalid. |
| CAOS_MANAGE `tools/agents/sizing_check.py` | A product sizing names the data file and fails when it is missing or invalid against the shell schema. |
| Release review | A reviewer reads the rendered view: each section says what its row above says, in executive language, general, never tied to a client and never a pitch. |
