import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {startHarness,type Harness} from './harness';
import {mobileStageEntry} from './mobileStage.fixture';
let h:Harness;
// Grid track allocation is a supported instrument composition: the Stage plus an intrinsic-height
// explanation/warning. A descendant viewport floor must not paint through that sibling.
before(async()=>{h=await startHarness(mobileStageEntry.replace("display:'flex',flexDirection:'column',flex:'1 1 auto',minHeight:280,height:'100%'","display:'grid',gridTemplateRows:'minmax(0,1fr) auto',minHeight:280,height:'100%'"));});
after(async()=>{await h?.close();});
for(const [width,height] of [[390,844],[768,1024],[1280,800],[1600,900],[2560,1440]])for(const lang of ['en','es'])for(const theme of ['light','dark'])
test(`Story actual Stage fits its grid track above complete takeaway ${width}/${lang}/${theme}`,async()=>{
 const page=await h.browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 try{for(const wide of [false,true]){
  await page.goto(`${h.address}/?surface=story&sections=1&lang=${lang}&theme=${theme}`);await page.locator('[data-mobile-drawing]').waitFor();
  if(wide)await page.addStyleTag({content:':root,:root[data-theme]{--font-sans:Verdana,"DejaVu Sans",sans-serif!important}'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
  const facts=await page.locator('.caos-story-stage').evaluate(host=>{const stage=host.querySelector<HTMLElement>('.caos-stage')!,drawing=host.querySelector('[data-mobile-drawing]')!,takeaway=stage.nextElementSibling!,scene=stage.parentElement!,s=stage.getBoundingClientRect(),d=drawing.getBoundingClientRect(),t=takeaway.getBoundingClientRect(),h=host.getBoundingClientRect(),c=scene.getBoundingClientRect();return{stage:s.toJSON(),drawing:d.toJSON(),takeaway:t.toJSON(),scene:c.toJSON(),host:h.toJSON(),share:d.width*d.height/(innerWidth*innerHeight),width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,text:takeaway.textContent,cuts:takeaway.scrollHeight>takeaway.clientHeight+1};});
  assert.ok(facts.stage.bottom<=facts.takeaway.top+.5,'Stage stays in its real track before the takeaway');assert.ok(facts.stage.top>=facts.scene.top-.5&&facts.takeaway.bottom<=facts.scene.bottom+.5,'scene contains drawing and takeaway');assert.ok(facts.scene.bottom<=facts.host.bottom+.5,'outer shared owner contains the full scene');assert.ok(facts.share>=.8,`actual drawing share ${facts.share}`);assert.equal(facts.cuts,false);assert.match(facts.text??'',lang==='es'?/Geometría sintética/:/Synthetic geometry/);assert.ok(facts.width<=width+1);if(width>=1280)assert.ok(facts.height<=height+1,'desktop remains contained');
  await page.locator('#fixture-row').scrollIntoViewIfNeeded();await page.locator('#fixture-row').selectOption('1');assert.equal(await page.locator('[data-mobile-drawing]').getAttribute('data-fixture-row'),'1');
 }}finally{await page.close();}
});
