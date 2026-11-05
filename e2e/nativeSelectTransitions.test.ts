import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {startHarness,type Harness} from './harness';
let h:Harness;
before(async()=>{h=await startHarness(`
 import {useState,useRef} from 'react';import {createRoot} from 'react-dom/client';import {NativeSelect} from './src/index';
 function App(){const [size,setSize]=useState(1),[multiple,setMultiple]=useState(false),[hidden,setHidden]=useState(false),[disabled,setDisabled]=useState(false),[value,setValue]=useState('b');const ref=useRef(null);window.heldRef=ref;
 const options=<><option value="a">Alpha</option><optgroup label="Active"><option value="b">Beta complete selected label</option><option value="c">Gamma</option></optgroup></>;
 const props={size,multiple,hidden,disabled,style:{display:'block'}};
 return <form id="form"><label htmlFor="custom">Custom native</label><NativeSelect {...props} id="custom" name="custom" defaultValue="a" ref={ref}>{options}</NativeSelect><label htmlFor="ordinary">Ordinary native</label><select {...props} id="ordinary" name="ordinary" defaultValue="a">{options}</select><NativeSelect {...props} id="controlled" name="controlled" value={multiple?[value]:value} onChange={e=>setValue(e.target.value)}>{options}</NativeSelect><select {...props} id="ordinaryControlled" value={multiple?[value]:value} onChange={e=>setValue(e.target.value)}>{options}</select><button type="button" id="size" onClick={()=>setSize(x=>x===1?3:1)}>Size</button><button type="button" id="multiple" onClick={()=>setMultiple(x=>!x)}>Multiple</button><button type="button" id="hide" onClick={()=>setHidden(x=>!x)}>Hidden</button><button type="button" id="disable" onClick={()=>setDisabled(x=>!x)}>Disabled</button><button type="reset" id="reset">Reset</button></form>;
 }createRoot(document.getElementById('root')).render(<App/>);
 `);});
after(async()=>{await h?.close();});

test('NativeSelect retains one native node and native uncontrolled form/reset behavior through size and multiple transitions',async()=>{
 const page=await h.browser.newPage({viewport:{width:390,height:844}});
 try{await page.goto(h.address);await page.locator('#custom').waitFor();await page.evaluate(()=>{window.initialSelect=document.querySelector('#custom')});
  const compare=async(expected?:string[])=>{
   const state=await page.evaluate(()=>{const custom=document.querySelector<HTMLSelectElement>('#custom')!,ordinary=document.querySelector<HTMLSelectElement>('#ordinary')!,fd=new FormData(document.querySelector<HTMLFormElement>('#form')!);return{custom:[...custom.selectedOptions].map(o=>o.value),ordinary:[...ordinary.selectedOptions].map(o=>o.value),customForm:fd.getAll('custom'),ordinaryForm:fd.getAll('ordinary'),same:custom===window.initialSelect,ref:window.heldRef.current===custom,controlled:document.querySelector<HTMLSelectElement>('#controlled')!.value,ordinaryControlled:document.querySelector<HTMLSelectElement>('#ordinaryControlled')!.value,mirror:custom.parentElement?.querySelector('.cs-select-text')?.textContent};});
   assert.deepEqual(state.custom,state.ordinary);assert.deepEqual(state.customForm,state.ordinaryForm);if(expected)assert.deepEqual(state.custom,expected);assert.equal(state.same,true,'mode changes must preserve the native DOM node');assert.equal(state.ref,true);assert.equal(state.controlled,state.ordinaryControlled,'controlled reset follows the ordinary React native select too');return state;
  };
  await page.locator('#custom').selectOption('b');await page.locator('#ordinary').selectOption('b');await compare(['b']);await page.locator('#size').click();await compare(['b']);
  await page.locator('#custom').selectOption('c');await page.locator('#ordinary').selectOption('c');await page.locator('#size').click();assert.equal((await compare(['c'])).mirror,'Gamma');
  for(const mode of ['size','multiple','size','multiple']){await page.locator('#'+mode).click();await compare();await page.locator('#reset').click();await page.waitForTimeout(20);await compare(['a']);}
  await page.locator('#custom').selectOption('b');await page.locator('#ordinary').selectOption('b');await page.locator('#multiple').click();await page.locator('#custom').selectOption(['b','c']);await page.locator('#ordinary').selectOption(['b','c']);await compare(['b','c']);await page.locator('#multiple').click();await compare();
 }finally{await page.close();}
});

test('NativeSelect hidden suppresses mirror and hit target despite display:block and restores selection in popup and listbox modes',async()=>{
 const page=await h.browser.newPage({viewport:{width:390,height:844}});
 try{await page.goto(h.address);await page.locator('#custom').waitFor();await page.locator('#custom').selectOption('c');
  for(const mode of ['popup','listbox','multiple']){
   if(mode==='listbox')await page.locator('#size').click();if(mode==='multiple')await page.locator('#multiple').click();
   await page.locator('#hide').click();
   const hidden=await page.locator('#custom').evaluate(select=>{const wrapper=select.parentElement!,mirror=wrapper.querySelector('.cs-select-display');return{nativeRects:select.getClientRects().length,wrapperRects:wrapper.getClientRects().length,mirrorRects:mirror?.getClientRects().length??0,hit:[...document.querySelectorAll('*')].some(e=>{if(e!==select&&!wrapper.contains(e))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;})};});
   assert.equal(hidden.nativeRects,0);assert.equal(hidden.wrapperRects,0);assert.equal(hidden.mirrorRects,0);assert.equal(hidden.hit,false,'hidden presentation has no ghost hit target');
   await page.locator('#hide').click();assert.equal(await page.locator('#custom').inputValue(),mode==='multiple'?'a':'c');
   await page.locator('label[for=custom]').click();assert.equal(await page.locator('#custom').evaluate(e=>e===document.activeElement),true);
   assert.equal(await page.locator('#custom').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).includes(e)}),true);
   await page.locator('#disable').click();assert.equal(await page.locator('#custom').isVisible(),true);assert.equal(await page.locator('#custom').isDisabled(),true);await page.locator('#disable').click();
  }
 }finally{await page.close();}
});
