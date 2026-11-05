import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {installLib} from '../gate/inpage.mjs';
import {startHarness,type Harness} from './harness';
let h:Harness;
before(async()=>{h=await startHarness(`
 import {useRef,useState} from 'react';import {createRoot} from 'react-dom/client';import {NativeSelect} from './src/index';
 const q=new URLSearchParams(location.search),es=q.get('lang')==='es';document.documentElement.lang=es?'es':'en';document.documentElement.dataset.theme=q.get('theme')??'light';
 function App(){const [value,setValue]=useState('a'),[extra,setExtra]=useState(false),[disabled,setDisabled]=useState(false),ref=useRef(null);window.nativeRef=ref;window.changes??=0;
 const long=es?'r0031 · Velocidad del sistema, paso seis con una descripción completa y referencia ABCDEFGHIJKLMNOPQRSTUVWXYZ':'r0031 · System velocity at step six with a complete description and reference ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 const opts=<><optgroup label="Disabled group" disabled><option value="disabled">Disabled option</option></optgroup><optgroup label="Active group"><option value="a">Short</option><option value="b">{long}</option>{extra&&<option value="c" label="DOM label takes precedence">Different option child text</option>}</optgroup></>;
 return <form style={{width:180,margin:16}}><label htmlFor="controlled">Controlled native</label><NativeSelect id="controlled" name="row" value={value} disabled={disabled} required ref={ref} onChange={e=>{window.changes++;setValue(e.target.value)}}>{opts}</NativeSelect><label htmlFor="uncontrolled">Uncontrolled native</label><NativeSelect id="uncontrolled" name="choice" defaultValue="b">{opts}</NativeSelect><button type="button" id="dynamic" onClick={()=>{setExtra(true);setValue('c')}}>Dynamic options</button><button type="button" id="disable" onClick={()=>setDisabled(x=>!x)}>Disable</button><button type="reset">Reset form</button><NativeSelect id="listbox" multiple defaultValue={['a','b']} size={3}>{opts}</NativeSelect></form>;
 }createRoot(document.getElementById('root')).render(<App/>);
`);});
after(async()=>{await h?.close();});

for(const lang of ['en','es'])for(const theme of ['light','dark'])
test(`NativeSelect preserves native state, full labels and hit targets ${lang}/${theme}`,async()=>{
 const page=await h.browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 page.setDefaultTimeout(5000);
 page.setDefaultNavigationTimeout(30000);
 try{await page.addInitScript(installLib);await page.goto(`${h.address}/?lang=${lang}&theme=${theme}`);await page.locator('#controlled').waitFor();await page.addStyleTag({content:':root,:root[data-theme]{--font-sans:Verdana,"DejaVu Sans",sans-serif!important}'});
  assert.equal(await page.getByRole('combobox',{name:'Controlled native',exact:true}).count(),1);assert.equal(await page.locator('#controlled').getAttribute('name'),'row');assert.equal(await page.evaluate(()=>window.nativeRef.current===document.getElementById('controlled')),true);
  assert.equal(await page.locator('#uncontrolled').inputValue(),'b');assert.match(await page.locator('#uncontrolled').locator('..').locator('.cs-select-text').innerText(),/r0031/);
  await page.locator('#controlled').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.locator('#controlled').inputValue(),'b');assert.ok(await page.evaluate(()=>window.changes)>0);assert.match(await page.locator('#controlled').locator('..').locator('.cs-select-text').innerText(),/r0031/);
  const fit=await page.locator('#controlled').evaluate(select=>{const wrapper=select.parentElement!,text=wrapper.querySelector('.cs-select-text')!,r=select.getBoundingClientRect();return{textCuts:text.scrollWidth>text.clientWidth+1||text.scrollHeight>text.clientHeight+1,hits:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===select,height:r.height}});assert.equal(fit.textCuts,false);assert.equal(fit.hits,true);assert.ok(fit.height>40,'long text wraps rather than being shortened');
  assert.equal((await page.evaluate(()=>window.__caosGate.focusFacts().cutSelects.count)),0);
  await page.locator('#disable').click();assert.equal(await page.locator('#controlled').isDisabled(),true);await page.locator('#disable').click();await page.locator('#dynamic').click();assert.equal(await page.locator('#controlled').inputValue(),'c');assert.equal(await page.locator('#controlled').locator('..').locator('.cs-select-text').innerText(),'DOM label takes precedence');
  await page.locator('#uncontrolled').selectOption('a');await page.getByRole('button',{name:'Reset form',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#uncontrolled')?.value==='b');await page.waitForFunction(()=>document.querySelector('#uncontrolled')?.parentElement?.querySelector('.cs-select-text')?.textContent?.includes('r0031'));
  assert.equal(await page.locator('#listbox').getAttribute('multiple'),'');assert.equal(await page.locator('#listbox').locator('..').getAttribute('data-native-select'),null,'listboxes preserve their ordinary native layout');
  const clamp=await page.addStyleTag({content:'[data-native-select] .cs-select-display {height:20px!important;overflow:hidden!important}'});assert.ok((await page.evaluate(()=>window.__caosGate.focusFacts().cutSelects.count))>0,'a clipped mirror remains a real negative control');await clamp.evaluate(e=>e.remove());
 }finally{await page.close();}
});
