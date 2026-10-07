// The gate's in-page library. `installLib` is serialised by Playwright into an init script, so it must be
// self-contained: everything it uses is defined inside it. It installs `window.__caosGate` before the product's own
// scripts run, wraps requestAnimationFrame to count frames during an idle window (G8), and exposes the measurements
// the runner decides on. Each measurement answers one question about what a reader would see, on the element a
// reader would see it on (never `#root`, never a host box standing in for a drawing).

export function installLib() {
  const G = (window.__caosGate = window.__caosGate || {});
  G.raf = 0;
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
    if (inst && visible(inst)) {
      const ir = inst.getBoundingClientRect();
      const cx0 = Math.max(0, ir.left);
      const cy0 = Math.max(0, ir.top);
      const cx1 = Math.min(vw, ir.right);
      const cy1 = Math.min(vh, ir.bottom);
      instrument = { x: cx0, y: cy0, w: Math.max(0, cx1 - cx0), h: Math.max(0, cy1 - cy0) };
      const ctx = inst.querySelector('.caos-cw-context');
      prose = Boolean(ctx && visible(ctx));
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
      workbench,
      offCentre,
      pageText: pageBody ? (pageBody.innerText || '').trim().length : 0,
      referenceLists: [...document.querySelectorAll('.reference-list')].filter(visible).length,
      uncaptioned: [...document.querySelectorAll('.equation')].filter((e) => visible(e) && !e.querySelector('.equation-caption')).length,
      // charts whose axis gives a tick the label of the tick before it (UPlotChart declares data-ticks-repeat)
      repeatedTicks: [...document.querySelectorAll('[data-ticks-repeat]')]
        .filter((el) => visible(el) && Number(el.getAttribute('data-ticks-repeat')) > 0)
        .map((el) => ({ label: describe(el.closest('[data-plot]') || el), n: Number(el.getAttribute('data-ticks-repeat')) })),
      sectionsWithoutRefs: [...document.querySelectorAll('[data-no-refs-reason="missing"]')].filter(visible).length,
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
      if (ratio + 1e-6 < need) out.push(`${describe(el)}: contrast ${ratio.toFixed(2)}:1, below ${need}:1 (${s.color || s.fill} on rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)}))`);
    }
    return out.slice(0, 10);
  };
}
