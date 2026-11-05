import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {chromium,type Browser} from '@playwright/test';
import {buildFixture} from '../test/gate-fixture/build.mjs';
import {servePages} from '../gate/serve.mjs';
import {installLib} from '../gate/inpage.mjs';
let directory:string,browser:Browser,server:Awaited<ReturnType<typeof servePages>>;
before(async()=>{const baseline=process.env.CAOS_FOCUS_DOCK_BASELINE_FIXTURE;if(baseline){server=await servePages(baseline,'/');}else{directory=await mkdtemp(join(tmpdir(),'caos-focus-dock-'));assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await buildFixture(directory);server=await servePages(directory,'/');}browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();await server?.close();if(directory){assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});}});
for(const width of [1280,1600,2560])for(const lang of ['en','es'])for(const theme of ['light','dark'])
test(`actual clean Focus dock retains complete plain-node controls without scrolling ${width}/${lang}/${theme}`,async()=>{
 const page=await browser.newPage({viewport:{width,height:width===1280?800:width===1600?900:1440},reducedMotion:'reduce'});
 await page.addInitScript(installLib);await page.addInitScript(({lang,theme})=>{localStorage.setItem('caos.lang',lang);localStorage.setItem('caos.theme',theme)},{lang,theme});
 try{for(const wide of [false,true])for(const id of ['c-low','c-mid','c-high']){await page.goto(server.url+`app?case=${id}&focus=1&view=model`);await page.locator('[data-focus-shell] [data-control="scale"] input').waitFor();if(wide)await page.addStyleTag({content:':root,:root[data-theme]{--font-sans:Verdana,"DejaVu Sans",sans-serif!important}'});await page.waitForTimeout(100);
  const m=await page.evaluate(()=>{const rail=document.querySelector<HTMLElement>('.caos-focus-rail')!,r=rail.getBoundingClientRect(),facts=window.__caosGate.focusFacts();return{client:rail.clientHeight,scroll:rail.scrollHeight,facts,controls:[...rail.querySelectorAll<HTMLElement>('input,select,button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const b=e.getBoundingClientRect();return{id:e.id,text:e.textContent,inside:b.top>=r.top-1&&b.bottom<=r.bottom+1&&b.left>=r.left-1&&b.right<=r.right+1};}),last:rail.querySelector('.caos-readout-row:last-child')!.getBoundingClientRect().bottom,bottom:r.bottom,readoutRows:rail.querySelectorAll('.caos-readout-row').length,titleFont:getComputedStyle(document.querySelector('.caos-focus-label strong')!).fontSize,controlFont:getComputedStyle(document.querySelector('.caos-knob-head')!).fontSize};});
  assert.ok(m.scroll<=m.client+1,`${width}/${lang}/${theme}/wide=${wide}/${id}: actual rail ${m.scroll}/${m.client}`);assert.ok(m.controls.every(c=>c.inside),JSON.stringify(m.controls));assert.ok(m.last<=m.bottom+1,'the full final readout remains visible');assert.equal(m.readoutRows,3);assert.equal(m.titleFont,'15.36px');assert.equal(m.controlFont,'12.8px','established readable fonts are retained');assert.equal(m.facts.cutSelects.count,0);assert.deepEqual(m.facts.covered,[]);
  const scale=page.locator('[data-control="scale"] input'),held=Number(await scale.inputValue());await scale.focus();await page.keyboard.press('ArrowRight');assert.ok(Number(await scale.inputValue())>held);assert.equal(await page.locator('[data-control="recovery"] input').isDisabled(),true);
 }}finally{await page.close();}
});
