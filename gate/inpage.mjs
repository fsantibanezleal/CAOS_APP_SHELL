// The gate's in-page library. `installLib` is serialised by Playwright into an init script, so it must be
// self-contained: everything it uses is defined inside it. It installs `window.__caosGate` before the product's own
// scripts run, wraps requestAnimationFrame to count frames during an idle window (G8), and exposes the measurements
// the runner decides on. Each measurement answers one question about what a reader would see, on the element a
// reader would see it on (never `#root`, never a host box standing in for a drawing).

export function installLib() {
  const G = (window.__caosGate = window.__caosGate || {});
  G.raf = 0;
  // The smallest rendered size of an illustration label (EXEC_LIMITS.minLabelPx of gate/areas.mjs; test/executive.test.ts keeps them equal).
  const EXEC_MIN_LABEL_PX = 9;
  G.counting = false;
  const nativeRaf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  if (nativeRaf) {
    window.requestAnimationFrame = (cb) =>
      nativeRaf((t) => {
        if (G.counting) G.raf += 1;
        cb(t);
      });
  }

  /** The ancestors of an element up to (not including) `stop`. */
  function* ancestorsUntil(el, stop) {
    for (let a = el.parentElement; a && a !== stop && a !== document.body; a = a.parentElement) yield a;
  }

  const visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (el.checkVisibility) return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
  };
  const shown = (el) => el.getClientRects().length > 0 && (el.checkVisibility ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
  const FONT_FLOOR = 8; // px: a smaller font is not legible, whatever its line box
  const fontPx = (el) => Number.parseFloat(getComputedStyle(el).fontSize);
  /**
   * The box a `clip-path` leaves of an element's own box `ar`, or null when the gate cannot read the shape: `inset()` is
   * computed, any other shape (circle, polygon, path, url) is taken as cutting the element away.
   */
  const clipPathBox = (cp, ar) => {
    const m = /^inset\((.*)\)$/.exec(cp.trim());
    if (!m) return null;
    const v = m[1].split(/\bround\b/)[0].trim().split(/\s+/).filter(Boolean);
    if (v.length < 1 || v.length > 4) return null;
    const [top, right, bottom, left] = [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]];
    const px = (x, ref) => (x.endsWith('%') ? (Number.parseFloat(x) / 100) * ref : Number.parseFloat(x));
    const o = { top: px(top, ar.height), right: px(right, ar.width), bottom: px(bottom, ar.height), left: px(left, ar.width) };
    if (Object.values(o).some((n) => Number.isNaN(n))) return null;
    return { left: ar.left + o.left, top: ar.top + o.top, right: ar.right - o.right, bottom: ar.bottom - o.bottom };
  };
  /**
   * The part of `rect` a reader can see: inside `within`, inside every ancestor from `el` up (below `within`) that
   * hides its overflow (`el` itself only when `self`: its overflow cuts its own text, not its own box) and inside every
   * `clip-path` of `el` and of those ancestors. Null when nothing is left.
   */
  const clipRect = (rect, el, within, self) => {
    const b = within.getBoundingClientRect();
    let left = Math.max(rect.left, b.left);
    let top = Math.max(rect.top, b.top);
    let right = Math.min(rect.right, b.right);
    let bottom = Math.min(rect.bottom, b.bottom);
    for (let a = el; a && a !== within && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      if (a !== el || self) {
        if (/hidden|clip/.test(s.overflowX)) {
          left = Math.max(left, ar.left);
          right = Math.min(right, ar.right);
        }
        if (/hidden|clip/.test(s.overflowY)) {
          top = Math.max(top, ar.top);
          bottom = Math.min(bottom, ar.bottom);
        }
      }
      if (s.clipPath && s.clipPath !== 'none') {
        const c = clipPathBox(s.clipPath, ar);
        if (!c) return null;
        left = Math.max(left, c.left);
        top = Math.max(top, c.top);
        right = Math.min(right, c.right);
        bottom = Math.min(bottom, c.bottom);
      }
    }
    return right > left && bottom > top ? { left, top, right, bottom } : null;
  };
  const textNodesOf = (el) => {
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!/\S/.test(n.nodeValue || '') || !n.parentElement || n.parentElement.closest('script, style, .katex-mathml')) continue;
      out.push(n);
    }
    return out;
  };
  const probe = document.createRange();
  /** Whether a reader sees the glyphs of a text node: its element is rendered, its font is legible, and a line of it lies inside what is not clipped. */
  const glyphsSeen = (node, within, minW, minH) => {
    const p = node.parentElement;
    if (!p || (p.checkVisibility && !p.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) || fontPx(p) < FONT_FLOOR) return false;
    probe.selectNodeContents(node);
    for (const rc of probe.getClientRects()) {
      if (rc.width <= 0 || rc.height <= 0) continue;
      const c = clipRect(rc, p, within, true);
      if (c && c.right - c.left >= minW && c.bottom - c.top >= minH) return true;
    }
    return false;
  };
  /**
   * What a reader can read (ADR-0080 decision 3, ADR-0017 2.1): the element is rendered (a box, opacity above 0, CSS
   * visibility), its font is not zero, the part of its box that lies inside `within` (and inside every ancestor that
   * hides its overflow, and every clip-path) is at least minW by minH px, and the glyphs of its text are painted where
   * that is so: a text node counts when its font is at least FONT_FLOOR px and a line of it is inside what is not clipped
   * (text pushed out of its box by `text-indent`, cut by `clip-path` or set in a 1 px font is not read). An element with
   * no text (a drawing) is judged by its box. `only` judges one text node of the element. A 1 by 1 px screen-reader-only
   * note, a transparent one, one positioned off-screen or one cut off by a clipping box is not readable. `shown` stays
   * for `data-state="loading"`, which must catch every pending element, visible or not.
   */
  const readable = (el, within, minW = 40, minH = 12, only = null) => {
    if (!visible(el) || !within) return false;
    if (fontPx(el) < 1) return false;
    const box = clipRect(el.getBoundingClientRect(), el, within, false);
    if (!box || box.right - box.left < minW || box.bottom - box.top < minH) return false;
    if (!only && el.matches('svg, canvas, img, video')) return true; // a drawing: the box decides, its labels are not the text of a reader
    const nodes = only ? [only] : textNodesOf(el);
    if (nodes.length === 0) return true;
    return nodes.some((n) => glyphsSeen(n, within, Math.min(minW, 2), Math.min(minH, 4)));
  };
  /** The words and the letters and digits of the text a reader sees in an element (rendered text: hidden descendants are not in it). */
  const renderedText = (el) => {
    const t = el.innerText || '';
    return { chars: t.replace(/[^\p{L}\p{N}]+/gu, '').length, words: t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length };
  };
  const path = (el) => {
    const parts = [];
    let e = el;
    while (e && e.nodeType === 1 && e !== document.body && e !== document.documentElement) {
      const p = e.parentElement;
      if (!p) break;
      parts.unshift(`${e.tagName.toLowerCase()}:nth-child(${Array.prototype.indexOf.call(p.children, e) + 1})`);
      e = p;
    }
    return parts.length ? `body > ${parts.join(' > ')}` : 'body';
  };
  const describe = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    const t = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    const attrs = ['data-control', 'data-tab', 'data-panel', 'data-plot', 'data-stage', 'data-case', 'data-readout', 'aria-label']
      .filter((a) => el.hasAttribute(a))
      .map((a) => `[${a}="${String(el.getAttribute(a)).slice(0, 30)}"]`)
      .join('');
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    return `${t}${el.id ? `#${el.id}` : ''}${cls}${attrs}${text ? ` "${text}"` : ''}`;
  };
  G.describe = describe;

  /** '' when the page has settled on its declared state; otherwise why not (G7: never networkidle, never a sleep). */
  G.ready = () => {
    if (!document.querySelector('[data-brand]')) return 'no [data-brand]: the shell has not rendered';
    const loading = [...document.querySelectorAll('[data-state="loading"]')].filter(shown);
    if (loading.length) return `${loading.length} element(s) still declare data-state="loading": ${loading.slice(0, 3).map(describe).join('; ')}`;
    const stale = [...document.querySelectorAll('[data-stale="1"]')].filter(shown);
    if (stale.length) return `${stale.length} view(s) still show an earlier selection (data-stale="1"): ${stale.slice(0, 3).map(describe).join('; ')}`;
    const undrawn = [...document.querySelectorAll('[data-drawn="0"]')].filter(shown);
    if (undrawn.length) return `${undrawn.length} stage(s) never got a size (data-drawn="0"): ${undrawn.slice(0, 3).map(describe).join('; ')}`;
    return '';
  };

  /** What the page says it is and which mode it is in (G1, G2). */
  G.identity = () => {
    const b = document.querySelector('[data-brand]');
    const active = document.querySelector('header nav a.active, header nav a[aria-current="page"]');
    return {
      brand: b ? b.getAttribute('data-brand') : null,
      title: document.title,
      theme: document.documentElement.dataset.theme ?? null,
      lang: document.documentElement.lang || null,
      activeHref: active ? active.href : null,
    };
  };

  /** The static layout of the current view (G5, G6 inputs, ADR-0071 and ADR-0017 measures). */
  G.facts = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const de = document.documentElement;
    const body = document.body;
    const docH = Math.max(de.scrollHeight, body.scrollHeight);
    const docW = Math.max(de.scrollWidth, body.scrollWidth);

    // Element boxes beyond the viewport, not clipped by an ancestor (scrollWidth alone misses clipped documents).
    const beyond = [];
    const walk = (el, clipped) => {
      for (const c of el.children) {
        const s = getComputedStyle(c);
        if (s.display === 'none') continue;
        const r = c.getBoundingClientRect();
        if (!clipped && r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && (r.right > vw + 1 || r.left < -1)) {
          beyond.push(`${describe(c)} spans ${Math.round(r.left)}..${Math.round(r.right)} of a ${vw}px viewport`);
          continue;
        }
        if (c.tagName.toLowerCase() === 'svg') continue;
        walk(c, clipped || s.overflowX !== 'visible');
      }
    };
    walk(body, false);

    // Tab rows: one row each (ADR-0071 rule 4); tops clustered so a 1px active-tab offset is not a second row. A row
    // also shows its tabs whole: a row that shrank under a tall panel cut its tabs' height (known shell defect 16).
    const rows = [...document.querySelectorAll('[role="tablist"]')]
      .filter((tl) => visible(tl) && tl.getAttribute('aria-orientation') !== 'vertical')
      .map((tl) => {
        const tabs = [...tl.querySelectorAll('[role="tab"]')].filter((t) => t.closest('[role="tablist"]') === tl && visible(t));
        const tops = tabs.map((t) => t.getBoundingClientRect().top).sort((a, b) => a - b);
        let n = tops.length ? 1 : 0;
        for (let i = 1; i < tops.length; i += 1) if (tops[i] - tops[i - 1] > 8) n += 1;
        // a shrunk row either lets its tabs overflow it or stretches them shorter than their own content
        const lr = tl.getBoundingClientRect();
        let cut = Math.max(0, tl.scrollHeight - tl.clientHeight);
        for (const t of tabs) {
          const r = t.getBoundingClientRect();
          cut = Math.max(cut, t.scrollHeight - t.clientHeight, Math.round(Math.max(0, lr.top - r.top) + Math.max(0, r.bottom - lr.bottom)));
        }
        return { name: tl.getAttribute('aria-label') || describe(tl), rows: n, cut };
      });

    // The rail: no scroll (rule 6) and every descendant inside its box (G5).
    const railEl = document.querySelector('[data-rail]');
    let rail = null;
    if (railEl && visible(railEl)) {
      const rr = railEl.getBoundingClientRect();
      const outside = [];
      for (const d of railEl.querySelectorAll('*')) {
        if (d.closest('svg') && d.tagName.toLowerCase() !== 'svg') continue;
        if (!visible(d)) continue;
        const r = d.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        let p = d.parentElement;
        let scroller = false;
        while (p && p !== railEl) {
          if (getComputedStyle(p).overflowX !== 'visible') {
            scroller = true;
            break;
          }
          p = p.parentElement;
        }
        if (scroller) continue;
        if (r.right > rr.right + 1 || r.left < rr.left - 1) outside.push(`${describe(d)} spans ${Math.round(r.left)}..${Math.round(r.right)}, rail ${Math.round(rr.left)}..${Math.round(rr.right)}`);
      }
      rail = { scroll: railEl.scrollHeight, client: railEl.clientHeight, outside: outside.slice(0, 5), outsideCount: outside.length };
    }

    // Truncated text must carry its full text (G5).
    const truncated = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      const s = getComputedStyle(el);
      if (s.textOverflow !== 'ellipsis' || el.scrollWidth <= el.clientWidth + 1 || !visible(el)) continue;
      // The full text must be readable somewhere: a title (or accessible name) on the element or its two nearest
      // ancestors that CONTAINS it. Any label nearby is not enough: the rail's own aria-label would excuse everything.
      const full = (el.textContent || '').trim().replace(/\s+/g, ' ');
      let named = false;
      for (let i = 0, t = el; i < 3 && t; i += 1, t = t.parentElement) {
        const label = `${t.getAttribute('title') || ''} ${t.getAttribute('aria-label') || ''}`.replace(/\s+/g, ' ');
        if (full && label.includes(full)) {
          named = true;
          break;
        }
      }
      if (!named) truncated.push(describe(el));
    }

    // Containers that cut their content: overflow hidden or clip with more content than box (S1, G5).
    const clipped = [];
    const containers = new Set([de, body, document.getElementById('root'), ...document.querySelectorAll('main, .page, .page-body, [data-instrument], [data-rail], .tabpanel, .caos-cw, [data-plot]')]);
    for (const el of containers) {
      if (!el || !visible(el)) continue;
      const s = getComputedStyle(el);
      if ((s.overflowY === 'hidden' || s.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 4) {
        clipped.push(`${describe(el)} cuts ${el.scrollHeight - el.clientHeight}px of content (overflow-y ${s.overflowY})`);
      }
      if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 4) {
        clipped.push(`${describe(el)} cuts ${el.scrollWidth - el.clientWidth}px of content horizontally (overflow-x ${s.overflowX})`);
      }
    }

    // Layout containers that scroll sideways: a wide child pushed the page, the instrument or a panel past its width.
    // Rows built to scroll (the nav, tab rows, a plot body holding a wide table) are not layout containers.
    for (const el of new Set([...document.querySelectorAll('main, .page, .page-body, [data-instrument], [data-rail], .tabpanel, .subtabpanel, .caos-cw')])) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4) {
        clipped.push(`${describe(el)} scrolls sideways by ${el.scrollWidth - el.clientWidth}px (a child is wider than the layout)`);
      }
    }

    // The instrument and what is drawn in it (G6): canvases, svg drawings, images, tables; icons excluded.
    const inst = document.querySelector('[data-instrument]');
    let instrument = null;
    const surfaces = [];
    let prose = false;
    let unavailable = null; // data-state="unavailable" declared in the instrument: 'explained' (a reason a reader can read), 'unexplained' (readable, no reason) or 'unseen' (no reader can see it)
    let drawn = 0; // drawing elements rendered in the instrument, whatever their size or visibility
    if (inst && visible(inst)) {
      const ir = inst.getBoundingClientRect();
      const cx0 = Math.max(0, ir.left);
      const cy0 = Math.max(0, ir.top);
      const cx1 = Math.min(vw, ir.right);
      const cy1 = Math.min(vh, ir.bottom);
      instrument = { x: cx0, y: cy0, w: Math.max(0, cx1 - cx0), h: Math.max(0, cy1 - cy0) };
      const ctx = inst.querySelector('.caos-cw-context');
      prose = Boolean(ctx && visible(ctx));
      // a declaration counts when a reader can see the element (a box of 40 by 12 px at least, inside the instrument,
      // opaque); its reason is the text rendered, 12 letters or digits in two words at least
      const declared = [...inst.querySelectorAll('[data-state="unavailable"]')].filter(shown);
      const seen = declared.filter((el) => readable(el, inst));
      if (seen.length) {
        unavailable = seen.some((el) => {
          const t = renderedText(el);
          return t.chars >= 12 && t.words >= 2;
        })
          ? 'explained'
          : 'unexplained';
      } else if (declared.length) unavailable = 'unseen';
      // a drawing element rendered at all (a collapsed or invisible chart too) cancels the exemption; a card that holds the note is not one
      drawn = [...inst.querySelectorAll('canvas, img, video, table, svg, [data-plot], [data-drawn]')].filter((el) => {
        if (el.getClientRects().length === 0) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === 'svg') {
          if (el.parentElement && el.parentElement.closest('svg')) return false;
          if (el.classList.contains('lucide') || el.closest('button, a, summary, [role="tab"], [role="button"]')) return false;
          const r = el.getBoundingClientRect();
          if (el.getAttribute('aria-hidden') === 'true' && r.width > 0 && r.height > 0 && r.width <= 32 && r.height <= 32) return false;
        }
        if (tag === 'table' && el.parentElement && el.parentElement.closest('table')) return false;
        if (el.matches('[data-plot], [data-drawn]') && declared.some((d) => el.contains(d))) return false;
        return true;
      }).length;
      for (const el of inst.querySelectorAll('canvas, svg, img, table, video')) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'svg' && el.parentElement && el.parentElement.closest('svg')) continue;
        if (el.parentElement && el.parentElement.closest('table') && tag === 'table') continue;
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        const min = tag === 'canvas' || tag === 'table' ? 16 : 48;
        if (r.width < min || r.height < min) continue;
        const x = Math.max(cx0, r.left);
        const y = Math.max(cy0, r.top);
        const x2 = Math.min(cx1, r.right);
        const y2 = Math.min(cy1, r.bottom);
        if (x2 - x < 2 || y2 - y < 2) continue;
        // The stage a drawing is judged against: the view's body, else the sized stage, else the surface itself; the
        // view is the card that holds it. A drawing that fills a small corner of a large view underfills its stage.
        const stageEl = el.closest('.caos-plot-body') || el.closest('[data-drawn]') || el;
        const viewEl = el.closest('[data-plot]') || stageEl;
        const clipRect = (b) => {
          const sx = Math.max(cx0, b.left);
          const sy = Math.max(cy0, b.top);
          return { x: sx, y: sy, w: Math.max(0, Math.min(cx1, b.right) - sx), h: Math.max(0, Math.min(cy1, b.bottom) - sy) };
        };
        surfaces.push({
          kind: tag,
          label: describe(viewEl),
          x,
          y,
          w: x2 - x,
          h: y2 - y,
          // a table or drawing inside a box that SCROLLS sideways (a wide table on a phone, ADR-0071 rule 3) ends where
          // its box ends: a reader scrolls it; one cut by a box that hides its overflow still extends past the page
          right: Math.min(r.right, ...[...ancestorsUntil(el, inst)].filter((a) => ['auto', 'scroll'].includes(getComputedStyle(a).overflowX)).map((a) => a.getBoundingClientRect().right)),
          stageKey: path(stageEl),
          stage: clipRect(stageEl.getBoundingClientRect()),
          viewKey: path(viewEl),
          view: clipRect(viewEl.getBoundingClientRect()),
        });
      }
    }

    const wb = document.querySelector('[data-case-workbench]');
    const workbench = wb
      ? { case: wb.getAttribute('data-case'), key: wb.getAttribute('data-state-key'), replayOnly: wb.getAttribute('data-replay-only') === '1' }
      : null;

    // The references of a page or open tab (ADR-0017 s4): one block, the last thing in its scope (the document page
    // or the tab panel that holds it).
    const refScope = (el) => el.closest('[role="tabpanel"], [data-doc-page]');
    const refBlocks = [...document.querySelectorAll('[data-doc-references]')].filter(visible);
    const isLastInScope = (block) => {
      const scope = refScope(block);
      for (let el = block; el && el !== scope; el = el.parentElement) {
        for (let n = el.nextElementSibling; n; n = n.nextElementSibling) if (visible(n)) return false;
      }
      return true;
    };

    let offCentre = null;
    const proseBody = document.querySelector('.page-body:not(.wide)');
    if (proseBody && visible(proseBody)) {
      const parent = proseBody.parentElement;
      const pb = proseBody.getBoundingClientRect();
      const cb = parent.getBoundingClientRect();
      offCentre = Math.abs(pb.left - cb.left - (parent.clientWidth - pb.width) / 2);
    }
    const pageBody = document.querySelector('.page-body');
    return {
      vw,
      vh,
      docH,
      docW,
      beyond: beyond.slice(0, 5),
      beyondCount: beyond.length,
      rows,
      rail,
      truncated: truncated.slice(0, 5),
      truncatedCount: truncated.length,
      clipped,
      instrument,
      surfaces,
      prose,
      unavailable,
      drawn,
      workbench,
      offCentre,
      pageText: pageBody ? (pageBody.innerText || '').trim().length : 0,
      referenceLists: [...document.querySelectorAll('.reference-list')].filter(visible).length,
      // shell 0.11.0: the references of a page or open tab are one block at its end (ADR-0017 s4)
      referenceBlocks: refBlocks.length,
      referencesNotLast: refBlocks.filter((b) => !isLastInScope(b)).length,
      refsDeclaredNoBlock: [...document.querySelectorAll('[data-refs]')].filter((sec) => visible(sec) && !refBlocks.some((b) => refScope(b) === refScope(sec))).length,
      uncaptioned: [...document.querySelectorAll('.equation')].filter((e) => visible(e) && !e.querySelector('.equation-caption')).length,
      // charts whose axis gives a tick the label of the tick before it (UPlotChart declares data-ticks-repeat)
      repeatedTicks: [...document.querySelectorAll('[data-ticks-repeat]')]
        .filter((el) => visible(el) && Number(el.getAttribute('data-ticks-repeat')) > 0)
        .map((el) => ({ label: describe(el.closest('[data-plot]') || el), n: Number(el.getAttribute('data-ticks-repeat')) })),
      // the drawing a filling card keeps under its note (G6 stage floor): the body of every visible `PlotCard fill`
      fillStages: [...document.querySelectorAll('.caos-plot.fill')]
        .filter(visible)
        .map((card) => ({ label: describe(card), h: (card.querySelector(':scope > .caos-plot-body') || card).getBoundingClientRect().height })),
      sectionsWithoutRefs: [...document.querySelectorAll('[data-no-refs-reason="missing"]')].filter(visible).length,
    };
  };

  // ---- 0.11.0: the required areas of the documentation pages (ADR-0017 section 2.1) ------------------------------

  let docBound = null; // the page being measured: what lies outside it, or is clipped out of it, is not read
  const wordsOf = (el) => {
    // the words a reader reads: visible text outside equations; `linkWords` of them inside links
    let words = 0;
    let linkWords = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (!parent || parent.closest('.katex, script, style') || !readable(parent, docBound, 4, 4, n)) continue;
      const k = (n.nodeValue || '').split(/\s+/).filter(Boolean).length;
      words += k;
      if (parent.closest('a')) linkWords += k;
    }
    return { words, linkWords };
  };
  const tabLabel = (t) => (t.textContent || '').trim().replace(/\s+/g, ' ');
  /** The tabs from the outermost one to the one that opens `panel`: their labels (for messages) and their ids (for rules). */
  const chainOf = (panel) => {
    const labels = [];
    const ids = [];
    let p = panel;
    while (p) {
      const id = p.getAttribute('aria-labelledby');
      const tab = id ? document.getElementById(id) : null;
      if (!tab) break;
      labels.unshift(tabLabel(tab));
      ids.unshift(tab.getAttribute('data-tab') || tabLabel(tab));
      const tl = tab.closest('[role="tablist"]');
      p = tl && tl.parentElement ? tl.parentElement.closest('[role="tabpanel"]') : null;
    }
    return { label: labels.join(' > '), key: ids.join('/'), head: ids[0] ?? null };
  };
  const textOf = (el) => (el.innerText || '').trim().replace(/\s+/g, ' '); // rendered text: a hidden descendant is not in it
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  /** A part of a statement a reader sees: the declared text is in the rendered text, in the readable part (`sel`) when the element has one. */
  const statPart = (el, want, sel) => {
    if (!want) return false;
    const kids = [...el.querySelectorAll(sel)];
    return kids.length ? kids.some((k) => readable(k, docBound, 4, 4) && norm(k.innerText).includes(want)) : norm(el.innerText).includes(want);
  };
  /** A quantified statement: visible, a digit in its value, and the unit and the source it declares readable beside it (the `Stat` component). */
  const validStat = (el) => {
    if (!readable(el, docBound, 4, 4)) return false;
    const value = el.querySelector('.caos-stat-value');
    return /\d/.test((value ? value.innerText : el.innerText) || '') && statPart(el, norm(el.getAttribute('data-stat-unit')), '.caos-stat-unit') && statPart(el, norm(el.getAttribute('data-stat-source')), '.caos-stat-source');
  };

  /**
   * What a documentation page shows in this state: its lede, its waivers, the leaf topics open, the views (the outermost
   * tabs), every visible section with what it holds, and the figures and captioned equations of the open view. The rules
   * (gate/areas.mjs) are applied by the runner; this only measures. A hidden element is never counted, a paragraph is
   * counted once per distinct text, and the words are those of the displayed language.
   */
  G.docPage = () => {
    const page = document.querySelector('[data-doc-page]');
    if (!page || !visible(page)) return null;
    docBound = page;
    const seen = (el) => readable(el, page, 4, 4);
    const lede = page.querySelector('.lede');
    const panels = [...page.querySelectorAll('[role="tabpanel"]')].filter(visible);
    // a tab list inside a section belongs to that section: its panels are not topics, and it does not make its topic a branch
    const inSection = (el) => Boolean(el.closest('[data-doc-section]'));
    const leaves = panels.filter((p) => !inSection(p) && ![...p.querySelectorAll('[role="tablist"]')].some((tl) => visible(tl) && !inSection(tl)));
    const topicPanel = (el) => {
      let p = el.closest('[role="tabpanel"]');
      while (p && inSection(p)) p = p.parentElement ? p.parentElement.closest('[role="tabpanel"]') : null;
      return p;
    };
    const topics = leaves.length ? leaves.map((p) => chainOf(p)) : [{ label: '', key: '', head: null }];
    // the outermost tab list: the views of the page (the Introduction: executive, then technical)
    const outer = [...page.querySelectorAll('[role="tablist"]')].filter(visible).find((tl) => !tl.closest('[role="tabpanel"]') && !inSection(tl));
    const outerTabs = outer ? [...outer.querySelectorAll('[role="tab"]')] : [];
    const outerPanel = outer && outer.parentElement ? [...outer.parentElement.children].find((c) => c.getAttribute('role') === 'tabpanel' && visible(c)) : null;
    const captioned = (fig) => {
      const cap = fig.querySelector('figcaption');
      if (!cap || !textOf(cap)) return null;
      const svg = fig.querySelector('svg');
      const img = [...fig.querySelectorAll('img')].find((i) => /\.svg(\?|#|$)/i.test(i.getAttribute('src') || ''));
      if (!(svg && visible(svg)) && !(img && visible(img))) return null;
      return textOf(cap);
    };
    const equationCaption = (eq) => {
      const cap = eq.querySelector('.equation-caption');
      return cap && textOf(cap) ? textOf(cap) : null;
    };
    const sections = [...page.querySelectorAll('[data-doc-section]')].filter(visible).map((sec) => {
      const mine = (el) => el.closest('[data-doc-section]') === sec && seen(el);
      const dense = new Set();
      for (const p of sec.querySelectorAll('p')) {
        if (!mine(p) || p.closest('.callout, figure, .equation, table, [data-glossary], [data-stat]')) continue;
        const { words, linkWords } = wordsOf(p);
        if (words >= 40 && linkWords * 2 < words) dense.add(textOf(p).toLowerCase());
      }
      const callouts = [...sec.querySelectorAll('.callout')].filter(mine);
      const variant = (c) => c.getAttribute('data-callout') || (c.classList.contains('callout-honest') ? 'honest' : c.classList.contains('callout-strong') ? 'strong' : 'note');
      // what is distinct in this state, so the same thing seen in another state (a sub-tab of the section) counts once
      const keyed = (els, key) => {
        const seenKey = new Map();
        return els.map((e) => {
          const k = key(e);
          const n = seenKey.get(k) ?? 0;
          seenKey.set(k, n + 1);
          return `${k}#${n}`;
        });
      };
      const hasText = (el) => /[\p{L}\p{N}]/u.test(textOf(el));
      // glossary items a reader sees: a term and a definition, both visible and holding a letter or a digit
      const glossary = [...sec.querySelectorAll('[data-glossary]')].filter(mine).reduce((a, g) => {
        const dts = [...g.querySelectorAll('dt')];
        if (!dts.length) return a + [...g.querySelectorAll(':scope > li')].filter((li) => seen(li) && hasText(li)).length;
        return a + dts.filter((dt) => {
          const dd = dt.nextElementSibling;
          return seen(dt) && hasText(dt) && dd && dd.tagName === 'DD' && seen(dd) && hasText(dd);
        }).length;
      }, 0);
      const plots = [...sec.querySelectorAll('[data-plot]')].filter(mine);
      const bare = [...sec.querySelectorAll('canvas, svg[data-chart]')].filter((c) => mine(c) && !c.closest('[data-plot]'));
      const panel = topicPanel(sec);
      const topic = panel ? chainOf(panel) : { label: '', key: '', head: null };
      // the first table of the section: its rows of three or more cells, each proved by a quantified statement
      const table = [...sec.querySelectorAll('table')].find(mine);
      const tableRows = table ? [...table.querySelectorAll('tbody tr')].filter((r) => seen(r) && r.querySelectorAll('td, th').length >= 3) : [];
      const list = [...sec.querySelectorAll('ul, ol')].find((l) => mine(l) && !l.closest('[data-glossary]') && !l.parentElement.closest('ul, ol'));
      const items = list ? [...list.querySelectorAll(':scope > li')].filter(seen) : [];
      // the rows of the area: those of its first table, or the items of its first list when the list comes first
      const rowEls = list && (!table || !(table.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)) ? items : tableRows;
      const nonEmpty = (q, sel) => {
        const e = q.querySelector(sel);
        return Boolean(e && seen(e) && /[\p{L}\p{N}]/u.test(textOf(e)));
      };
      const eqEls = [...sec.querySelectorAll('.equation')].filter((e) => mine(e) && equationCaption(e));
      const figEls = [...sec.querySelectorAll('figure')].filter((f) => mine(f) && captioned(f));
      const honestEls = callouts.filter((c) => variant(c) === 'honest');
      const strongEls = callouts.filter((c) => variant(c) === 'strong');
      return {
        title: ((sec.querySelector('h2') || {}).textContent || '').trim().slice(0, 60),
        area: sec.getAttribute('data-area'),
        kind: sec.getAttribute('data-method-kind'),
        topic: topic.label,
        topicKey: topic.key,
        view: topic.head,
        dense: dense.size,
        denseKeys: [...dense],
        equations: eqEls.length,
        equationKeys: keyed(eqEls, (e) => `${equationCaption(e)}|${(e.querySelector('annotation') || {}).textContent || ''}`),
        figures: figEls.length,
        figureKeys: keyed(figEls, (f) => captioned(f)),
        callouts: callouts.length,
        calloutKeys: keyed(callouts, (c) => `${variant(c)}|${textOf(c)}`),
        honest: honestEls.length,
        honestKeys: keyed(honestEls, (c) => `${variant(c)}|${textOf(c)}`),
        strong: strongEls.length,
        strongKeys: keyed(strongEls, (c) => `${variant(c)}|${textOf(c)}`),
        refs: Number(sec.getAttribute('data-refs')) || 0,
        glossary,
        steps: Math.max(0, ...[...sec.querySelectorAll('ol')].filter(mine).map((o) => [...o.querySelectorAll(':scope > li')].filter((li) => seen(li) && hasText(li)).length)),
        tables: [...sec.querySelectorAll('table')].filter((t) => mine(t) && !t.parentElement.closest('table')).length,
        codes: [...sec.querySelectorAll('pre')].filter(mine).length,
        charts: plots.length + bare.length,
        // a control registered with the panel (data-control), not any button or link
        controls: [...sec.querySelectorAll('[data-control]')].filter(mine).length,
        stats: [...sec.querySelectorAll('[data-stat]')].filter((e) => mine(e) && validStat(e)).length,
        rows: rowEls.length,
        rowsNoStat: rowEls.filter((r) => ![...r.querySelectorAll('[data-stat]')].some(validStat)).length,
        items: items.length,
        thinItems: items.filter((li) => wordsOf(li).words < 6).length,
        qa: [...sec.querySelectorAll('[data-qa]')].filter((q) => mine(q) && nonEmpty(q, '[data-question]') && nonEmpty(q, '[data-answer]')).length,
      };
    });
    const selected = outerTabs.find((t) => t.getAttribute('aria-selected') === 'true');
    // The executive view (shell 0.12.0): what the ExecutiveView shows, for executiveFailures of gate/areas.mjs.
    const execRoots = [...page.querySelectorAll('[data-executive-view]')].filter(visible);
    const executive = (() => {
      if (!execRoots.length) return { count: 0 };
      const root = execRoots[0];
      const isTok = (v) => {
        const x = String(v || '').trim().toLowerCase();
        return !x || ['none', 'currentcolor', 'transparent', 'inherit', 'initial', 'unset', 'context-fill', 'context-stroke'].includes(x) || x.startsWith('var(--') || x.startsWith('url(');
      };
      const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'];
      const literalsOf = (svg) => {
        const out = new Set();
        const scan = (css) => {
          for (const m of css.matchAll(/(?:^|[;{\s])(fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*([^;}]+)/gi)) if (!isTok(m[2])) out.add(`${m[1].toLowerCase()}: ${m[2].trim()}`);
        };
        for (const el of [svg, ...svg.querySelectorAll('*')]) {
          for (const p of COLOR_PROPS) if (el.hasAttribute(p) && !isTok(el.getAttribute(p))) out.add(`${p}: ${el.getAttribute(p).trim()}`);
          if (el.hasAttribute('style')) scan(el.getAttribute('style'));
          if (el.localName === 'style') scan(el.textContent || '');
        }
        return [...out];
      };
      const illustrations = [...root.querySelectorAll('[data-exec-illustration]')].map((fig) => {
        const svg = fig.querySelector('svg');
        const sec = fig.closest('[data-exec-section]');
        const cap = fig.querySelector('figcaption');
        const info = { name: fig.getAttribute('data-exec-illustration'), section: sec ? Number(sec.getAttribute('data-exec-section')) : 0, file: fig.getAttribute('data-exec-file'), state: fig.getAttribute('data-state'), why: textOf(fig.querySelector('.caos-exec-fig-error') || fig).slice(0, 80), svg: Boolean(svg), img: fig.querySelectorAll('img').length, chart: fig.querySelectorAll('[data-chart], [data-plot]').length, caption: Boolean(cap && textOf(cap)), literal: [], outside: [], small: [], labels: 0 };
        if (!svg) return info;
        info.literal = literalsOf(svg);
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const w = svg.getBoundingClientRect().width;
        const scale = vb && vb.width ? w / vb.width : 1;
        for (const t of svg.querySelectorAll('text')) {
          const label = (t.textContent || '').trim();
          if (!label || !visible(t)) continue;
          info.labels += 1;
          if (vb && vb.width) {
            const b = t.getBBox();
            if (b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1) info.outside.push(label.slice(0, 40));
          }
          const px = parseFloat(getComputedStyle(t).fontSize) * scale;
          if (px < EXEC_MIN_LABEL_PX) info.small.push(`"${label.slice(0, 30)}" at ${px.toFixed(1)}px`);
        }
        return info;
      });
      const sections = [...root.querySelectorAll('[data-exec-section]')].map((sec) => {
        const pending = sec.querySelector('[data-exec-pending]');
        return {
          n: Number(sec.getAttribute('data-exec-section')),
          title: textOf(sec.querySelector('h2') || sec),
          question: textOf(sec.querySelector('[data-exec-question]') || sec),
          pending: pending && seen(pending) ? 1 : 0,
          pendingText: pending ? textOf(pending) : '',
          pendingState: pending ? pending.getAttribute('data-state') : null,
          rows: [...sec.querySelectorAll('[data-exec-c]')].filter(seen).length,
        };
      });
      const panelOpen = outerPanel ? outerPanel.contains(root) : true;
      const execOpen = selected && (selected.getAttribute('data-tab') || tabLabel(selected)) === 'executive';
      const area = execOpen && outerPanel ? outerPanel : null;
      const docSections = area ? [...area.querySelectorAll('[data-doc-section]')].filter((e) => visible(e) && !root.contains(e)) : [];
      // anything of the open executive view that is neither the ExecutiveView nor the references block of the panel
      const strangers = area
        ? [...area.querySelectorAll('p, ul, ol, table, figure, h1, h2, h3, h4, pre, canvas, .callout, .equation, .caos-qa')]
            .filter((e) => visible(e) && !root.contains(e) && !e.closest('[data-doc-references], [data-doc-section]'))
            .map((e) => textOf(e).slice(0, 50) || e.tagName.toLowerCase())
        : [];
      return {
        count: execRoots.length,
        schema: root.getAttribute('data-executive-schema'),
        valid: root.getAttribute('data-executive-valid'),
        errors: root.getAttribute('data-executive-errors') || '',
        inOpenView: panelOpen,
        docSections: docSections.length,
        docSectionTitles: docSections.map((e) => textOf(e.querySelector('h2') || e).slice(0, 40)),
        strangers,
        sections,
        fields: [...root.querySelectorAll('[data-exec-field]')].map((e) => ({ path: e.getAttribute('data-exec-field'), text: textOf(e), readable: seen(e) })),
        notes: root.querySelectorAll('[data-exec-notes] > li').length,
        figures: root.querySelectorAll('.caos-exec-cite').length,
        illustrations,
      };
    })();
    const inView = (sel) => (outerPanel ? [...outerPanel.querySelectorAll(sel)] : [...page.querySelectorAll(sel)]).filter(seen);
    return {
      ledeWords: lede && visible(lede) ? wordsOf(lede).words : 0,
      waiver: page.getAttribute('data-floor-waiver'),
      topics,
      views: outerTabs.map((t) => t.getAttribute('data-tab') || tabLabel(t)),
      view: selected ? selected.getAttribute('data-tab') || tabLabel(selected) : null,
      // the executive view holds none anywhere on the page, the part outside the two views included
      viewEquations: [...page.querySelectorAll('.equation')].filter(seen).length,
      viewGlossaries: [...page.querySelectorAll('[data-glossary]')].filter(seen).length,
      sections,
      executive,
      figures: inView('figure').map(captioned).filter(Boolean),
      equations: inView('.equation').map(equationCaption).filter(Boolean),
    };
  };

  /** A tall view must move when scrolled (S1, G5). Restores the positions it changed. */
  G.scrolls = () => {
    const out = [];
    const de = document.documentElement;
    const docH = Math.max(de.scrollHeight, document.body.scrollHeight);
    if (docH > window.innerHeight + 1) {
      const y = window.scrollY;
      winScroll(0, 0);
      winScroll(0, docH);
      const moved = window.scrollY > 0;
      winScroll(0, y);
      if (!moved) out.push(`the document is ${docH}px tall in a ${window.innerHeight}px viewport and does not scroll`);
    }
    for (const el of document.querySelectorAll('main, .page, .page-body, [data-instrument], [data-rail], .tabpanel')) {
      if (!visible(el)) continue;
      const s = getComputedStyle(el);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4) {
        const t = el.scrollTop;
        setScroll(el, el.scrollLeft, 0);
        setScroll(el, el.scrollLeft, el.scrollHeight);
        const moved = el.scrollTop > 0;
        setScroll(el, el.scrollLeft, t);
        if (!moved) out.push(`${describe(el)} holds ${el.scrollHeight - el.clientHeight}px more content and does not scroll`);
      }
    }
    return out;
  };

  const setScroll = (el, left, top) => el.scrollTo({ left, top, behavior: 'instant' });
  const winScroll = (x, y) => window.scrollTo({ left: x, top: y, behavior: 'instant' });

  /** Brings an element into view the way a reader can: by scrolling the containers a reader can scroll (overflow auto
   * or scroll) and the document, never an overflow-hidden ancestor (scrollIntoView would, and hide a real cut). */
  const bring = (el) => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      let r = el.getBoundingClientRect();
      // An element larger than the container is aligned by its start: aligning its end pushed its start out of
      // view, and the probe then landed on whatever covers the container (known shell defect 18). An element that
      // fits is scrolled until its end shows with a margin, never past its start: with less slack than the margin,
      // the margin pushed its start out and the probe reported the element it had moved (known shell defect 25).
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && a.scrollWidth > a.clientWidth) {
        if (r.left < ar.left || r.width > ar.width) setScroll(a, a.scrollLeft - (ar.left - r.left), a.scrollTop);
        else if (r.right > ar.right) setScroll(a, a.scrollLeft + Math.min(r.right - ar.right + 8, r.left - ar.left), a.scrollTop);
      }
      r = el.getBoundingClientRect();
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && a.scrollHeight > a.clientHeight) {
        if (r.top < ar.top || r.height > ar.height) setScroll(a, a.scrollLeft, a.scrollTop - (ar.top - r.top));
        else if (r.bottom > ar.bottom) setScroll(a, a.scrollLeft, a.scrollTop + Math.min(r.bottom - ar.bottom + 8, r.top - ar.top));
      }
    }
    // the document is scrolled so the element shows below a header stuck at the top of the viewport (0.8.0: the
    // sticky header sticks in a scrolling document since known shell defect 26 was fixed)
    const cover = el.closest('header, [role="banner"]') ? 0 : stuckTop();
    const r = el.getBoundingClientRect();
    if (r.top < cover || r.bottom > window.innerHeight) winScroll(window.scrollX, window.scrollY + r.top + r.height / 2 - (cover + (window.innerHeight - cover) / 2));
    const r2 = el.getBoundingClientRect();
    if (r2.left < 0 || r2.right > window.innerWidth) winScroll(window.scrollX + r2.left + r2.width / 2 - window.innerWidth / 2, window.scrollY);
  };
  G.bringEl = (el) => bring(el);
  G.bring = (selector) => {
    const el = document.querySelector(selector);
    if (el) bring(el);
    return Boolean(el);
  };

  /** The viewport cut by every ancestor that clips its content (overflow other than visible). */
  /** The bottom of a page header stuck to the top of the viewport (sticky or fixed), or 0: what it covers is not in
   * view for a reader. */
  function stuckTop() {
    let bottom = 0;
    for (const h of document.querySelectorAll('header, [role="banner"]')) {
      if (h.parentElement && h.parentElement.closest('header, [role="banner"], [role="dialog"]')) continue;
      const s = getComputedStyle(h);
      if (s.position !== 'sticky' && s.position !== 'fixed') continue;
      const r = h.getBoundingClientRect();
      if (r.top <= 1 && r.bottom > 0 && r.width >= window.innerWidth * 0.5) bottom = Math.max(bottom, r.bottom);
    }
    return bottom;
  }

  const visibleArea = (el) => {
    const area = { left: 0, top: el.closest('header, [role="banner"]') ? 0 : stuckTop(), right: window.innerWidth, bottom: window.innerHeight };
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      if (s.overflowX !== 'visible') {
        area.left = Math.max(area.left, ar.left);
        area.right = Math.min(area.right, ar.right);
      }
      if (s.overflowY !== 'visible') {
        area.top = Math.max(area.top, ar.top);
        area.bottom = Math.min(area.bottom, ar.bottom);
      }
    }
    return area;
  };

  /** Every visible control can be brought into the viewport and receives the pointer at the centre of its visible
   * part (G5). */
  G.reach = () => {
    const sel = 'a[href], button, select, input:not([type="hidden"]), textarea, [role="tab"], [role="button"], [tabindex]:not([tabindex="-1"])';
    const saved = new Map();
    for (const e of document.querySelectorAll('*')) if (e.scrollLeft || e.scrollTop) saved.set(e, [e.scrollLeft, e.scrollTop]);
    const sx = window.scrollX;
    const sy = window.scrollY;
    const out = [];
    let checked = 0;
    const els = [...document.querySelectorAll(sel)].filter((el) => !el.disabled && !el.closest('[aria-hidden="true"]') && visible(el));
    for (const el of els) {
      bring(el);
      // A wrapped inline element (a citation link over two lines) has its box centre between its line fragments; the
      // pointer lands on a fragment, so the largest one is tested.
      const frags = [...el.getClientRects()].filter((q) => q.width >= 1 && q.height >= 1);
      const r = frags.length ? frags.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a)) : el.getBoundingClientRect();
      // a 1x1 box is the visually hidden pattern (the skip link, screen-reader text): not a pointer target
      if (r.width <= 1 || r.height <= 1) continue;
      checked += 1;
      // The area the element can show in: the viewport cut by every ancestor that clips (known shell defect 18; an
      // element that fits the window but not its scroll container was reported as never brought into view).
      const area = visibleArea(el);
      const fits = r.width <= area.right - area.left + 1 && r.height <= area.bottom - area.top + 1;
      if (fits && (r.left < area.left - 1 || r.right > area.right + 1 || r.top < area.top - 1 || r.bottom > area.bottom + 1)) {
        out.push(`${describe(el)} cannot be brought into the viewport (at ${Math.round(r.left)},${Math.round(r.top)})`);
        continue;
      }
      // the pointer goes to the centre of the part that shows
      const vx0 = Math.max(r.left, area.left);
      const vx1 = Math.min(r.right, area.right);
      const vy0 = Math.max(r.top, area.top);
      const vy1 = Math.min(r.bottom, area.bottom);
      if (vx1 - vx0 < 1 || vy1 - vy0 < 1) {
        out.push(`${describe(el)} cannot be brought into the viewport (at ${Math.round(r.left)},${Math.round(r.top)})`);
        continue;
      }
      const px = Math.min(Math.max((vx0 + vx1) / 2, 0), window.innerWidth - 1);
      const py = Math.min(Math.max((vy0 + vy1) / 2, 0), window.innerHeight - 1);
      const hit = document.elementFromPoint(px, py);
      const ok =
        hit && (hit === el || el.contains(hit) || (el.labels && [...el.labels].some((l) => l.contains(hit))) || (hit.tagName === 'LABEL' && hit.control === el));
      if (!ok) out.push(`${describe(el)} is covered by ${hit ? describe(hit) : 'nothing (outside the page)'}`);
    }
    for (const e of document.querySelectorAll('*')) {
      const s = saved.get(e);
      if (s) setScroll(e, s[0], s[1]);
      else if (e.scrollLeft || e.scrollTop) setScroll(e, 0, 0);
    }
    winScroll(sx, sy);
    return { checked, unreachable: out.slice(0, 8), unreachableCount: out.length };
  };

  /** Animation frames and DOM mutations over a window at rest (G8). */
  G.idle = (ms) =>
    new Promise((done) => {
      let mutations = 0;
      const sample = [];
      const mo = new MutationObserver((recs) => {
        mutations += recs.length;
        for (const r of recs) {
          if (sample.length >= 3) break;
          const t = r.target.nodeType === 1 ? r.target : r.target.parentElement;
          sample.push(`${r.type}${r.attributeName ? ` ${r.attributeName}` : ''} on ${describe(t)}`);
        }
      });
      mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      G.raf = 0;
      G.counting = true;
      setTimeout(() => {
        G.counting = false;
        mo.disconnect();
        done({ raf: G.raf, mutations, sample, ms });
      }, ms);
    });

  /** The visible tab lists outside the header, footer and dialogs, each with the list whose panel holds it (G7). */
  G.tablists = () =>
    [...document.querySelectorAll('[role="tablist"]')]
      .filter((tl) => visible(tl) && !tl.closest('header, footer, [role="dialog"]'))
      .map((tl) => {
        const panel = tl.parentElement ? tl.parentElement.closest('[role="tabpanel"]') : null;
        let owner = null;
        if (panel) {
          const id = panel.getAttribute('aria-labelledby');
          const tab = id ? document.getElementById(id) : null;
          const otl = tab ? tab.closest('[role="tablist"]') : null;
          owner = otl ? path(otl) : 'unknown';
        }
        const tabs = [...tl.querySelectorAll('[role="tab"]')].filter((t) => t.closest('[role="tablist"]') === tl && visible(t));
        return {
          key: path(tl),
          owner,
          name: tl.getAttribute('aria-label') || '',
          source: Boolean(tl.closest('.cs-source-tabs') || tl.classList.contains('cs-source-tabs')),
          inSection: Boolean(tl.closest('[data-doc-section]')),
          tabs: tabs.map((t) => (t.getAttribute('data-tab') || (t.textContent || '').trim()).slice(0, 40)),
          active: tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'),
        };
      });

  /** The cases the case control offers right now (G9). */
  G.cases = () => {
    const ctl = [...document.querySelectorAll('[data-control="case"]')].filter(visible);
    const ids = [];
    for (const c of ctl) {
      if (c.tagName === 'SELECT') {
        for (const o of c.options) if (!o.disabled && o.value) ids.push(o.value);
      } else for (const b of c.querySelectorAll('[data-case]')) if (!b.disabled) ids.push(b.getAttribute('data-case'));
    }
    return { kind: ctl.length === 0 ? 'none' : ctl[0].tagName === 'SELECT' ? 'select' : 'chips', ids: [...new Set(ids)] };
  };

  /** The registered controls of the instrument, except the case control (G9). */
  G.controls = () =>
    [...document.querySelectorAll('[data-control]')]
      .filter((c) => visible(c) && c.getAttribute('data-control') !== 'case')
      // a control that cannot act in this selection is not moved (known shell defect 20): every input in it disabled
      .filter((c) => {
        const inputs = c.matches('input, select, button, textarea') ? [c] : [...c.querySelectorAll('input, select, button, textarea')];
        return inputs.length === 0 || inputs.some((e) => !e.disabled);
      })
      .map((c) => {
        let kind = 'unknown';
        if (c.tagName === 'SELECT' || c.querySelector('select')) kind = 'select';
        else if ((c.tagName === 'INPUT' && c.type === 'range') || c.querySelector('input[type="range"]')) kind = 'range';
        else if (c.querySelector('input[type="checkbox"], input[type="radio"]') || (c.tagName === 'INPUT' && (c.type === 'checkbox' || c.type === 'radio'))) kind = 'check';
        else if (c.querySelector('input[type="number"]') || (c.tagName === 'INPUT' && c.type === 'number')) kind = 'number';
        else if (c.querySelector('button') || c.tagName === 'BUTTON') kind = 'buttons';
        return { id: c.getAttribute('data-control'), path: path(c), kind };
      });

  /** The visible keyed views: every plot and readout with the selection key it shows (G9). */
  G.views = () =>
    [...document.querySelectorAll('[data-plot], [data-readout]')]
      .filter(visible)
      .map((v) => ({ label: describe(v), key: v.getAttribute('data-state-key') || '', stale: v.getAttribute('data-stale') === '1' }));

  // ---- 0.8.0 measures ----------------------------------------------------------------------------------------

  /** The part of the page the ancestors of an element let it show when they CUT their content (overflow hidden or
   * clip). A scroll container does not cut (a reader scrolls it), and neither does the viewport; and what lies beyond
   * the first scroll container on an axis is a matter of scroll position, so the walk stops there on that axis (0.9.1:
   * the contained `.app-shell`, viewport-high with its overflow hidden, read every documentation figure below the fold
   * as "outside the drawing"). */
  const cutArea = (el) => {
    const area = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
    let x = true;
    let y = true;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement && (x || y); a = a.parentElement) {
      const s = getComputedStyle(a);
      const ar = a.getBoundingClientRect();
      if (x && (s.overflowX === 'hidden' || s.overflowX === 'clip')) {
        area.left = Math.max(area.left, ar.left);
        area.right = Math.min(area.right, ar.right);
      }
      if (y && (s.overflowY === 'hidden' || s.overflowY === 'clip')) {
        area.top = Math.max(area.top, ar.top);
        area.bottom = Math.min(area.bottom, ar.bottom);
      }
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') x = false;
      if (s.overflowY === 'auto' || s.overflowY === 'scroll') y = false;
    }
    return area;
  };

  /** The boxes a text element occupies on screen: one per line (tspan) when it has several. */
  const textBoxes = (t) => {
    const spans = [...t.querySelectorAll('tspan')].filter((s) => (s.textContent || '').trim());
    const parts = spans.length ? spans : [t];
    return parts
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.width > 0.5 && r.height > 0.5)
      .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  };

  /**
   * G10, text in drawings: in every drawing a reader looks at (a declared chart, any SVG in the instrument, any figure
   * in a document) each label lies inside the drawing and inside the part of it its containers show, and no two
   * labels overlap. Measured on the rendered glyph boxes, so a label sized for one font and drawn in a wider one fails
   * (the wide-font pass renders every page in a wider fallback font). A halo drawn as a second identical label at the
   * same place is not an overlap. A drawing that crosses labels on purpose declares `data-text-overlap="allowed"`.
   */
  G.drawingText = () => {
    const out = [];
    const svgs = new Set([
      ...document.querySelectorAll('svg[data-chart], [data-instrument] svg, .prose svg, figure svg'),
    ]);
    for (const svg of svgs) {
      if (svg.parentElement && svg.parentElement.closest('svg')) continue;
      if (svg.classList.contains('lucide') || !visible(svg)) continue;
      const sr = svg.getBoundingClientRect();
      if (sr.width < 48 || sr.height < 24) continue;
      const area = cutArea(svg);
      const box = { left: Math.max(sr.left, area.left), top: Math.max(sr.top, area.top), right: Math.min(sr.right, area.right), bottom: Math.min(sr.bottom, area.bottom) };
      const name = describe(svg.closest('[data-plot]') || svg);
      const texts = [...svg.querySelectorAll('text')].filter((t) => (t.textContent || '').trim() && visible(t));
      const items = [];
      for (const t of texts) {
        for (const b of textBoxes(t)) {
          // a label outside the visible part of the drawing: cut, or drawn where no one sees it
          if (b.top >= box.bottom || b.bottom <= box.top) {
            out.push(`${name}: the label "${(t.textContent || '').trim().slice(0, 40)}" lies outside the drawing`);
            continue;
          }
          const cutX = Math.max(0, box.left - b.left) + Math.max(0, b.right - box.right);
          const cutY = Math.max(0, box.top - b.top) + Math.max(0, b.bottom - box.bottom);
          if (cutX > 1.5 || cutY > 2.5) out.push(`${name}: the label "${(t.textContent || '').trim().slice(0, 40)}" is cut by ${Math.round(Math.max(cutX, cutY))}px at the drawing's edge`);
          items.push({ t, b, text: (t.textContent || '').trim() });
        }
      }
      if (svg.closest('[data-text-overlap="allowed"]') || items.length > 600) continue;
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i];
          const c = items[j];
          if (a.t === c.t || a.t.contains(c.t) || c.t.contains(a.t)) continue;
          const w = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left);
          const h = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top);
          if (w <= 1.5 || h <= 2.5) continue;
          // a halo: the same label drawn twice at the same place
          if (a.text === c.text && Math.abs(a.b.left - c.b.left) < 1.5 && Math.abs(a.b.top - c.b.top) < 1.5) continue;
          out.push(`${name}: the labels "${a.text.slice(0, 30)}" and "${c.text.slice(0, 30)}" overlap by ${Math.round(w)}x${Math.round(h)}px`);
        }
      }
    }
    return [...new Set(out)];
  };

  /**
   * G11, numbers in Spanish: a page in Spanish writes decimals with a comma (conventions/languages.md). Reads every
   * visible text, SVG labels included, outside code, formulas, versions and anything marked translate="no"; a number
   * with a decimal point fails, a Spanish thousands group (27.345) passes. A canvas is not read.
   */
  G.decimals = () => {
    const out = [];
    const skip = 'code, pre, kbd, samp, .katex, [data-version], [data-build], [translate="no"], script, style, [aria-hidden="true"]';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    // an exponent belongs to the number: 2.7e-08 on a Spanish page writes its decimal with a point too
    const re = /(?<![\w.,/:@#])(\d+)\.(\d+)(?:[eE][-+]?\d+)?(?![\w/@]|\.\d)/g;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue || '';
      if (!/\d\.\d/.test(text)) continue;
      const el = n.parentElement;
      if (!el || el.closest(skip) || !shown(el)) continue;
      for (const m of text.matchAll(re)) {
        // a thousands group of the Spanish locale: 1 to 3 digits, not starting with 0, then groups of exactly 3
        const token = text.slice(m.index).match(/^\d+(?:\.\d+)+/)?.[0] ?? m[0];
        if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(token)) continue;
        out.push(`"${text.trim().slice(0, 60)}" writes ${m[0]} with a decimal point (${describe(el)})`);
      }
    }
    return [...new Set(out)].slice(0, 12);
  };

  /** The scroll container of an element: the nearest ancestor that scrolls vertically, or the document. */
  const scroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 1) return a;
    }
    return null;
  };

  /**
   * G12, the vertical sub-tab list stays in view: on a vertical SubTabs whose panel is taller than its scroll box,
   * scroll to the end of the panel and require the active sub-tab to be visible (known shell defect 24). Restores the
   * position it changed.
   */
  G.sticky = () => {
    const out = [];
    for (const st of document.querySelectorAll('.subtabs-vertical')) {
      if (!visible(st)) continue;
      const list = st.querySelector(':scope > .subtablist');
      const active = list && list.querySelector('.subtab.active');
      if (!list || !active || getComputedStyle(list).flexDirection !== 'column') continue;
      const sc = scroller(st);
      const viewH = sc ? sc.clientHeight : window.innerHeight;
      const rect = st.getBoundingClientRect();
      if (rect.height <= viewH + 4) continue;
      const before = sc ? sc.scrollTop : window.scrollY;
      // scroll so the end of the sub-tab block is at the bottom of the scroll box
      const delta = rect.bottom - (sc ? sc.getBoundingClientRect().bottom : window.innerHeight);
      if (sc) setScroll(sc, sc.scrollLeft, sc.scrollTop + delta);
      else winScroll(window.scrollX, window.scrollY + delta);
      const a = active.getBoundingClientRect();
      const area = visibleArea(active);
      const headerBottom = (() => {
        const h = document.querySelector('.site-header');
        if (!h || sc) return 0;
        const hs = getComputedStyle(h);
        return hs.position === 'sticky' || hs.position === 'fixed' ? h.getBoundingClientRect().bottom : 0;
      })();
      const top = Math.max(area.top, headerBottom);
      if (a.bottom <= top + 2 || a.top >= area.bottom - 2) out.push(`${describe(list)}: at the end of a ${Math.round(rect.height)}px section the active sub-tab "${(active.textContent || '').trim().slice(0, 30)}" is out of view (the list scrolled away)`);
      if (sc) setScroll(sc, sc.scrollLeft, before);
      else winScroll(window.scrollX, before);
    }
    return out;
  };

  const parseColor = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = (c) => {
    const ch = (v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  /** The colour behind an element: its ancestors' backgrounds composited, or null when an image or gradient is there. */
  const backdrop = (el) => {
    const layers = [];
    for (let a = el; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = parseColor(s.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) base = over(layers[i], base);
    return base;
  };
  /** The colour an SVG text element is painted on: the last filled shape painted before it whose box holds its centre. */
  const svgBackdrop = (text, page) => {
    const svg = text.closest('svg');
    if (!svg) return page;
    const r = text.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let found = null;
    for (const shape of svg.querySelectorAll('rect, circle, ellipse, polygon, path')) {
      if (!(shape.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const ss = getComputedStyle(shape);
      if (ss.display === 'none' || ss.visibility === 'hidden') continue;
      const fill = parseColor(ss.fill);
      if (!fill || fill.a === 0) continue;
      const b = shape.getBoundingClientRect();
      if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) continue;
      const a = fill.a * Number(ss.fillOpacity || 1) * opacityOf(shape);
      if (a <= 0.05) continue;
      found = { ...fill, a };
    }
    return found ? over(found, page) : page;
  };

  const opacityOf = (el) => {
    let o = 1;
    for (let a = el; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity || 1);
    return o;
  };

  /**
   * G13, text contrast (WCAG 2.2 AA, 1.4.3): every visible text a reader can read, SVG labels included, against the
   * colour behind it: 4.5:1, or 3:1 for large text (24px, or 18.66px bold). Disabled controls are exempt, as WCAG
   * exempts inactive components; text over an image or a gradient is not judged.
   */
  G.contrast = () => {
    const out = [];
    const seen = new Set();
    // a colour transition still running reads as a colour between two states (a chip just selected read 3.89:1 at
    // 87% of its way to white): finish every finite transition first; looping animations are left alone
    if (document.getAnimations) {
      for (const a of document.getAnimations()) {
        const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
        if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition && Number.isFinite(Number(end))) a.finish();
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!(n.nodeValue || '').trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (el.closest('script, style, [aria-hidden="true"], .sr-only, .skip-link, :disabled, [aria-disabled="true"], .katex-mathml') || !visible(el)) continue;
      const s = getComputedStyle(el);
      const isSvg = el.namespaceURI === 'http://www.w3.org/2000/svg';
      const fg = parseColor(isSvg ? s.fill : s.color);
      if (!fg) continue;
      const host = isSvg ? el.closest('svg')?.parentElement ?? el : el;
      const page = backdrop(host);
      if (!page) continue;
      // SVG text sits on what the drawing painted under it (a label on a bar): the last filled shape before it whose
      // box holds the text's centre, composited over the page (0.9.1: a marker in the page colour on a red bar read
      // 1.06:1 against the page)
      const bg = isSvg ? svgBackdrop(el, page) : page;
      const alpha = fg.a * opacityOf(el);
      const shownColor = over({ ...fg, a: alpha }, bg);
      const l1 = lum(shownColor);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(s.fontSize) || 16;
      const bold = Number(s.fontWeight) >= 700;
      const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
      if (ratio + 1e-6 < need) out.push(`${describe(el)}: contrast ${ratio.toFixed(2)}:1, below ${need}:1 (${isSvg ? s.fill : s.color} on rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)}))`);
    }
    return out.slice(0, 10);
  };
}
