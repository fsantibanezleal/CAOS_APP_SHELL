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

    // Tab rows: one row each (ADR-0071 rule 4); tops clustered so a 1px active-tab offset is not a second row.
    const rows = [...document.querySelectorAll('[role="tablist"]')]
      .filter((tl) => visible(tl) && tl.getAttribute('aria-orientation') !== 'vertical')
      .map((tl) => {
        const tops = [...tl.querySelectorAll('[role="tab"]')]
          .filter((t) => t.closest('[role="tablist"]') === tl && visible(t))
          .map((t) => t.getBoundingClientRect().top)
          .sort((a, b) => a - b);
        let n = tops.length ? 1 : 0;
        for (let i = 1; i < tops.length; i += 1) if (tops[i] - tops[i - 1] > 8) n += 1;
        return { name: tl.getAttribute('aria-label') || describe(tl), rows: n };
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
      const full = (el.textContent || '').trim().replace(/s+/g, ' ');
      let named = false;
      for (let i = 0, t = el; i < 3 && t; i += 1, t = t.parentElement) {
        const label = `${t.getAttribute('title') || ''} ${t.getAttribute('aria-label') || ''}`.replace(/s+/g, ' ');
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
          right: r.right,
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
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && a.scrollWidth > a.clientWidth) {
        if (r.left < ar.left) setScroll(a, a.scrollLeft - (ar.left - r.left + 8), a.scrollTop);
        else if (r.right > ar.right) setScroll(a, a.scrollLeft + (r.right - ar.right + 8), a.scrollTop);
      }
      r = el.getBoundingClientRect();
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && a.scrollHeight > a.clientHeight) {
        if (r.top < ar.top) setScroll(a, a.scrollLeft, a.scrollTop - (ar.top - r.top + 8));
        else if (r.bottom > ar.bottom) setScroll(a, a.scrollLeft, a.scrollTop + (r.bottom - ar.bottom + 8));
      }
    }
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) winScroll(window.scrollX, window.scrollY + r.top + r.height / 2 - window.innerHeight / 2);
    const r2 = el.getBoundingClientRect();
    if (r2.left < 0 || r2.right > window.innerWidth) winScroll(window.scrollX + r2.left + r2.width / 2 - window.innerWidth / 2, window.scrollY);
  };
  G.bringEl = (el) => bring(el);
  G.bring = (selector) => {
    const el = document.querySelector(selector);
    if (el) bring(el);
    return Boolean(el);
  };

  /** Every visible control can be brought into the viewport and receives the pointer at its centre (G5). */
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
      if (r.width < 1 || r.height < 1) continue;
      checked += 1;
      const fits = r.width <= window.innerWidth && r.height <= window.innerHeight;
      if (fits && (r.left < -1 || r.right > window.innerWidth + 1 || r.top < -1 || r.bottom > window.innerHeight + 1)) {
        out.push(`${describe(el)} cannot be brought into the viewport (at ${Math.round(r.left)},${Math.round(r.top)})`);
        continue;
      }
      const px = Math.min(Math.max(r.left + Math.min(r.width, window.innerWidth) / 2, 0), window.innerWidth - 1);
      const py = Math.min(Math.max(r.top + Math.min(r.height, window.innerHeight) / 2, 0), window.innerHeight - 1);
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
}
