import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';
import { mobileStageEntry } from './mobileStage.fixture';

const output = process.env.CAOS_TEMP_ROOT;
let h: Harness;
before(async () => { h = await startHarness(mobileStageEntry, {}, process.env.CAOS_MOBILE_BASELINE_CSS ? pathToFileURL(process.env.CAOS_MOBILE_BASELINE_CSS) : undefined); if (output) await mkdir(output, { recursive: true }); });
after(async () => { await h?.close(); });
const sizes = [[390, 844], [768, 1024], [1280, 800], [1600, 900], [2560, 1440]];
const measure = (page: Page) => page.evaluate(() => {
  const drawing = document.querySelector<SVGSVGElement>('[data-mobile-drawing]')!, stage = drawing.closest<HTMLElement>('.caos-stage')!;
  const root = document.querySelector<HTMLElement>('[data-focus-shell]'), rail = document.querySelector<HTMLElement>('[data-stage-panel], [data-rail]')!;
  const r = drawing.getBoundingClientRect(), s = stage.getBoundingClientRect(), p = rail.getBoundingClientRect();
  const host = document.querySelector<HTMLElement>('.caos-story-stage, .caos-focus-instrument, .caos-wb-main')!.getBoundingClientRect();
  const cards = [...document.querySelectorAll<HTMLElement>('[data-caos-callout]')].map(e => e.getBoundingClientRect());
  const subjects = [...drawing.querySelectorAll<SVGCircleElement>('[data-fixture-subject]')].map(e => e.getBoundingClientRect());
  return { drawing: r.toJSON(), stage: s.toJSON(), rail: p.toJSON(), share: r.width * r.height / (innerWidth * innerHeight),
    horizontal: document.documentElement.scrollWidth > innerWidth + 1, documentHeight: document.documentElement.scrollHeight,
    viewportHeight: innerHeight, panelOverflow: rail.scrollHeight > rail.clientHeight + 1,
    drawingHeight: Number(drawing.getAttribute('height')), drawn: stage.dataset.drawn,
    clearTop: document.querySelector<HTMLElement>('.caos-focus-stage')?.style.getPropertyValue('--caos-focus-clear-top'),
    rootOverflow: root ? root.scrollHeight > root.clientHeight + 1 : false,
    overlap: subjects.some(a => cards.some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
    cardOverlap: cards.some((a,i) => cards.some((b,j) => i < j && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
    hostContains: r.top>=host.top-1&&r.bottom<=host.bottom+1&&r.left>=host.left-1&&r.right<=host.right+1,
    cellOverflow: [...drawing.querySelectorAll('g > g')].some(e => { const rect = e.querySelector('rect'), text=e.querySelector('text'); if(!rect||!text)return false; const a=rect.getBoundingClientRect(),b=text.getBoundingClientRect();return b.left<a.left-1||b.right>a.right+1||b.top<a.top-1||b.bottom>a.bottom+1; }),
  };
});

for (const [width,height] of sizes) for (const lang of ['en','es']) for (const theme of ['light','dark']) {
  test(`actual mobile stage and docked controls ${width}x${height} ${lang}/${theme}`, async () => {
    const page = await h.browser.newPage({ viewport: { width,height }, reducedMotion:'reduce' });
    const records = [];
    try {
      for (const surface of ['app','story','story-sections','focus']) {
        await page.goto(`${h.address}/?surface=${surface.startsWith('story')?'story':'app'}&lang=${lang}&theme=${theme}&native=fixture-native&case=c1${surface==='focus'?'&focus=1':''}${surface==='story-sections'?'&sections=1':''}`);
        await page.locator('[data-mobile-drawing]').waitFor({timeout:5000}); await page.waitForTimeout(40);
        const m = await measure(page); records.push({surface,...m});
        assert.equal(m.drawn,'1'); assert.equal(m.horizontal,false); assert.equal(m.overlap,false); assert.equal(m.cardOverlap,false); assert.equal(m.cellOverflow,false);
        assert.ok(Math.abs(m.drawing.height-m.stage.height)<2,'measure the real Stage child, not an enclosing empty host');
        assert.equal(m.hostContains,true,'the real drawing is not clipped by a smaller enclosing host');
        assert.ok(m.share >= (surface==='app'?.6:.8),`${surface}: real drawing share ${m.share}`);
        if(width<900){
          assert.ok(m.drawing.height>=height*.85,`${surface}: readable primary drawing ${m.drawing.height}px`);
          assert.ok(m.rail.top>=m.drawing.bottom-1,`${surface}: the one panel is docked below the drawing`);
          assert.equal(m.panelOverflow,false,'the docked panel has no accidental independent scrolling');
          if(surface==='focus'){assert.equal(m.clearTop,'0px','docked mobile chrome has no stale overlay clearance');assert.equal(m.documentHeight<=height+1,true,'Focus has one owner, not page scrolling');}
        }else{assert.ok(m.documentHeight<=height+1,'desktop stays contained');assert.ok(m.drawing.height>height*.45,'desktop real drawing survives');}
        await page.locator('#fixture-row').scrollIntoViewIfNeeded();await page.locator('#fixture-row').selectOption('1');
        assert.equal(await page.locator('[data-mobile-drawing]').getAttribute('data-fixture-row'),'1');
        await page.locator('[data-fixture-scene-row="0"]').scrollIntoViewIfNeeded();await page.locator('[data-fixture-scene-row="0"]').press('Enter');
        assert.equal(await page.locator('#fixture-row').inputValue(),'0','scene keyboard selection updates the docked control');
        assert.equal(new URL(page.url()).searchParams.get('native'),'fixture-native');
        if(surface==='focus'){await page.locator('#fixture-last').scrollIntoViewIfNeeded();await page.locator('#fixture-last').click();await page.keyboard.press('Escape');await page.locator('[data-focus-enter]').waitFor();assert.equal(await page.locator('[data-mobile-drawing]').getAttribute('data-fixture-row'),'1');assert.equal(await page.locator('[data-focus-enter]').evaluate(e=>e===document.activeElement),true);}
        if(surface.startsWith('story')){await page.locator('[data-story]').focus();await page.keyboard.press('ArrowRight');assert.equal(new URL(page.url()).searchParams.get('step'),'two');await page.getByRole('button',{name:lang==='es'?'Reproducir historia':'Play story',exact:true}).click();await page.locator('#fixture-row').press('ArrowDown');assert.equal(await page.getByRole('button',{name:lang==='es'?'Reproducir historia':'Play story',exact:true}).getAttribute('aria-pressed'),'false');}
        if(surface==='story-sections'){await page.getByRole('tab',{name:lang==='es'?'Fuente':'Source',exact:true}).click();await page.getByText('Synthetic layout fixture, not scientific evidence.',{exact:true}).waitFor();await page.getByRole('tab',{name:lang==='es'?'Fuente':'Source',exact:true}).press('Home');await page.locator('#fixture-row').waitFor();assert.equal((await measure(page)).hostContains,true);}
      }
    } finally {
      if(output){await page.screenshot({path:`${output}/${width}-${lang}-${theme}.png`});await writeFile(`${output}/${width}-${lang}-${theme}.json`,JSON.stringify(records,null,2));}
      await page.close();
    }
  });
}

test('mobile Focus owns long HUD/control scroll, keeps exit reachable and clears padding after resize', async()=>{
 const page=await h.browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{await page.goto(`${h.address}/?focus=1&hud=1&longpanel=1&native=fixture-native`);await page.locator('[data-mobile-drawing]').waitFor();await page.locator('#fixture-last').scrollIntoViewIfNeeded();await page.locator('[aria-label="setting 27"]').scrollIntoViewIfNeeded();
  const exit=await page.locator('[data-focus-exit]').boundingBox();assert.ok(exit&&exit.y>=0&&exit.y+exit.height<=844,'exit stays reachable while the one scroll owner moves deep into controls');
  assert.equal((await measure(page)).clearTop,'0px');await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(80);const desktop=await measure(page);assert.equal(desktop.clearTop,'0px','desktop metadata is beside the drawing, not stale overlay padding');assert.ok(desktop.share>=.8);await page.setViewportSize({width:768,height:1024});await page.waitForTimeout(80);assert.equal((await measure(page)).clearTop,'0px');
  await page.locator('[data-focus-exit]').click();assert.equal(new URL(page.url()).searchParams.has('focus'),false);
 }finally{await page.close();}
});

test('wide translated typography preserves drawing area and complete docked controls', async()=>{
 for(const width of [390,1280])for(const lang of ['en','es'])for(const theme of ['light','dark'])for(const surface of ['app','story','focus']){
  const height=width===390?844:800,page=await h.browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  try{await page.goto(`${h.address}/?surface=${surface==='story'?'story':'app'}&sections=1&lang=${lang}&theme=${theme}${surface==='focus'?'&focus=1':''}`);await page.locator('[data-mobile-drawing]').waitFor();await page.addStyleTag({content:':root { --font-sans: Verdana, sans-serif; } body { letter-spacing: .7px; }'});await page.waitForTimeout(80);const m=await measure(page);assert.equal(m.horizontal,false);assert.equal(m.hostContains,true,`${width}/${lang}/${theme}/${surface}: actual drawing stays inside its host`);assert.equal(m.cellOverflow,false);assert.equal(m.overlap,false);assert.ok(m.share>=(surface==='app'?.6:.8),`${width}/${lang}/${theme}/${surface}: share ${m.share}`);await page.locator('#fixture-method').scrollIntoViewIfNeeded();await page.locator('#fixture-method').selectOption('b');assert.equal(await page.locator('[data-mobile-drawing]').getAttribute('data-fixture-method'),'b');}
  finally{await page.close();}
 }
});
