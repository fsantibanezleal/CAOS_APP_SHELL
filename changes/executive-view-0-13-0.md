- The executive view is redefined (schema 2.0.0, breaking): it frames the industry's problem for a decision maker, general,
  never tied to a client and never a pitch (CAOS_MANAGE `conventions/problem-context-first.md`, decided 2026-10-13). The data file
  is `title`, `key_statement`, `headline_figures` (2 or 3: heading, value, unit, source), one object per sub-tab (`pain`,
  `context`, `situation`, `trends`, `proposal`, each with its `key_message` and its supporting fields at the floors of the
  structure as minimum and maximum counts of rows), the three `illustrations` `pain`, `situation` and `proposal`, and `sources`.
  The 0.12.0 fields (`executive`, `organisation`, `initiative`, `why_now`, `vision`, `outcomes`, a top-level `four_cs`,
  `dialogue`) are gone; a product rewrites its `content/executive.json` and its three illustrations (`docs/06_executive-view.md`
  has the fields, the floors and the writing limits).
- The view shows a landing block (the title, the key statement, the headline figures) above five sub-tabs titled "The pain",
  "The context", "The current situation", "The trends", "The proposal" (Spanish "El problema", "El contexto", "La situación
  actual", "Las tendencias", "La propuesta"), each opening with its key message line, then the numbered linked sources and two
  onward links ("How the work explores this problem", "Open the App"). The sections come from one definition,
  `EXEC_SECTION_DEFS` in `executive.ts`. No rubric label and no rubric question is printed; the gate fails a view that prints one.
- The 4 C's are required in the proposal: `FOUR_CS` holds Choice, Context, Cost and Control with Felipe's definitions in English
  and Spanish (2026-10-13), `proposal.four_cs` has exactly those four rows in that order, each with `applies` (what the C means
  for the proposal). The pending state of section 3 is gone.
- Sources are links: each `sources` entry is `{ id, title, url, note? }` with an https `url`; every figure and every claim of the
  state of the art and of the trends cites one by id, every source is cited, and the notes number in the order of first use. The
  validator and the gate fail a source without a url, with a non-https url, over the writing limits, or citing a file name or
  number in place of the link (`file 7`, `archivo 7`, a `.pdf` name, "Published on").
- Extra rules of the validator, mirrored by the gate on the rendered page: the causes' weights add to at most 100; each action's
  owner is a role of the current situation; a paragraph has at least 25 words; one sentence for the key messages, captions,
  actions and checks, two for the key statement.
- General, never a client, never a pitch: the validator and the gate fail promotional or client-bound wording ("our client",
  "nuestro cliente", "contact us", "contáctenos", "buy", "comprar", "price", "precio", "offer", "oferta" and their plurals, whole
  words, either case) in any text field; one gate plant per word.
- Gate: it gathers the facts of every sub-tab it visits (both languages) and checks the landing block, the five sub-tabs, the key
  message lines, every floor on the rendered rows, the 4 C's, the sources, the onward links, the rubric text, the full width and the
  illustrations; about fifty executive plants. The `G5: shrunk-tabs` plant is repaired (below).
- Full width: the lede of every `DocPage` takes the full width of the document column (the 70ch measure on `.lede` is gone) and the
  executive view takes the full width of the column too (an illustration may stay centred inside its figure). A browser test
  measures both at 1280 and 1600 px; the gate fails a lede or an executive block narrower than the column (plants `lede-narrow`,
  `exec-narrow`). In the shell's own browser harness only the lede was narrow; a narrower Introduction in a product comes from the
  product's own CSS or a non-prose wrapper.
- Landing (breaking for the router of a product): every product lands on the Introduction with its executive view open. New
  exports `Landing`, `LANDING_ROUTE` and `APP_ROUTE`; `STANDARD_ROUTES` is now Introduction (`/introduction`), App (`/app`),
  Methodology, Implementation, Experiments, Benchmark. A product changes its router once: `/` and `*` render `<Landing />`, `/app`
  renders the App, `fixedRoutes` names `/app`, a static site materialises `app/index.html` (`docs/06_executive-view.md`, The
  landing). An old App link such as `/?case=B2#x` is forwarded to `/app?case=B2#x`. The gate default `--workbench` is `/app`,
  checks that the root opens the Introduction on its executive view and that an old App link keeps its query string and hash
  (plant `landing-app`); its static server keeps the query string through its trailing-slash redirect.
- The gate plant `G5: shrunk-tabs` failed on develop and on the 0.12.0 release commit in the current Chromium (153.0.8010.12): the
  plant shrinks the tab row with a flex rule, which that Chromium absorbs without overflowing the tabs, so the gate's cut measure
  read zero. The plant now also caps the row's height below its tabs, which reproduces the cut that known shell defect 16 describes;
  the gate's measure is unchanged.
