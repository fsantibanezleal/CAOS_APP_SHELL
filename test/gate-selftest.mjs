// G15: the gate proves itself. The fixture product (test/gate-fixture) is built once and served as GitHub Pages
// serves a site; the gate must pass it clean in the full matrix, and every planted defect must make the check that
// owns it fail with its own message. A check that cannot fail on its plant is a check that agrees with a broken
// app (failure class 10). Run with `npm run test:gate` (needs playwright and its chromium).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';
import { buildFixture, makePlant } from './gate-fixture/build.mjs';
import { runGate } from '../gate/run.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = join(root, '.gate-selftest');
const clean = join(work, 'clean');
const BRAND = 'GateFixture';
const QUICK = { sizes: '1280x800', themes: 'light', langs: 'en', idleMs: 600, wideFont: false };

/** The options of a product whose App is a surface (shell 0.16.0): the route `/console` of the fixture, walked as the App route. */
const SURF = { routes: '/console', workbench: '', appRoute: '/console' };

/** One plant per check (and per distinct trap inside a check); `expect` must appear among the failures. */
const PLANTS = [
  { id: 'landing-app', check: 'G4', re: /the root opened \/, not the Introduction/, opts: { routes: '/introduction' } },
  { id: 'brand', check: 'G1', re: /not "GateFixture"/ },
  { id: 'mode-theme', check: 'G2', re: /data-theme=dark/, opts: { routes: '/app,/introduction' } },
  { id: 'mode-lang', check: 'G2', re: /<html lang> is en/, opts: { langs: 'es', routes: '/app,/introduction' } },
  { id: 'console', check: 'G3', re: /planted: the methodology page fails/, opts: { routes: '/app,/methodology' } },
  { id: 'http404', check: 'G3', re: /HTTP 404 for .*missing\.json/, opts: { routes: '/app,/benchmark' } },
  { id: 'case-only', check: 'G3', re: /planted: the high-contact case fails/, trail: /case c-high/, opts: { routes: '/app' } },
  { id: 'deeplink', check: 'G4', re: /methodology answered 404/, opts: { routes: '/app,/methodology' } },
  { id: 'fallback-json', check: 'G4', re: /artifact.json did not answer JSON/, opts: { routes: '/app,/benchmark' } },
  { id: 'thin-doc', check: 'G4', re: /characters of text/, opts: { routes: '/app,/experiments' } },
  { id: 'missing-200', check: 'G4', re: /a missing asset answered 200/, server: 'spa', opts: { routes: '/app' } },
  { id: 'clip', check: 'G5', re: /cuts \d+px of content/, opts: { routes: '/app,/introduction' } },
  { id: 'hoverflow', check: 'G5', re: /cuts \d+px of content horizontally|scrolls sideways/, opts: { routes: '/app,/introduction' } },
  { id: 'mobile-only', check: 'G5', re: /horizontal overflow|outside the viewport|scrolls sideways/, mode: /^390x844/, opts: { sizes: '390x844,1280x800', routes: '/app,/introduction' } },
  { id: 'covered', check: 'G5', re: /is covered by/, opts: { routes: '/app' } },
  { id: 'rail-overflow', check: 'G5', re: /outside the rail/, opts: { routes: '/app' } },
  { id: 'truncated', check: 'G5', re: /truncated text/, opts: { routes: '/app' } },
  // shell 0.17.0 (round 3): the case select shows the name whole at any length; a product stylesheet that clamps the display's text, or a display that
  // names another case than the one the select holds, is a cut or stale case name. The names are the consumer trial's (three lines in the rail).
  { id: 'select-cut', check: 'G5', re: /select\(s\) cut the selected text.*cuts the case name "Lifetime PD, IFRS 9 staging/, opts: { routes: '/app' } },
  { id: 'select-cut-display', check: 'G5', re: /select\(s\) cut the selected text.*cuts the case name "Lifetime PD, IFRS 9 staging[^"]*" in its display/, opts: { routes: '/app' } },
  { id: 'select-cut-token', check: 'G5', re: /select\(s\) cut the selected text.*cuts the case name "fragmenta_escondida_bench/, opts: { routes: '/app' } },
  { id: 'select-display-stale', check: 'G5', re: /select\(s\) cut the selected text.*shows "A planted stale display name" while the select holds "[^"]+" \(a stale display\)/, opts: { routes: '/app' } },
  // the review of 0.17.0: a product's own plain select whose text fits its content box by 2px and ends under the native arrow (M1); the Focus rail's select is cut (M2)
  { id: 'select-arrow', check: 'G5', re: /select\(s\) cut the selected text.*Low contact.*arrow/, opts: { routes: '/app' } },
  { id: 'select-focus-rail', check: 'G5', re: /select\(s\) cut the selected text.*cuts the case name "Lifetime PD, IFRS 9 staging/, trail: /Focus/, opts: { routes: '/app', requireFocus: true } },
  { id: 'deep-defect', check: 'G5', re: /scrolls sideways/, trail: /validation > table/, opts: { routes: '/app' } },
  { id: 'shrunk-tabs', check: 'G5', re: /cuts its tabs by \d+px/, trail: /validation > daily/, opts: { routes: '/app' } },
  { id: 'blank', check: 'G6', re: /is blank/, opts: { routes: '/app' } },
  { id: 'small', check: 'G6', re: /draws on \d+% of its stage/, opts: { routes: '/app' } },
  { id: 'stage-floor', check: 'G6', re: /the drawing of .* keeps \d+ px under its note \(floor 140 px\)/, opts: { routes: '/app' } },
  { id: 'repeat-ticks', check: 'G6', re: /axis tick label\(s\) repeat the label before them/, opts: { routes: '/app' } },
  // shell 0.18.0: a chart's named x ticks are measured as its other ticks are: two ticks with one name fail G6
  { id: 'named-ticks-repeat', check: 'G6', re: /named x tick label\(s\) repeat another tick's label \("deduplicated"\)/, opts: { routes: '/app' } },
  // the review of 0.18.0 (M1): a name used by the first and the last tick, not neighbours, is a repeat too
  { id: 'named-ticks-far', check: 'G6', re: /named x tick label\(s\) repeat another tick's label \("random"\)/, opts: { routes: '/app' } },
  // shell 0.19.0 (G20): every chart is a tab stop with a name, a table of its values and a reset; a chart that turns zoom off says why
  { id: 'bar-repeat-ticks', check: 'G6', re: /axis tick label\(s\) repeat the label before them/, opts: { routes: '/app' } },
  { id: 'chart-not-focusable', check: 'G20', re: /\(line chart\): the plot is not a tab stop \(tabindex is below 0\)/, opts: { routes: '/app' } },
  { id: 'chart-no-name', check: 'G20', re: /the plot has no accessible name/, opts: { routes: '/app' } },
  { id: 'chart-no-table', check: 'G20', re: /the plot is not linked to a data table/, opts: { routes: '/app' } },
  { id: 'chart-no-reset', check: 'G20', re: /the \+ key does not zoom the chart/, opts: { routes: '/app' } },
  // the review of 0.19.0 (m3, m4, M5): the control hidden, the `0` key alone swallowed, the arrows, the brush, and a reason empty in one language
  { id: 'chart-reset-hidden', check: 'G20', re: /a zoomed chart shows 0 reset controls/, opts: { routes: '/app' } },
  { id: 'chart-no-zero', check: 'G20', re: /the 0 key does not reset the zoom/, opts: { routes: '/app' } },
  { id: 'chart-no-arrows', check: 'G20', re: /the arrow keys do not move the crosshair/, opts: { routes: '/app' } },
  { id: 'chart-dead-brush', check: 'G20', re: /a drag across the plot does not zoom the chart \(the brush is dead\)/, opts: { routes: '/app' } },
  { id: 'zoom-off-empty', check: 'G20', re: /zoom is turned off with a reason of fewer than 12 letters and digits \(""\)/, opts: { routes: '/app', langs: 'es' } },
  { id: 'zoom-off-unexplained', check: 'G20', re: /zoom is turned off with a reason of fewer than 12 letters and digits \("no"\)/, opts: { routes: '/app' } },
  { id: 'never-ready', check: 'G7', re: /data-state="loading"/, opts: { routes: '/app,/benchmark', settleMs: 3000 } },
  { id: 'raf-loop', check: 'G8', re: /animation frames/, opts: { routes: '/app' } },
  { id: 'mutation-loop', check: 'G8', re: /DOM mutations/, opts: { routes: '/app' } },
  { id: 'dead-knob', check: 'G9', re: /control "scale" did not change the selection key/, opts: { routes: '/app' } },
  { id: 'wrong-case', check: 'G9', re: /asked for case [\w-]+; the workbench shows/, opts: { routes: '/app' } },
  { id: 'no-controls', check: 'G9', re: /no registered control/, opts: { routes: '/app' } },
  { id: 'stuck-view', check: 'G9', re: /did not settle|keep an earlier selection key/, opts: { routes: '/app', settleMs: 3000 } },
  { id: 'label-cut', check: 'G10', re: /"planted label past the edge" is cut by \d+px/, trail: /validation > table/, opts: { routes: '/app' } },
  { id: 'label-overlap', check: 'G10', re: /"first planted label" and "second planted label" overlap/, trail: /validation > table/, opts: { routes: '/app' } },
  { id: 'label-wide', check: 'G10', re: /"a label sized for a narrow font only" is cut/, mode: /wide-font/, opts: { routes: '/app,/introduction', wideFont: true, wideFontSizes: '1280x800' } },
  { id: 'decimal-point', check: 'G11', re: /writes 0\.25 with a decimal point/, also: /writes 2\.7e-08 with a decimal point/, opts: { langs: 'es', routes: '/app,/introduction' } },
  { id: 'value-broken', check: 'G19', re: /"35%" breaks across \d lines/, opts: { routes: '/app,/introduction' } },
  { id: 'value-broken-range', check: 'G19', re: /"599-653" breaks across \d lines/, opts: { routes: '/app,/introduction' } },
  { id: 'sticky-off', check: 'G12', re: /active sub-tab .* is out of view/, opts: { routes: '/app,/implementation' } },
  { id: 'refs-mid', check: 'ADR-0017.4', re: /references must be the last block of the page or tab/, opts: { routes: '/app,/introduction' } },
  { id: 'refs-missing', check: 'ADR-0017.4', re: /cite references the page never lists/, opts: { routes: '/app,/introduction' } },
  { id: 'unavailable-unexplained', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-short', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-beside-blank', check: 'G6', re: /is blank/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-hidden', check: 'G6', re: /nothing is drawn in the instrument/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-opacity', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-zero', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-offscreen', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-sronly', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-fontsize', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-clippath', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-textindent', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-tinyfont', check: 'G6', re: /no reader can see the note/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-punct', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-hidden-text', check: 'G6', re: /data-state="unavailable".*reason/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-collapsed-chart', check: 'G6', re: /a drawing is present but not visible/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'unavailable-invisible-chart', check: 'G6', re: /a drawing is present but not visible/, trail: /pending/, opts: { routes: '/app' } },
  { id: 'low-contrast', check: 'G13', re: /contrast \d\.\d\d:1, below 4\.5:1/, opts: { routes: '/app,/introduction' } },
  // ADR-0017 2.1: the required areas of the documentation pages; each fails with its own floor
  { id: 'floor-no-executive', check: 'ADR-0017.2', re: /no executive view; the top-level topics are \[none\]/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-second', check: 'ADR-0017.2', re: /the executive view is not the first topic \(the first is "technical"\)/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-equation', check: 'ADR-0017.2', re: /executive view \(EN\): 1 equation\(s\); the executive view holds no equation/, opts: { routes: '/introduction' } },
  { id: 'floor-five-sections', check: 'ADR-0017.2', re: /no section declares the area "math"/, opts: { routes: '/introduction' } },
  { id: 'floor-glossary-nine', check: 'ADR-0017.2', re: /math area.*9 glossary items, the floor is 10/, opts: { routes: '/introduction' } },
  { id: 'floor-pipeline-unordered', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-honesty-none', check: 'ADR-0017.2', re: /honesty area.*0 honest callouts, exactly 1 is required/, opts: { routes: '/introduction' } },
  { id: 'floor-area-unknown', check: 'ADR-0017.2', re: /declares the unknown area "extras"/, opts: { routes: '/introduction' } },
  { id: 'floor-method-topics', check: 'ADR-0017.2', re: /Methodology \(EN\): 5 topics, the floor is 6/, opts: { routes: '/methodology' } },
  { id: 'floor-method-dense', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 3 dense paragraphs, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-method-equations', check: 'ADR-0017.2', re: /method area, topic "Numerics" \(EN\): 1 captioned equation, the floor is 2/, opts: { routes: '/methodology' } },
  { id: 'floor-method-figure', check: 'ADR-0017.2', re: /method area, topic "Numerics" \(EN\): 0 figures with a caption, the floor is 1/, opts: { routes: '/methodology' } },
  { id: 'floor-method-honest', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 2 honest callouts, exactly 1 is required/, opts: { routes: '/methodology' } },
  { id: 'floor-method-learned', check: 'ADR-0017.2', re: /Methodology \(EN\): 1 topic of kind learned, the floor is 2/, opts: { routes: '/methodology' } },
  { id: 'floor-lede-short', check: 'ADR-0017.2', re: /Experiments \(EN\): the lede holds 3 word\(s\), the floor is 35/, opts: { routes: '/experiments' } },
  { id: 'floor-impl-architecture', check: 'ADR-0017.2', re: /no section declares the area "architecture"/, opts: { routes: '/implementation' } },
  { id: 'floor-exp-datasets', check: 'ADR-0017.2', re: /no section declares the area "datasets"/, opts: { routes: '/experiments' } },
  { id: 'floor-bench-caveat', check: 'ADR-0017.2', re: /no section declares the area "caveat"/, opts: { routes: '/benchmark' } },
  { id: 'floor-es-area', check: 'ADR-0017.2', re: /Implementation \(ES\): no section declares the area "lanes"/, opts: { routes: '/implementation', langs: 'es' } },
  { id: 'floor-waiver-reason', check: 'ADR-0017.2', re: /the waiver for "comparison" has a reason of 5 character/, opts: { routes: '/benchmark' } },
  { id: 'floor-waiver-unknown', check: 'ADR-0017.2', re: /the waiver for "nonsense" is refused/, opts: { routes: '/benchmark' } },
  { id: 'floor-hidden', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 2 dense paragraphs, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-duplicate', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 1 dense paragraph, the floor is 4/, opts: { routes: '/methodology' } },
  { id: 'floor-waiver-other', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, not: /(math area|area "math")/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-filler', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  // 0.11.0 gate review: what a reader cannot read, whatever the box says; the views; the visible parts of a statement, item or step
  { id: 'area-hidden-textindent', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-tinyfont', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'area-hidden-clippath', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
  { id: 'floor-exec-not-default', check: 'ADR-0017.2', re: /the executive view is not the view the page opens on \(it opens on "technical"\)/, opts: { routes: '/introduction' } },
  { id: 'floor-math-outside', check: 'ADR-0017.2', re: /section "The governing mathematics" sits outside the two views/, also: /executive view \(EN\): 3 equation\(s\); the executive view holds no equation/, opts: { routes: '/introduction' } },
  { id: 'floor-glossary-hidden', check: 'ADR-0017.2', re: /math area.*1 glossary item, the floor is 10/, opts: { routes: '/introduction' } },
  { id: 'floor-steps-hidden', check: 'ADR-0017.2', re: /pipeline area.*1 step in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-steps-empty', check: 'ADR-0017.2', re: /pipeline area.*0 steps in an ordered list, the floor is 4/, opts: { routes: '/introduction' } },
  { id: 'floor-waiver-punct', check: 'ADR-0017.2', re: /the waiver for "comparison" has a reason of 12 character/, opts: { routes: '/benchmark' } },
  { id: 'floor-exec-transparent-es', check: 'G13', re: /contrast 1\.00:1/, mode: /light es$/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'floor-method-norefs', check: 'ADR-0017.2', re: /method area, topic "Theory" \(EN\): 0 references cited, the floor is 1/, opts: { routes: '/methodology' } },
  { id: 'floor-live-button', check: 'ADR-0017.2', re: /live area.*0 controls, the floor is 1/, opts: { routes: '/benchmark' } },
  // 0.13.0: the executive view frames the industry's problem for a decision maker (problem-context-first.md); it is the shell's ExecutiveView on content/executive.json
  { id: 'exec-invalid-data', check: 'ADR-0017.2', re: /the data file is not valid in the page: title: is required and missing.*tagline/, opts: { routes: '/introduction' } },
  // the floors of the structure, one plant each
  { id: 'exec-headline-one', check: 'ADR-0017.2', re: /the data file is not valid in the page: headline_figures: needs at least 2 item\(s\), has 1/, opts: { routes: '/introduction' } },
  { id: 'exec-headline-four', check: 'ADR-0017.2', re: /the data file is not valid in the page: headline_figures: allows at most 3 item\(s\), has 4/, opts: { routes: '/introduction' } },
  { id: 'exec-pain-one-paragraph', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.paragraphs: needs at least 2 item\(s\), has 1/, opts: { routes: '/introduction' } },
  { id: 'exec-pain-bearers-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.bearers: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-pain-figures-one', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.figures: needs at least 2 item\(s\), has 1/, opts: { routes: '/introduction' } },
  { id: 'exec-pain-causes-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.causes: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-pain-causes-over', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.causes: the weights add to 180 percent/, opts: { routes: '/introduction' } },
  { id: 'exec-context-forces-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: context\.forces: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-context-no-evidence', check: 'ADR-0017.2', re: /the data file is not valid in the page: context\.evidence: needs at least 1 item\(s\), has 0/, opts: { routes: '/introduction' } },
  { id: 'exec-situation-roles-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: situation\.roles: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-situation-sota-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: situation\.state_of_the_art: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-situation-no-status', check: 'ADR-0017.2', re: /the data file is not valid in the page: situation\.status: is required and missing/, opts: { routes: '/introduction' } },
  { id: 'exec-trends-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: trends\.items: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-trend-kind', check: 'ADR-0017.2', re: /the data file is not valid in the page: trends\.items\[0\]\.kind: must be one of regulatory, technological, market, practice/, opts: { routes: '/introduction' } },
  { id: 'exec-trend-horizon', check: 'ADR-0017.2', re: /the data file is not valid in the page: trends\.items\[0\]\.horizon: must be one of now, two_years, ten_years/, opts: { routes: '/introduction' } },
  { id: 'exec-trend-no-signal-source', check: 'ADR-0017.2', re: /the data file is not valid in the page: trends\.items\[0\]\.signal\.source: is required and missing/, opts: { routes: '/introduction' } },
  { id: 'exec-proposal-actions-two', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.actions: needs at least 3 item\(s\), has 2/, opts: { routes: '/introduction' } },
  { id: 'exec-proposal-no-risks', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.risks: needs at least 1 item\(s\), has 0/, opts: { routes: '/introduction' } },
  { id: 'exec-proposal-no-unknowns', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.unknowns: needs at least 1 item\(s\), has 0/, opts: { routes: '/introduction' } },
  { id: 'exec-action-owner-stranger', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.actions\[0\]\.owner: must be one of the roles of the current situation/, opts: { routes: '/introduction' } },
  { id: 'exec-key-message-missing', check: 'ADR-0017.2', re: /the data file is not valid in the page: context\.key_message: is required and missing/, opts: { routes: '/introduction' } },
  { id: 'exec-paragraph-short', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.paragraphs\[0\]\.en: has 8 words; a paragraph needs at least 25/, opts: { routes: '/introduction' } },
  // the 4 C's of the proposal
  { id: 'exec-four-cs-fifth', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.four_cs: allows at most 4 item\(s\), has 5/, opts: { routes: '/introduction' } },
  { id: 'exec-four-cs-missing', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.four_cs: is required and missing/, opts: { routes: '/introduction' } },
  { id: 'exec-four-cs-renamed', check: 'ADR-0017.2', re: /the data file is not valid in the page: .*proposal\.four_cs\[1\]\.c: must be "Context" in English/, opts: { routes: '/introduction' } },
  { id: 'exec-four-cs-reordered', check: 'ADR-0017.2', re: /the data file is not valid in the page: .*proposal\.four_cs\[0\]\.c: must be "Choice" in English/, opts: { routes: '/introduction' } },
  { id: 'exec-four-cs-no-applies', check: 'ADR-0017.2', re: /the data file is not valid in the page: proposal\.four_cs\[2\]\.applies: is required and missing/, opts: { routes: '/introduction' } },
  // the sources are links, and every claim cites one
  { id: 'exec-source-no-url', check: 'ADR-0017.2', re: /the data file is not valid in the page: sources\[0\]\.url: is required and missing/, opts: { routes: '/introduction' } },
  { id: 'exec-source-http', check: 'ADR-0017.2', re: /the data file is not valid in the page: sources\[0\]\.url: must be an https:\/\/ link/, opts: { routes: '/introduction' } },
  { id: 'exec-source-file-citation', check: 'ADR-0017.2', re: /the data file is not valid in the page: .*sources\[0\]\.note\.en: cites a file name or number in place of the link/, opts: { routes: '/introduction' } },
  { id: 'exec-source-unknown-id', check: 'ADR-0017.2', re: /the data file is not valid in the page: pain\.figures\[0\]\.source: "nothing" is not the id of any source/, opts: { routes: '/introduction' } },
  { id: 'exec-source-uncited', check: 'ADR-0017.2', re: /the data file is not valid in the page: sources\[7\]\.id: "spare" is cited by no figure/, opts: { routes: '/introduction' } },
  { id: 'exec-note-no-link', check: 'ADR-0017.2', re: /executive view \(EN\): source note 1 has no link/, opts: { routes: '/introduction' } },
  // the sub-tabs, the key messages, the landing block and the onward links
  { id: 'exec-sections-stacked', check: 'ADR-0017.2', re: /executive view \(EN\): the sections are not sub-tabs/, also: /executive view \(EN\): 5 sections shown at once/, opts: { routes: '/introduction' } },
  { id: 'exec-tab-unreachable', check: 'ADR-0017.2', re: /executive view \(EN\): sub-tab "The context" was never visited/, also: /executive view \(EN\): sub-tab "The proposal" was never visited/, opts: { routes: '/introduction' } },
  { id: 'exec-key-not-first', check: 'ADR-0017.2', re: /executive view \(EN\): section 1 \("The pain"\) does not open with its key message line/, opts: { routes: '/introduction' } },
  { id: 'exec-no-landing', check: 'ADR-0017.2', re: /executive view \(EN\): no landing block above the sub-tabs/, opts: { routes: '/introduction' } },
  { id: 'exec-links-missing', check: 'ADR-0017.2', re: /executive view \(EN\): no onward link to the technical view/, also: /executive view \(EN\): no onward link to the App/, opts: { routes: '/introduction' } },
  { id: 'exec-link-wording', check: 'ADR-0017.2', re: /executive view \(EN\): the onward link to the technical view reads "Read more", expected "How the work explores this problem"/, opts: { routes: '/introduction' } },
  // the rubric's labels and questions are never printed
  { id: 'exec-rubric-label', check: 'ADR-0017.2', re: /executive view \(EN\): prints the rubric's label \"AI Transformation Story\"/, opts: { routes: '/introduction' } },
  { id: 'exec-rubric-label-es', check: 'ADR-0017.2', re: /executive view \(ES\): prints the rubric's label \"Posicionamiento 4C\"/, opts: { routes: '/introduction', langs: 'es' } },
  { id: 'exec-rubric-question', check: 'ADR-0017.2', re: /executive view \(EN\): prints the rubric's question \"Built for a C-suite exec\?\"/, opts: { routes: '/introduction' } },
  { id: 'exec-rubric-question-es', check: 'ADR-0017.2', re: /executive view \(ES\): prints the rubric's question \"¿Confiaría en ellos frente a un ejecutivo\?\"/, opts: { routes: '/introduction', langs: 'es' } },
  // the view is general, never a client, never a pitch: one plant per promotional or client-bound word
  { id: 'exec-promo-our-client', check: 'ADR-0017.2', re: /executive view \(EN\): field "pain\.key_message": holds promotional or client-bound wording \("our client"\)/i, opts: { routes: '/introduction', langs: 'en' } },
  { id: 'exec-promo-nuestro-cliente', check: 'ADR-0017.2', re: /executive view \(ES\): field "pain\.key_message": holds promotional or client-bound wording \("nuestro cliente"\)/i, opts: { routes: '/introduction', langs: 'es' } },
  { id: 'exec-promo-contact-us', check: 'ADR-0017.2', re: /executive view \(EN\): field "pain\.key_message": holds promotional or client-bound wording \("contact us"\)/i, opts: { routes: '/introduction', langs: 'en' } },
  { id: 'exec-promo-contactenos', check: 'ADR-0017.2', re: /executive view \(ES\): field "pain\.key_message": holds promotional or client-bound wording \("contáctenos"\)/i, opts: { routes: '/introduction', langs: 'es' } },
  { id: 'exec-promo-buy', check: 'ADR-0017.2', re: /executive view \(EN\): field "pain\.key_message": holds promotional or client-bound wording \("buy"\)/i, opts: { routes: '/introduction', langs: 'en' } },
  { id: 'exec-promo-comprar', check: 'ADR-0017.2', re: /executive view \(ES\): field "pain\.key_message": holds promotional or client-bound wording \("comprar"\)/i, opts: { routes: '/introduction', langs: 'es' } },
  { id: 'exec-promo-price', check: 'ADR-0017.2', re: /executive view \(EN\): field "pain\.key_message": holds promotional or client-bound wording \("price"\)/i, opts: { routes: '/introduction', langs: 'en' } },
  { id: 'exec-promo-precio', check: 'ADR-0017.2', re: /executive view \(ES\): field "pain\.key_message": holds promotional or client-bound wording \("precio"\)/i, opts: { routes: '/introduction', langs: 'es' } },
  { id: 'exec-promo-offer', check: 'ADR-0017.2', re: /executive view \(EN\): field "pain\.key_message": holds promotional or client-bound wording \("offer"\)/i, opts: { routes: '/introduction', langs: 'en' } },
  { id: 'exec-promo-oferta', check: 'ADR-0017.2', re: /executive view \(ES\): field "pain\.key_message": holds promotional or client-bound wording \("oferta"\)/i, opts: { routes: '/introduction', langs: 'es' } },
  // the full width of the lede and of the view
  { id: 'lede-narrow', check: 'ADR-0017.2', re: /Introduction \(EN\): the lede is \d+px wide in a \d+px document column; the lede takes the full width of the column/, opts: { routes: '/introduction' } },
  { id: 'exec-narrow', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ block\(s\) narrower than the \d+px document column/, opts: { routes: '/introduction' } },
  // the old areas and the blocks a product must not add beside the view
  { id: 'exec-old-areas', check: 'ADR-0017.2', re: /declares the unknown area "initiative"/, also: /no ExecutiveView \(\[data-executive-view\]\)/, opts: { routes: '/introduction' } },
  { id: 'exec-fifth-section', check: 'ADR-0017.2', re: /executive view \(EN\): 1 DocSection\(s\) placed in the executive view \(A fifth section\); the view has exactly its sections and takes none/, opts: { routes: '/introduction' } },
  { id: 'exec-stranger-text', check: 'ADR-0017.2', re: /executive view \(EN\): 1 block\(s\) beside the ExecutiveView \("A paragraph a product placed beside the executive/, opts: { routes: '/introduction' } },
  // the writing limits, on the rendered page
  { id: 'exec-long-sentence', check: 'ADR-0017.2', re: /Introduction, executive view \(EN\): field "pain\.key_message": a sentence of 31 words; the limit is 30/, also: /Introduction, executive view \(ES\): field "pain\.key_message": a sentence of 31 words/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'exec-es-only-long', check: 'ADR-0017.2', re: /Introduction, executive view \(ES\): field "pain\.key_message": a sentence of 31 words; the limit is 30/, opts: { routes: '/introduction', langs: 'en,es' } },
  { id: 'exec-citation-inline', check: 'ADR-0017.2', re: /field "pain\.key_message": holds an inline citation/, opts: { routes: '/introduction' } },
  { id: 'exec-equation-text', check: 'ADR-0017.2', re: /field "pain\.key_message": holds an equation or a TeX marker/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-colour', check: 'ADR-0017.2', re: /illustration "pain" uses literal colour\(s\) fill: #1f77b4|illustration "pain" uses literal colour\(s\) stroke: #1f77b4/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-chart', check: 'ADR-0017.2', re: /illustration "situation" declares a chart \(data-chart\)/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-label-outside', check: 'ADR-0017.2', re: /illustration "pain": label\(s\) outside the viewBox: "Past the edge of the drawing"/, opts: { routes: '/introduction' } },
  { id: 'exec-illustration-missing', check: 'ADR-0017.2', re: /illustration "proposal": the file "executive\/proposal\.svg" did not load/, opts: { routes: '/introduction' } },
  // shell 0.14.0: flip cards, the card carousel, animated illustrations and Focus mode for the App (G16, G17, G18)
  { id: 'flip-back-long', check: 'G16', re: /flip card "[^"]+": a back of \d+ words; the limit is 40/, opts: { routes: '/introduction' } },
  { id: 'flip-title-long', check: 'G16', re: /flip card "[^"]+": a title of \d+ words; the limit is 8/, opts: { routes: '/introduction' } },
  { id: 'flip-no-keyboard', check: 'G16', re: /flip card "[^"]+" does not turn with the keyboard/, opts: { routes: '/introduction' } },
  { id: 'flip-hidden-face', check: 'G16', re: /flip card "[^"]+": the hidden (face|back) is in the accessibility tree/, opts: { routes: '/introduction' } },
  { id: 'carousel-sideways', check: 'G16', re: /card deck "[^"]+": the carousel scrolls sideways/, opts: { routes: '/introduction' } },
  { id: 'carousel-stuck', check: 'G16', re: /card deck "[^"]+": card \d+ of \d+ cannot be reached/, opts: { routes: '/introduction' } },
  { id: 'anim-no-reduced', check: 'G17', re: /illustration "pain" is animated and has no @media \(prefers-reduced-motion: reduce\) block/, opts: { routes: '/introduction' } },
  { id: 'anim-keeps-moving', check: 'G17', re: /illustration "pain" keeps moving under reduced motion/, opts: { routes: '/introduction' } },
  { id: 'anim-too-long', check: 'G17', re: /illustration "pain" plays for 14 s; the limit is 10 s/, opts: { routes: '/introduction' } },
  { id: 'focus-loses-case', check: 'G18', re: /Focus mode of case c-\w+ shows case c-low/, opts: { routes: '/app' } },
  { id: 'focus-page-scroll', check: 'G18', re: /Focus mode of case c-\w+: the page scrolls/, opts: { routes: '/app' } },
  { id: 'focus-no-exit', check: 'G18', re: /Focus mode of case c-\w+: the exit control could not be used/, opts: { routes: '/app' } },
  { id: 'focus-chrome-covers', check: 'G18', re: /Focus mode of case c-\w+: the stage label covers the control/, opts: { routes: '/app' } },
  { id: 'focus-enter-inside', check: 'G18', re: /Focus mode of case c-\w+: the Focus control shows inside Focus mode/, opts: { routes: '/app' } },
  { id: 'focus-missing', check: 'G18', re: /the App offers no Focus control/, opts: { routes: '/app', requireFocus: true } },
  // the review of 0.14.0 (CAOS_MANAGE wip/app-shell/review-shell-0-14-0-2026-10-14.md): the misses of G16 to G18, Focus isolation, and the executive checks kept at their strength
  { id: 'flip-content-never-shows', check: 'G16', re: /flip card "[^"]+": the back shows no content after it turns/, opts: { routes: '/introduction' } },
  { id: 'flip-hidden-focusable', check: 'G16', re: /flip card "[^"]+": the hidden (face|back) holds a control the keyboard reaches/, opts: { routes: '/introduction' } },
  { id: 'carousel-no-controls', check: 'G16', re: /card deck "[^"]+": card \d+ of \d+ cannot be reached/, opts: { routes: '/introduction' } },
  { id: 'anim-img-no-block', check: 'G17', re: /illustration "figure \d+" is animated and has no @media \(prefers-reduced-motion: reduce\) block/, opts: { routes: '/introduction' } },
  { id: 'focus-drops-group', check: 'G18', re: /Focus mode of case c-\w+ shows group model, the App had \w+/, opts: { routes: '/app' } },
  { id: 'focus-drops-subview', check: 'G18', re: /Focus mode of case c-\w+ shows sub-view \w+, the App had \w+/, opts: { routes: '/app' } },
  { id: 'focus-not-isolated', check: 'G18', re: /Focus mode of case c-\w+: Tab leaves the Focus frame/, opts: { routes: '/app' } },
  { id: 'focus-nested-main', check: 'G18', re: /Focus mode of case c-\w+: the page holds a main inside a main/, opts: { routes: '/app' } },
  // shell 0.16.0: G18 on an App that is a surface (SurfacePage focus, TabDef.focus), one plant per failure of the workbench's Focus, with the view in place of the case and the group
  { id: 'surface-focus-missing', check: 'G18', re: /the surface App \(\/console\) offers no Focus control \(\[data-focus-enter\]\) on any of its 3 view\(s\)/, opts: { ...SURF, requireFocus: true } },
  { id: 'surface-focus-no-open', check: 'G18', re: /Focus mode of view \w+: the Focus control did not open Focus mode/, opts: SURF },
  { id: 'surface-focus-loses-view', check: 'G18', re: /Focus mode of view engine shows view runs, the App had engine/, opts: SURF },
  { id: 'surface-focus-drops-subview', check: 'G18', re: /Focus mode of view engine shows sub-view planted, the App had table/, opts: SURF },
  { id: 'surface-focus-url-no-view', check: 'G18', re: /Focus mode of view \w+: the URL \(\?focus=1\) does not hold \?focus=1 and the view/, opts: SURF },
  { id: 'surface-focus-page-scroll', check: 'G18', re: /Focus mode of view \w+: the page scrolls/, opts: SURF },
  { id: 'surface-focus-rail-scroll', check: 'G18', re: /Focus mode of view engine: the rail scrolls/, opts: SURF },
  { id: 'surface-focus-tabs-wrap', check: 'G18', re: /Focus mode of view engine: a tab row wraps onto 2 rows/, opts: SURF },
  { id: 'surface-focus-stage-small', check: 'G18', re: /Focus mode of view \w+: the stage covers \d+\.\d% of the viewport \(floor 50%\)/, opts: SURF },
  { id: 'surface-focus-no-exit', check: 'G18', re: /Focus mode of view \w+: the exit control could not be used/, opts: SURF },
  { id: 'surface-focus-chrome-covers', check: 'G18', re: /Focus mode of view engine: the stage label covers the control/, opts: SURF },
  { id: 'surface-focus-enter-inside', check: 'G18', re: /Focus mode of view engine: the Focus control shows inside Focus mode/, opts: SURF },
  { id: 'surface-focus-not-isolated', check: 'G18', re: /Focus mode of view \w+: Tab leaves the Focus frame/, opts: SURF },
  { id: 'surface-focus-nested-main', check: 'G18', re: /Focus mode of view \w+: the page holds a main inside a main/, opts: SURF },
  { id: 'surface-focus-return-wrong-view', check: 'G18', re: /Focus mode of view engine: back in the App on view overview, it was left on view engine/, opts: SURF },
  // the fix round after the review of 0.16.0 (CAOS_MANAGE wip/app-shell/review-shell-0-16-0-2026-10-19.md): F1 the tab row, F2 Escape on the only focusable view, F3 a renamed view parameter, F4 the App route walked
  { id: 'surface-headless-head', check: 'G18', re: /the surface's tab row or head moves between views \(view overview: row at [\d.]+px, [\d.]+px high, head 0px; view engine: row at [\d.]+px/, opts: SURF },
  { id: 'surface-focus-escape-one-view', check: 'G18', re: /Focus mode of view engine: Escape does not return to the App/, opts: SURF },
  { id: 'surface-mode-url-dropped', check: 'G18', re: /Focus mode of view \w+: the URL \(\?focus=1\) does not hold \?focus=1 and the view \(\?mode=\)/, opts: SURF },
  { id: 'surface-app-route-unwalked', check: 'G18', re: /the App route \/app is not among the measured routes \(\/console\)/, opts: { routes: '/console', workbench: '', requireFocus: true } },
  // shell 0.17.0: the same for a workbench App (--workbench /app --require-focus with /app not among the routes)
  { id: 'workbench-route-unwalked', check: 'G18', re: /the workbench route \/app is not among the measured routes \(\/introduction\)/, opts: { routes: '/introduction', requireFocus: true } },
  // F9: a plain number with a dotted segment in a Spanish paragraph still fails G11 (the DOI of a reference does not: the clean fixture and the test of the dotted DOI)
  // F12: the title of a reference ("Version 3.4") is the source's own and never read as a Spanish decimal, but a plain 3.4 in a Spanish paragraph of the same page fails
  { id: 'decimal-point-plain-34', check: 'G11', re: /writes 3\.4 with a decimal point/, opts: { langs: 'es', routes: '/app,/introduction' } },
  { id: 'decimal-point-plain-2020', check: 'G11', re: /writes 20\.2020 with a decimal point/, opts: { langs: 'es', routes: '/app,/introduction' } },
  // round 3 (re-review): M1 an empty head row, M3 a renamed focus parameter
  { id: 'surface-tall-control', check: 'G18', re: /the surface's tab row is [\d.]+px taller than its tabs need/, opts: SURF },
  { id: 'surface-empty-head', check: 'G18', re: /the surface renders a head with no title, lede or actions \(an empty head row \d+px high\)/, opts: SURF },
  { id: 'surface-fparam-left', check: 'G18', re: /Focus mode of view \w+: the URL still holds \?f after the return/, opts: SURF },
  { id: 'surface-focus-url-stays', check: 'G18', re: /Focus mode of view \w+: the URL still holds \?focus after the return/, opts: SURF },
  { id: 'exec-deck-hidden-cards', check: 'ADR-0017.2', re: /executive view \(EN\): the proposal holds 1 row\(s\) of the 4 C's, exactly 4 are required/, opts: { routes: '/introduction' } },
  { id: 'exec-flip-content-hidden', check: 'ADR-0017.2', re: /executive view \(EN\): \d+ field\(s\) are in the page and a reader cannot read them/, opts: { routes: '/introduction' } },
];

/** Legitimate pages that the gate once failed (ADR-0017 2.1 allows them): each must pass every check, in both languages. */
const LEGIT = [
  // long case names the shell's case select shows whole (the consumer trial of 0.17.0: names of 241 and 311 px in 181 px of room, then 354 and 398 px that need three lines)
  { id: 'legit-select-two-lines', opts: { routes: '/app', requireFocus: true } },
  { id: 'legit-select-three-lines', opts: { routes: '/app', requireFocus: true } },
  { id: 'legit-engine-subtabs', opts: { routes: '/app,/implementation' } },
  { id: 'legit-method-view-tabs', opts: { routes: '/app,/methodology' } },
  // shell 0.19.0: a chart that turns zoom off with a reason passes every check and is listed among the waivers
  { id: 'legit-zoom-off', opts: { routes: '/app' }, waiver: /whole epidemic curve is the finding/ },
];

/** A static server with an SPA fallback: every unknown path answers index.html with 200 (the G4 plant). */
function serveSpa(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = join(dir, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = existsSync(join(file, 'index.html')) ? join(file, 'index.html') : join(dir, 'index.html');
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((d) => server.close(() => d())) })));
}

const show = (r) => r.failures.map((f) => `[${f.check}] ${f.route} ${f.mode} ${f.trail} :: ${f.message}`).join('\n');

before(async () => {
  await buildFixture(clean);
});

test('the clean fixture passes every check in the full matrix (five sizes, both themes, both languages)', { timeout: 1_800_000 }, async () => {
  const r = await runGate({ serve: clean, expectBrand: BRAND, idleMs: 1000, out: join(work, 'out-clean') });
  assert.ok(r.states > 100, `the walk measured ${r.states} states; it should cover every route, tab and case`);
  assert.equal(r.failures.length, 0, `the clean fixture failed:\n${show(r)}`);
  // G14: one page shows every capture, the wide-font pass's included
  const index = readFileSync(join(work, 'out-clean', 'index.html'), 'utf8');
  assert.ok(r.captures >= 30, `${r.captures} captures`);
  for (const name of readdirSync(join(work, 'out-clean', 'shots'))) assert.ok(index.includes(`shots/${name}`), `index.html shows ${name}`);
  assert.ok(readdirSync(join(work, 'out-clean', 'shots')).some((n) => n.endsWith('_wide.png')), 'the wide-font pass captured its states');
});

test('the clean surface App passes every check, G18 included, in both languages and themes at a phone and a desktop size', { timeout: 1_800_000 }, async () => {
  // the fixture's console as the App route of a product whose App is a SurfacePage: `--workbench ''`, `--app-route`, `--require-focus`
  const dir = makePlant(clean, join(work, 'plant-surface'), 'surface');
  const r = await runGate({ ...SURF, requireFocus: true, serve: dir, expectBrand: BRAND, sizes: '390x844,1280x800', idleMs: 600, out: join(work, 'out-surface') });
  assert.equal(r.failures.length, 0, `the clean surface App failed:\n${show(r)}`);
  const shots = readdirSync(join(work, 'out-surface', 'shots'));
  assert.ok(shots.some((n) => n.startsWith('focus_console_1280x800')), 'the Focus frame of the surface was captured');
  // --app-route defaults to /app: with --workbench '' that route is measured as a surface (here it is the fixture's workbench, which has no surface views)
  const dflt = await runGate({ ...QUICK, workbench: '', routes: '/app', requireFocus: true, serve: dir, expectBrand: BRAND, out: join(work, 'out-surface-default') });
  assert.ok(dflt.failures.some((f) => f.check === 'G18' && /the surface App \(\/app\) offers no Focus control/.test(f.message)), `the default App route is /app; failures:\n${show(dflt)}`);
});

test('a headless surface that holds its view in ?mode= (the shape of CAOS_Neuraxis) passes every check with Focus: no head, no row, G7 clicks every tab, G18 reads the renamed parameter', { timeout: 1_800_000 }, async () => {
  const dir = makePlant(clean, join(work, 'plant-surface-headless'), 'surface-headless');
  const r = await runGate({ ...SURF, requireFocus: true, serve: dir, expectBrand: BRAND, sizes: '390x844,1280x800', themes: 'light', idleMs: 600, out: join(work, 'out-surface-headless') });
  assert.equal(r.failures.length, 0, `the clean headless surface failed:\n${show(r)}`);
});

test('a Spanish page whose reference has a DOI with a dotted numeric segment and a title with Version 3.4 passes G11 (bibliographic text is never translated, translate="no")', { timeout: 600_000 }, async () => {
  const dir = makePlant(clean, join(work, 'plant-doi-es'), 'surface');
  const r = await runGate({ ...QUICK, langs: 'es', routes: '/introduction,/methodology', serve: dir, expectBrand: BRAND, out: join(work, 'out-doi-es') });
  assert.equal(r.failures.filter((f) => f.check === 'G11').length, 0, `G11 read the DOI as a decimal:\n${show(r)}`);
  assert.equal(r.failures.length, 0, `failures:\n${show(r)}`);
});

test('a surface that renames the focus parameter (SurfaceFocusConfig.param) passes every check: the gate reads data-focus-param, not the literal focus', { timeout: 900_000 }, async () => {
  const dir = makePlant(clean, join(work, 'plant-surface-fparam'), 'surface-fparam');
  const r = await runGate({ ...SURF, requireFocus: true, serve: dir, expectBrand: BRAND, sizes: '1280x800', themes: 'light', langs: 'en', idleMs: 600, out: join(work, 'out-surface-fparam') });
  assert.equal(r.failures.length, 0, `the renamed focus parameter failed:
${show(r)}`);
});

describe('every planted defect fails the check that owns it', { concurrency: 4 }, () => {
  const servers = [];
  after(async () => {
    for (const s of servers) await s.close();
  });
  for (const p of PLANTS) {
    test(`${p.check}: ${p.id}`, { timeout: 600_000 }, async () => {
      const dir = makePlant(clean, join(work, `plant-${p.id}`), p.id);
      const target = p.server === 'spa' ? await serveSpa(dir) : null;
      if (target) servers.push(target);
      const r = await runGate({
        ...QUICK,
        ...(target ? { url: target.url } : { serve: dir }),
        expectBrand: BRAND,
        out: join(work, `out-${p.id}`),
        ...(p.opts ?? {}),
      });
      const hit = r.failures.find((f) => f.check === p.check && p.re.test(f.message) && (!p.trail || p.trail.test(f.trail)) && (!p.mode || p.mode.test(f.mode)));
      if (p.not) assert.ok(!r.failures.some((f) => f.check === p.check && p.not.test(f.message)), `plant ${p.id} failed ${p.check} with ${p.not}, a floor its waiver names; failures:
${show(r)}`);
      if (p.also) assert.ok(r.failures.some((f) => f.check === p.check && p.also.test(f.message)), `plant ${p.id} did not also fail ${p.check} with ${p.also}`);
      assert.ok(hit, `plant ${p.id} did not fail ${p.check} with ${p.re}${p.trail ? ` at ${p.trail}` : ''}; failures:\n${show(r) || '(none)'}`);
    });
  }
});

describe('a legitimate page passes the gate', { concurrency: 3 }, () => {
  for (const p of LEGIT) {
    test(`legit: ${p.id}`, { timeout: 600_000 }, async () => {
      const dir = makePlant(clean, join(work, `plant-${p.id}`), p.id);
      const r = await runGate({ ...QUICK, langs: 'en,es', serve: dir, expectBrand: BRAND, out: join(work, `out-${p.id}`), ...p.opts });
      assert.equal(r.failures.length, 0, `the legitimate page ${p.id} failed:
${show(r)}`);
      if (p.waiver) assert.ok((r.waivers ?? []).some((w) => w.floor === 'chart zoom off' && w.valid && p.waiver.test(w.reason)), `the waiver of ${p.id} is not listed: ${JSON.stringify(r.waivers)}`);
    });
  }
});

test('the CLI exits 2 without a subject and 1 on a failing subject', { timeout: 300_000 }, () => {
  const bin = join(root, 'bin', 'caos-shell-gate.mjs');
  const misuse = spawnSync(process.execPath, [bin, '--serve', clean], { encoding: 'utf8' });
  assert.equal(misuse.status, 2, misuse.stderr);
  assert.match(misuse.stderr, /--expect-brand is required/);
  const wrong = spawnSync(process.execPath, [bin, '--serve', clean, '--expect-brand', 'SomethingElse', '--sizes', '1280x800', '--themes', 'light', '--langs', 'en', '--out', join(work, 'out-cli')], { encoding: 'utf8' });
  assert.equal(wrong.status, 1, wrong.stdout + wrong.stderr);
  assert.match(wrong.stdout, /FAIL \[G1\]/);
});
