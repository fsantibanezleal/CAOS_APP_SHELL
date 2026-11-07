import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { installLib } from '../gate/inpage.mjs';
import { failedRules } from '../gate/areas.mjs';
import { startHarness, type Harness } from './harness';

let h: Harness;
before(async () => {
  h = await startHarness(`
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { AppShell, SurfacePage, SubTabs, CardDeck, useLangStore, applyTheme } from './src/index';
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang') === 'es' ? 'es' : 'en';
    useLangStore.getState().setLang(lang);
    applyTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
    const content = <SubTabs ariaLabel="Details" tabs={[
      { id: 'chart', label: 'Chart', content: <p data-result="chart">Process chart</p> },
      { id: 'table', label: 'Table', content: <p data-result="table">Recorded outcomes</p> },
    ]} />;
    createRoot(document.getElementById('root')).render(
      <AppShell config={{ product: { name: 'SurfaceFixture' }, version: '0.19.9', contain: true,
        routes: [{ path: '/introduction', en: 'Introduction', es: 'Introducción' }], links: {} }}>
        <SurfacePage document={params.get('document') !== '0'}
          title={{ en: 'Introduction', es: 'Introducción' }}
          lede={(lang === 'es' ? 'Un circuito conecta las decisiones con la evidencia. ' : 'A circuit connects decisions with their evidence. ').repeat(6)}
          actions={<button type="button">Source</button>}
          focus tabs={[
            { id: 'overview', label: 'Overview', focus: true, content: params.has('cards') ? <div data-executive-view=""><section data-exec-section="1"><CardDeck flip ariaLabel="Trace cards" cards={Array.from({length:5},(_,i)=>({id:i,title:<span data-exec-field={'card'+i+'.title'}>Trace {i}</span>,label:'Trace '+i,body:<span data-exec-field={'card'+i+'.body'}>Recorded evidence {i}</span>}))} /></section></div> : params.has('long') ? <section data-doc-section="" data-area="problem">
              <h2>Long document evidence</h2>
              {[0,1,2,3].map(i => <p key={i}>{'Paragraph '+i+' '+('A recorded trial connects a declared decision with its assumptions and independently inspected evidence. ').repeat(12)}</p>)}
              <div style={{height:900}} aria-hidden="true" />
              {[0,1].map(i => <div className="equation" key={i}><span>Formula {i}</span><p className="equation-caption">Caption {i}</p></div>)}
              <dl data-glossary="">{Array.from({length:10},(_,i)=><React.Fragment key={i}><dt>Term {i}</dt><dd>Definition {i}</dd></React.Fragment>)}</dl>
              <ol>{[0,1,2,3].map(i=><li key={i}>Recorded step {i} with a separate verification.</li>)}</ol>
            </section> : <p>Overview</p> },
            { id: 'analysis', label: 'Analysis', focus: true, content },
          ]} />
      </AppShell>
    );
  `);
});
after(async () => { await h?.close(); });

test('document surface fills its column and preserves Focus at desktop and phone sizes', async () => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const lang of ['en', 'es']) for (const theme of ['light', 'dark']) {
      const page = await h.browser.newPage({ viewport });
      try {
        await page.goto(`${h.address}/introduction?lang=${lang}&theme=${theme}`);
        await page.locator('[data-doc-page]').waitFor();
        const widths = await page.evaluate(() => {
          const root = document.querySelector('[data-surface]')!;
          const style = getComputedStyle(root);
          return {
            roots: document.querySelectorAll('.page-body').length,
            column: root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            padding: [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)],
            head: root.querySelector('.caos-surface-heading')!.getBoundingClientRect().width,
            lede: root.querySelector('.caos-surface-lede')!.getBoundingClientRect().width,
            body: root.querySelector('.caos-surface-body')!.getBoundingClientRect().width,
            ledeMax: getComputedStyle(root.querySelector('.caos-surface-lede')!).maxWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
          };
        });
        assert.equal(widths.roots, 1, 'no outer padded document wrapper');
        assert.ok(widths.padding.every(p => p > 0), 'root owns the shell inset');
        for (const key of ['head', 'lede', 'body'] as const) {
          assert.ok(Math.abs(widths[key] - widths.column) <= 2, `${key} fills the document column: ${JSON.stringify(widths)}`);
        }
        assert.equal(widths.ledeMax, 'none');
        assert.ok(widths.documentScrollWidth <= viewport.width);
        await page.evaluate(installLib);
        const doc = await page.evaluate(() => (window as any).__caosGate.docPage());
        assert.ok(Math.abs(doc.ledeWidth - widths.column) <= 2, 'the real gate sees a full-column document lede');
        assert.ok(doc.ledeWords > 0, 'the real gate reads the document introduction');
        await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
        await page.getByRole('tab', { name: 'Table', exact: true }).click();
        for (const exit of ['Escape', 'button']) {
          await page.locator('[data-focus-enter]').click();
          await page.locator('[data-focus-shell]').waitFor();
          assert.equal(new URL(page.url()).searchParams.get('view'), 'analysis');
          assert.equal(new URL(page.url()).searchParams.get('focus'), '1');
          assert.equal(await page.locator('[data-result="table"]').count(), 1);
          if (exit === 'Escape') await page.keyboard.press('Escape');
          else await page.locator('[data-focus-exit]').click();
          await page.locator('[data-doc-page]').waitFor();
          assert.equal(new URL(page.url()).searchParams.has('focus'), false);
          assert.equal(new URL(page.url()).searchParams.get('view'), 'analysis');
          assert.equal(await page.getByRole('tab', { name: 'Table', selected: true }).count(), 1);
        }
      } finally { await page.close(); }
    }
  }
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${h.address}/introduction?document=0`);
    await page.locator('[data-surface]').waitFor();
    assert.equal(await page.locator('[data-doc-page]').count(), 0);
    const w = await page.evaluate(() => ({
      lede: document.querySelector('.caos-surface-lede')!.getBoundingClientRect().width,
      body: document.querySelector('.caos-surface-body')!.getBoundingClientRect().width,
      max: getComputedStyle(document.querySelector('.caos-surface-lede')!).maxWidth,
    }));
    assert.notEqual(w.max, 'none');
    assert.ok(w.lede < w.body - 100, 'generic surface retains its reading measure');
  } finally { await page.close(); }
});

const fixture = (drawing: string, rootStyle = '') => `
  <main data-doc-page><div data-executive-view>
  <figure data-exec-illustration="pain" data-exec-file="fixture.svg">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" style="${rootStyle}">
      ${drawing}
    </svg><figcaption>Process diagram</figcaption>
  </figure></div></main>`;
const measure = async (page: any) => page.evaluate(() => (window as any).__caosGate.docPage().executive.illustrations[0]);

test('executive measurement uses root-space bounds for transformed SVG text', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    const cases = [
      { name: 'translated inside', drawing: '<g transform="translate(160 50)"><text x="-120" y="25" font-size="14">Dentro</text></g>', outside: false },
      { name: 'translated outside', drawing: '<g transform="translate(450 0)"><text x="20" y="50" font-size="14">Fuera</text></g>', outside: true },
      { name: 'scaled inside', drawing: '<g transform="translate(150 40) scale(2 .6)"><text x="-50" y="25" font-size="14">Scale</text></g>', outside: false },
      { name: 'scaled outside', drawing: '<g transform="scale(3 1)"><text x="190" y="25" font-size="14">Scale</text></g>', outside: true },
      { name: 'rotated inside', drawing: '<g transform="translate(100 100) rotate(45)"><text x="-10" y="0" font-size="14">Rotate</text></g>', outside: false },
      { name: 'rotated outside', drawing: '<g transform="translate(40 30) rotate(180)"><text x="20" y="0" font-size="14">Outside</text></g>', outside: true },
      { name: 'nested viewport', drawing: '<svg x="120" y="30" width="160" height="80" viewBox="0 0 80 40"><g transform="translate(40 5)"><text x="-20" y="15" font-size="14">Nested</text></g></svg>', outside: false },
      { name: 'nested outside', drawing: '<svg x="380" y="30" width="160" height="80" viewBox="0 0 80 40"><text x="20" y="15" font-size="14">Nested</text></svg>', outside: true },
    ];
    for (const rootStyle of ['', 'transform:translate(25px,10px) scale(1.2) rotate(8deg)']) {
      for (const sample of cases) {
        await page.setContent(fixture(sample.drawing, rootStyle));
        const info = await measure(page);
        assert.equal(info.labels, 1, sample.name);
        assert.equal(info.outside.length > 0, sample.outside, `${sample.name}: ${JSON.stringify(info)}`);
      }
    }
  } finally { await page.close(); }
});

test('executive measurement fails closed on unavailable matrices and retains visibility and font floors', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    for (const kind of ['missing-root', 'singular-root', 'missing-text', 'throwing-text']) {
      await page.setContent(fixture('<text x="20" y="40" font-size="14">Visible</text>'));
      await page.evaluate((kind) => {
        const root = document.querySelector('svg')!;
        const text = document.querySelector('text')!;
        if (kind === 'missing-root') root.getScreenCTM = () => null;
        if (kind === 'singular-root') root.getScreenCTM = () => new DOMMatrix([0, 0, 0, 1, 0, 0]);
        if (kind === 'missing-text') text.getScreenCTM = () => null;
        if (kind === 'throwing-text') text.getScreenCTM = () => { throw new Error('Unavailable'); };
      }, kind);
      const info = await measure(page);
      assert.equal(info.outside.length, 1, kind);
      assert.match(info.outside[0], /bounds unavailable/, kind);
    }
    await page.setContent(fixture('<text x="20" y="40" font-size="8">Too small</text><text x="20" y="80" font-size="9">At floor</text><text x="-400" y="40" style="display:none">Hidden</text>'));
    const info = await measure(page);
    assert.equal(info.labels, 2, 'same visibility filter; hidden label is not counted');
    assert.equal(info.small.length, 1, 'strict 9 px floor remains');
    assert.match(info.small[0], /Too small/);
    assert.deepEqual(info.outside, []);
    await page.setContent(fixture('<g clip-path="inset(0)"><text x="450" y="40" font-size="14">Clipped outside</text></g>'));
    assert.equal((await measure(page)).outside.length, 1, 'clipping does not waive visible geometry');
  } finally { await page.close(); }
});

test('rendered label font floor follows text screen scale including root rotation', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    const cases = [
      { name: 'quarter group scale', transform: 'scale(.25)', size: 18, small: true, px: '4.5px' },
      { name: 'half group scale at floor', transform: 'scale(.5)', size: 18, small: false },
      { name: 'just below floor', transform: 'scale(.4999)', size: 18, small: true },
      { name: 'above floor', transform: 'scale(.75)', size: 18, small: false },
      { name: 'expanded small local font', transform: 'scale(2)', size: 5, small: false },
      { name: 'nonuniform compression', transform: 'scale(.25 1)', size: 18, small: true, px: '4.5px' },
      { name: 'group rotation preserves floor', transform: 'rotate(35) scale(.5)', size: 18, small: false },
      { name: 'root rotation cannot enlarge a small font', transform: '', size: 8.5, small: true, px: '8.5px' },
      { name: 'skew reduces minimum scale', transform: 'skewX(60)', size: 12, small: true },
    ];
    for (const rootStyle of ['', 'transform:rotate(45deg)']) {
      for (const sample of cases) {
        await page.setContent(fixture(`<g transform="translate(100 80) ${sample.transform}"><text x="0" y="0" font-size="${sample.size}">Label</text></g>`, rootStyle));
        const info = await measure(page);
        assert.equal(info.small.length, sample.small ? 1 : 0, `${sample.name}, ${rootStyle}: ${JSON.stringify(info)}`);
        if (sample.px) assert.ok(info.small[0].includes(sample.px), sample.name);
      }
    }
    await page.setContent(fixture('<text x="0" y="0" transform="translate(100 80) scale(.25)" font-size="18">Text transform</text>'));
    assert.match((await measure(page)).small[0], /4\.5px/, 'text-local scale also applies');
  } finally { await page.close(); }
});

test('unmeasurable text font scale fails explicitly', async () => {
  const page = await h.browser.newPage();
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    for (const kind of ['missing', 'singular', 'nonfinite', 'throwing']) {
      await page.setContent(fixture('<text x="20" y="40" font-size="18">Visible label</text>'));
      await page.evaluate((kind) => {
        const text = document.querySelector('text')!;
        text.getScreenCTM = () => {
          if (kind === 'throwing') throw new Error('Unavailable matrix');
          if (kind === 'missing') return null;
          return new DOMMatrix(kind === 'singular' ? [0, 0, 0, 1, 0, 0] : [NaN, 0, 0, 1, 0, 0]);
        };
      }, kind);
      const info = await measure(page);
      assert.equal(info.small.length, 1, kind);
      assert.match(info.small[0], /font scale unavailable/, kind);
    }
  } finally { await page.close(); }
});

test('document traversal reads the complete long SurfacePage once and restores its scroll state', async () => {
  const page = await h.browser.newPage({viewport:{width:1280,height:800}});
  try {
    await page.goto(`${h.address}/introduction?long=1`);
    await page.evaluate(installLib);
    const result = await page.evaluate(async () => {
      const gate=(window as any).__caosGate;
      const scroll=document.querySelector('.caos-surface-body > .tabs > .tabpanel')!;
      scroll.scrollTop=100;
      const before=scroll.scrollTop;
      const first=await (gate.readDocument ? gate.readDocument() : gate.docPage());
      const second=await (gate.readDocument ? gate.readDocument() : gate.docPage());
      return {first,second,before,after:scroll.scrollTop};
    });
    assert.equal(result.first.sections[0].dense,4);
    assert.equal(result.first.sections[0].equations,2);
    assert.equal(result.first.sections[0].glossary,10);
    assert.equal(result.first.sections[0].steps,4);
    // issue 196: the walk reports its own cost (samples and milliseconds against the budget it earned); the time differs
    // between two walks, the evidence must not
    const {walk: firstWalk, ...firstEvidence} = result.first;
    const {walk: secondWalk, ...secondEvidence} = result.second;
    for (const walk of [firstWalk, secondWalk]) assert.ok(walk.samples > 0 && walk.samples <= walk.budgetSamples && walk.ms <= walk.budgetMs, JSON.stringify(walk));
    assert.equal(firstWalk.samples, secondWalk.samples, 'the same document costs the same samples');
    assert.deepEqual(firstEvidence,secondEvidence,'repeated traversal never duplicates evidence');
    assert.equal(result.after,result.before);
  } finally {await page.close();}
});

test('document traversal retains hidden, clipped, tiny, indented, inactive and covered glyph exclusions', async () => {
  const page=await h.browser.newPage({viewport:{width:1280,height:800}});
  try {
    await page.goto(h.address);
    await page.evaluate(installLib);
    for(const [name,style] of [
      ['hidden','display:none'],['opacity','opacity:0'],['tiny','font-size:1px'],
      ['indent','text-indent:-9999px'],['clip','clip-path:inset(0 0 100% 0)'],
    ]) {
      await page.setContent(`<div data-doc-page style="height:500px;overflow:auto"><section data-doc-section data-area="problem"><p style="${style}">${('Scientific evidence must be independently readable and testable within its declared process context. ').repeat(12)}</p></section></div>`);
      const result=await page.evaluate(async()=>(window as any).__caosGate.readDocument());
      assert.equal(result.sections.reduce((n: number,s: any)=>n+s.dense,0),0,name);
    }
    await page.setContent(`<div data-doc-page style="height:500px"><section data-doc-section data-area="problem"><div style="height:20px;overflow:hidden"><p>${('Unreachable clipped text never proves that a reader can inspect all of this paragraph. ').repeat(30)}</p></div></section><section data-doc-section data-area="problem" hidden><p>${'Inactive text '.repeat(100)}</p></section><div style="position:absolute;inset:0;background:white;z-index:99"></div></div>`);
    const result=await page.evaluate(async()=>(window as any).__caosGate.readDocument());
    assert.equal(result.sections.length,1,'inactive pane excluded');
    assert.equal(result.sections[0].dense,0,'clipped/covered partial paragraph excluded');
  } finally {await page.close()}
});

test('document traversal combines successive long-paragraph fragments and nested scrollers without duplicate rows', async()=>{
 const page=await h.browser.newPage({viewport:{width:1280,height:800}});
 try{await page.goto(h.address);await page.evaluate(installLib);
 await page.setContent(`<div data-doc-page style="height:420px;overflow:auto"><div style="height:350px"></div><section data-doc-section data-area="problem"><div style="height:550px;overflow:auto"><p style="width:240px">${('The full scientific paragraph remains a single item even while its readable glyph fragments require many successive scroll positions. ').repeat(18)}</p><dl data-glossary>${Array.from({length:10},(_,i)=>`<dt>Term ${i}</dt><dd>Definition ${i}</dd>`).join('')}</dl><ol>${[1,2,3,4].map(i=>`<li>Step ${i} verified independently against the record.</li>`).join('')}</ol><table><tbody>${[1,2].map(i=>`<tr><td>Row ${i}</td><td>Evidence</td><td><span data-stat data-stat-unit="kg" data-stat-source="Trial"><span class="caos-stat-value">${i}</span> <span class="caos-stat-unit">kg</span> <span class="caos-stat-source">Trial</span></span></td></tr>`).join('')}</tbody></table></div></section></div>`);
 const result=await page.evaluate(async()=>(window as any).__caosGate.readDocument());
 assert.equal(result.sections[0].dense,1);assert.equal(result.sections[0].glossary,10);assert.equal(result.sections[0].steps,4);assert.equal(result.sections[0].rows,4);assert.equal(result.sections[0].stats,2,'quantified statements count once across overlapping positions');
 }finally{await page.close()}
});

// issue 196: the budget scales with the document under absolute ceilings; a ceiling of zero samples exhausts it at the
// first sample, with the same message and the scroll position restored
test('document traversal fails explicitly on exhausted budget and restores position',async()=>{
 const page=await h.browser.newPage();try{await page.goto(`${h.address}/introduction?long=1`);await page.evaluate(installLib);
 const result=await page.evaluate(async()=>{const g=(window as any).__caosGate;const panel=document.querySelector('.tabpanel')!;panel.scrollTop=100;const before=panel.scrollTop;let error='';try{await g.readDocument({ceilingSamples:0})}catch(e){error=String(e)}return{before,after:panel.scrollTop,error}});
 assert.match(result.error,/exceeded/);assert.equal(result.before,result.after);
 }finally{await page.close()}
});

test('document traversal requires actual source-title glyphs and rejects a covering overlay independently',async()=>{
 const page=await h.browser.newPage({viewport:{width:1280,height:800}});try{await page.goto(h.address);await page.evaluate(installLib);
 await page.setContent(`<div data-doc-page style="height:420px;overflow:auto"><div data-executive-view><section data-exec-section="1" aria-label="The pain"><p data-exec-key-message data-exec-field="pain.key_message">A meaningful source can be inspected after scrolling.</p><div style="height:1000px"></div></section><ol data-exec-notes><li><a href="https://example.test/research">Recorded scientific source</a><span data-exec-source-note>Declared evidence note.</span></li></ol></div></div>`);
 const visible=await page.evaluate(async()=>(window as any).__caosGate.readDocument());
 assert.equal(visible.executive.notes[0].title,'Recorded scientific source');assert.equal(visible.executive.notes[0].href,'https://example.test/research');
 await page.locator('[data-exec-notes] a').evaluate(e=>(e as HTMLElement).style.fontSize='1px');
 const tiny=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(tiny.executive.notes[0].title,'');assert.equal(tiny.executive.notes[0].href,'https://example.test/research');
 await page.locator('[data-exec-notes] a').evaluate(e=>{(e as HTMLElement).style.fontSize='14px';(e as HTMLElement).style.pointerEvents='none'});
 const inertLink=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(inertLink.executive.notes[0].title,'','a URL and visible text do not prove an actionable source link');
 await page.setContent(`<div data-doc-page style="height:420px"><section data-doc-section data-area="problem"><p>${'Independently readable scientific evidence matters for every decision and every declared constraint. '.repeat(8)}</p></section></div><div style="position:fixed;inset:0;background:white;z-index:100"></div>`);
 const covered=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(covered.sections[0].dense,0,'a real overlay cannot be admitted as readable text');
 }finally{await page.close()}
});

test('document traversal uses real flip/deck controls, reaches every card and restores their state',async()=>{
 const page=await h.browser.newPage({viewport:{width:1280,height:800}});try{await page.goto(`${h.address}/introduction?cards=1`);await page.evaluate(installLib);
 const result=await page.evaluate(async()=>{const g=(window as any).__caosGate;const before=[...document.querySelectorAll('[data-flip-open],[data-deck-card]')].map(e=>[e.getAttribute('data-flip-open'),e.hasAttribute('hidden')]);(window as any).__documentClicks=0;document.addEventListener('click',()=>{(window as any).__documentClicks++});const doc=await g.readDocument();const after=[...document.querySelectorAll('[data-flip-open],[data-deck-card]')].map(e=>[e.getAttribute('data-flip-open'),e.hasAttribute('hidden')]);return{doc,before,after,clicks:(window as any).__documentClicks}});
 assert.equal(result.doc.executive.fields.length,10);assert.deepEqual(result.doc.executive.fields.filter((f:any)=>!f.readable),[]);assert.deepEqual(result.after,result.before);assert.ok(result.clicks>=10,'actual controls must turn the cards');
 assert.deepEqual(await page.evaluate(()=>(window as any).__caosGate.contrast()),[],'restored deck is settled before later contrast checks');
 await page.locator('[data-flip-toggle="front"]').first().evaluate(e=>(e as HTMLButtonElement).disabled=true);
 await assert.rejects(()=>page.evaluate(async()=>(window as any).__caosGate.readDocument()),/control is unavailable/);
 }finally{await page.close()}
});

test('document traversal witnesses below-fold textless live controls without admitting hidden controls',async()=>{
 const page=await h.browser.newPage({viewport:{width:1280,height:800}});try{await page.goto(h.address);await page.evaluate(installLib);
 await page.setContent(`<div data-doc-page style="height:420px;overflow:auto"><section data-doc-section data-area="live"><div style="height:1100px"></div><label>Trial setting <input type="range" data-control="trial" min="0" max="10" value="4"></label></section></div>`);
 const before=await page.evaluate(()=>(window as any).__caosGate.docPage());assert.equal(before.sections[0].controls,0,'below-fold presence is not evidence');
 const observed=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(observed.sections[0].controls,1,'textless range must be witnessed through real scrolling');
 const repeated=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(repeated.sections[0].controls,1,'overlapping and repeated scrolls do not multiply a control');
 for(const style of ['display:none','opacity:0','visibility:hidden','clip-path:inset(0 0 100% 0)','pointer-events:none']){
  await page.locator('[data-control="trial"]').evaluate((e,s)=>e.setAttribute('style',s),style);
  const hidden=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(hidden.sections[0].controls,0,style);
 }
 await page.setContent(`<div data-doc-page style="height:420px;overflow:auto"><section data-doc-section data-area="live"><div style="height:1px;overflow:hidden"><input type="range" data-control="clipped"></div></section><section data-doc-section data-area="live" hidden><input type="range" data-control="inactive"></section></div>`);
 const clipped=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(clipped.sections[0].controls,0,'permanent overflow clipping cannot produce control evidence');assert.equal(clipped.sections.length,1);
 await page.setContent(`<div data-doc-page style="height:420px"><section data-doc-section data-area="live"><input type="range" data-control="covered"></section></div><div style="position:fixed;inset:0;background:white;z-index:100"></div>`);
 const covered=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(covered.sections[0].controls,0,'covered controls are not pointer reachable');
 }finally{await page.close()}
});

const reviewParagraph = 'Independent scientific evidence connects each declared process decision to its recorded physical assumptions and measurable limits. '.repeat(5);
const reviewProse = `<section data-doc-section data-area="problem"><p>${reviewParagraph}</p><p>Second ${reviewParagraph}</p></section>`;

test('document traversal rejects each document and outer clipping boundary independently',async(t)=>{
 for(const [name,html]of[
  ['document clip-path',`<div data-doc-page style="height:500px;clip-path:inset(0 0 100% 0)">${reviewProse}</div>`],
  ['ancestor clip-path',`<div style="clip-path:inset(0 0 100% 0)"><div data-doc-page style="height:500px">${reviewProse}</div></div>`],
  ['ancestor zero-height overflow',`<div style="height:0;overflow:hidden"><div data-doc-page style="height:500px">${reviewProse}</div></div>`],
 ])await t.test(name,async()=>{const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);await page.setContent(`<style>body{margin:0;font:16px/24px Arial}p{pointer-events:none}</style>${html}`);const raw=await page.evaluate(()=>(window as any).__caosGate.docPage());assert.equal(raw.sections[0].dense,0,'clipping itself must reject the glyphs, independently of obstruction tests');const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,0,name);assert.notDeepEqual(failedRules(d.sections[0],{dense:2}),[],'actual production floor must reject invisible prose')}finally{await page.close()}});
 const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);await page.setContent(`<style>body{margin:0;font:16px/24px Arial}</style><div data-doc-page style="height:500px">${reviewProse}</div>`);const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,2);assert.deepEqual(failedRules(d.sections[0],{dense:2}),[])}finally{await page.close()}
});

test('document traversal distinguishes opaque ancestor pseudo paint from pointer-transparent prose',async(t)=>{
 for(const [name,rule]of[
  ['opaque ancestor after','#coat::after{content:"";position:absolute;inset:0;background:white;z-index:99}'],
  ['opaque ancestor before','#coat::before{content:"";position:absolute;inset:0;background:white;z-index:99}'],
  ['opaque cover with pointer-transparent prose','#coat p{pointer-events:none}#coat::after{content:"";position:absolute;inset:0;background:white;z-index:99}'],
  ['pointer-transparent opaque cover','#coat::after{content:"";position:absolute;inset:0;background:white;z-index:99;pointer-events:none}'],
 ])await t.test(name,async()=>{const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);await page.setContent(`<style>body{margin:0;font:16px/24px Arial}#coat{position:relative}${rule}</style><div data-doc-page id="coat" style="height:500px">${reviewProse}</div>`);const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,0,name);assert.notDeepEqual(failedRules(d.sections[0],{dense:2}),[])}finally{await page.close()}});
 const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);await page.setContent(`<style>body{margin:0;font:16px/24px Arial}p{pointer-events:none}</style><div data-doc-page style="height:500px">${reviewProse}</div>`);const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,2);assert.deepEqual(failedRules(d.sections[0],{dense:2}),[])}finally{await page.close()}
});

test('document traversal fails closed for ambiguous pseudo containing blocks',async(t)=>{
 for(const [name,position,ancestor,scaled]of[
  ['exact scaled absolute white page','absolute','transform:scale(2);transform-origin:top left',true],
  ['scaled fixed containing block','fixed','transform:scale(2);transform-origin:top left',true],
  ['filtered fixed containing block','fixed','filter:blur(0px)',false],
  ['perspective fixed containing block','fixed','perspective:1000px',false],
  ['contained fixed containing block','fixed','contain:layout paint',false],
  ['will-change transform fixed containing block','fixed','will-change:transform',false],
  ['will-change filter fixed containing block','fixed','will-change:filter',false],
 ] as const)await t.test(name,async()=>{const page=await h.browser.newPage({viewport:{width:800,height:600}});try{
  await page.goto(h.address);await page.evaluate(installLib);
  await page.setContent(`<style>body{margin:0;font:16px/24px Arial}p{font-size:${scaled?8:16}px;line-height:${scaled?9:18}px;margin:0}#coat::after{content:"";position:${position};left:0;top:0;width:300px;height:600px;background:white;z-index:99;pointer-events:none}</style><div data-doc-page id="coat" style="position:relative;${ancestor};width:350px;height:600px;${scaled?'':'margin-left:400px'}"><section data-doc-section data-area="problem" style="position:absolute;left:${scaled?200:0}px;top:0;width:${scaled?100:200}px"><p>${reviewParagraph}</p><p>Second ${reviewParagraph}</p></section></div>`);
  const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,0,name);assert.notDeepEqual(failedRules(d.sections[0],{dense:2}),[]);
 }finally{await page.close()}});
 await t.test('scaled pointer-transparent prose without painted pseudo remains visible',async()=>{const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);await page.setContent(`<style>body{margin:0;font:16px/24px Arial}p{font-size:8px;line-height:9px;margin:0;pointer-events:none}</style><div data-doc-page style="position:relative;transform:scale(2);transform-origin:top left;width:350px;height:600px"><section data-doc-section data-area="problem" style="position:absolute;left:200px;top:0;width:100px"><p>${reviewParagraph}</p><p>Second ${reviewParagraph}</p></section></div>`);const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,2);assert.deepEqual(failedRules(d.sections[0],{dense:2}),[])}finally{await page.close()}});
});

test('document traversal trusts only known-safe own pseudo paint geometry',async(t)=>{
 for(const [name,rule,expected]of[
  ['exact own translate white cover','translate:400px 0',0],
  ['own rotate white cover','rotate:180deg;transform-origin:300px 600px',0],
  ['own scale white cover','scale:3 1;transform-origin:0 0',0],
  ['own transform white cover','transform:translateX(400px)',0],
  ['own motion path white cover',`offset-path:path("M 400 0 L 400 0");offset-anchor:0 0;offset-distance:0px`,0],
  ['own zoom white cover','zoom:3',0],
  ['own filter expands paint','filter:drop-shadow(400px 0 0 white)',0],
  ['own shadow expands paint','box-shadow:400px 0 white',0],
  ['transparent own translate leaves prose visible','translate:400px 0;background:transparent',2],
  ['plain nonoverlapping positioned paint','',2],
 ] as const)await t.test(name,async()=>{const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);
  await page.setContent(`<style>body{margin:0;font:16px/24px Arial}p{font-size:16px;line-height:18px;margin:0}#coat::after{content:"";position:absolute;left:0;top:0;width:200px;height:1200px;background:white;z-index:99;pointer-events:none;${rule}}</style><div data-doc-page id="coat" style="position:relative;width:750px;height:1200px"><section data-doc-section data-area="problem" style="position:absolute;left:400px;top:0;width:200px"><p>${reviewParagraph}</p><p>Second ${reviewParagraph}</p></section></div>`);
  const geometry=await page.locator('p').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));assert.deepEqual(geometry,[{left:400,right:600,top:0,bottom:540},{left:400,right:600,top:540,bottom:1080}],'complete ordinary glyph geometry is unchanged');
  const d=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(d.sections[0].dense,expected,name);if(expected===0)assert.notDeepEqual(failedRules(d.sections[0],{dense:2}),[]);else assert.deepEqual(failedRules(d.sections[0],{dense:2}),[]);
 }finally{await page.close()}});
});

test('document traversal witnesses narrow fractional punctuation without accepting covered glyphs',async()=>{
 const page=await h.browser.newPage({viewport:{width:800,height:600}});try{await page.goto(h.address);await page.evaluate(installLib);
 const html=`<style>body{margin:0;font:16px/24.8px ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}p{padding-left:253.40625px}.label{display:inline-block;font-size:12px;text-transform:uppercase;letter-spacing:.04em;font-weight:650}</style><div data-doc-page style="height:400px"><div data-executive-view><section data-exec-section="1"><p data-exec-field="trial"><span id="dot">·</span> <span class="label">When</span> Today</p></section></div></div>`;
 await page.setContent(html);const visible=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(visible.executive.fields[0].text,'· When Today');assert.equal(visible.executive.fields[0].readable,true);
 await page.addStyleTag({content:'p{padding-left:312.359375px}'});const shifted=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(shifted.executive.fields[0].text,'· When Today');assert.equal(shifted.executive.fields[0].readable,true,'second fractional boundary from the Spanish fixture');
 await page.addStyleTag({content:'#dot{position:relative}#dot::after{content:"";position:absolute;inset:0;background:white;pointer-events:none;z-index:99}'});const covered=await page.evaluate(async()=>(window as any).__caosGate.readDocument());assert.equal(covered.executive.fields[0].text,'When Today','covered punctuation must not donate text');assert.equal(covered.executive.fields[0].readable,false);
 }finally{await page.close()}
});

test('document traversal restores default body and focused tab and verifies failure independently',async(t)=>{
 for(const mode of ['body','tab','failed-tab'])await t.test(mode,async()=>{const page=await h.browser.newPage({viewport:{width:1280,height:800}});try{await page.goto(`${h.address}/introduction?cards=1`);await page.evaluate(installLib);await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)});
 if(mode!=='body')await page.locator('[data-tab="overview"]').focus();
 const before=await page.evaluate(()=>({body:document.activeElement===document.body,tab:document.activeElement?.getAttribute('data-tab')}));
 if(mode==='failed-tab')await page.locator('[data-tab="overview"]').evaluate(e=>Object.defineProperty(e,'focus',{value:HTMLElement.prototype.blur}));
 if(mode==='failed-tab'){await assert.rejects(()=>page.evaluate(async()=>(window as any).__caosGate.readDocument()),/focus.*restor/i);return}
 if(mode==='body')assert.equal(before.body,true);
 await page.evaluate(async()=>(window as any).__caosGate.readDocument());
 const after=await page.evaluate(()=>({body:document.activeElement===document.body,tab:document.activeElement?.getAttribute('data-tab')}));assert.deepEqual(after,before,'initial focus is an enforced postcondition');
 }finally{await page.close()}});
});
