- Executive view data schema 2.0.0 (breaking): each `sources` entry is `{ field, title, url, note? }`. A source is always a
  link: `url` is required and `https://` only, `title` is the publication in plain words, `note` is at most one sentence. The
  notes render the title as a link to the url, then the note. The validator and the gate fail a source without a url, with a
  non-https url, over the writing limits, or citing a file name or number in place of the link (`file 7`, `archivo 7`, a
  `.pdf` name, "Published on"). `docs/06_executive-view.md` has the rule.
- The executive view shows its sections as the sub-tabs of `SubTabs`, the first selected, the source notes below them and
  always visible. The sections come from one definition, `EXEC_SECTION_DEFS` in `executive.ts`; the gate visits every sub-tab
  in both languages, applies the illustration and writing checks to each, and fails a sub-tab it never visited, sections not
  in sub-tabs, or more than one section shown at once. The section structure itself (titles, fields, the 4 C's) is unchanged
  here and is redefined in a follow-up.
- The view is general, never a client, never a pitch: the validator and the gate fail promotional or client-bound wording
  ("our client", "nuestro cliente", "contact us", "contáctenos", "buy", "comprar", "price", "precio", "offer", "oferta" and
  their plurals, whole words, either case) in any text field; one gate plant per word.
- Full width: the lede of every `DocPage` takes the full width of the document column (the 70ch measure on `.lede` is gone) and
  the executive view takes the full width of the column too (an illustration may stay centred inside its figure). A browser
  test measures both at 1280 and 1600 px; the gate fails a lede or an executive block narrower than the column (plants
  `lede-narrow`, `exec-narrow`). In the shell's own browser harness only the lede was narrow; the executive blocks already
  filled the column, so a narrower Introduction in a product comes from the product's own CSS or a non-prose wrapper.
- Landing (breaking for the router of a product): every product lands on the Introduction with its executive view open. New
  exports `Landing`, `LANDING_ROUTE` and `APP_ROUTE`; `STANDARD_ROUTES` is now Introduction (`/introduction`), App (`/app`),
  Methodology, Implementation, Experiments, Benchmark. A product changes its router once: `/` and `*` render `<Landing />`, `/app`
  renders the App, `fixedRoutes` names `/app`, a static site materialises `app/index.html` (`docs/06_executive-view.md`, The
  landing). An old App link such as `/?case=B2#x` is forwarded to `/app?case=B2#x`. The gate default `--workbench` is `/app`,
  checks that the root opens the Introduction on its executive view and that an old App link keeps its query string and hash
  (plant `landing-app`).
