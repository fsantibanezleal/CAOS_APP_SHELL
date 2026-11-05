import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {installLib} from '../gate/inpage.mjs';
import {startHarness,type Harness} from './harness';
let h:Harness;
before(async()=>{h=await startHarness(`import {createRoot} from 'react-dom/client';import {FocusShell} from './src/index';createRoot(document.getElementById('root')).render(<FocusShell title="Coverage fixture" description="Synthetic layout only" hud={[{label:'Quantity',value:'1'}]} onExit={()=>{}} exitLabel="Exit" stageLabel="Stage" rail={<label>Control<input defaultValue="1"/></label>} stage={<div className="caos-cw-focus" data-case-workbench=""><button>Native stage control</button></div>}/>);`);});
after(async()=>{await h?.close();});
for(const composition of ['owner','legacy'])
test(`G18 detects the same planted chrome overlap with ${composition} metadata and accepts its clean control`,async()=>{
 const page=await h.browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 try{await page.addInitScript(installLib);await page.goto(h.address);await page.getByRole('button',{name:'Native stage control',exact:true}).waitFor();
  if(composition==='legacy')await page.evaluate(()=>{const root=document.querySelector('[data-focus-shell]')!,stage=root.querySelector('.caos-focus-stage')!;for(const e of root.querySelectorAll(':scope > .caos-focus-label,:scope > .caos-focus-hud,:scope > .caos-focus-actions'))stage.append(e);});
  assert.deepEqual(await page.evaluate(()=>window.__caosGate.focusFacts().covered),[]);
  const plant=await page.addStyleTag({content:'.caos-focus-instrument > .caos-cw-focus { padding-top:.4rem!important }.caos-focus-label {position:fixed!important;left:0!important;top:0!important;width:400px!important;margin:0!important;z-index:100!important}'});
  const hit=await page.evaluate(()=>window.__caosGate.focusFacts().covered);assert.ok(hit.some((x:{control:string;chrome:string})=>x.chrome==='the stage label'&&x.control==='Native stage control'),`${composition}: the physical overlap must remain red`);
  await plant.evaluate(e=>e.remove());assert.deepEqual(await page.evaluate(()=>window.__caosGate.focusFacts().covered),[]);
 }finally{await page.close();}
});
