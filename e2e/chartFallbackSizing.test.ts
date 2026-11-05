import assert from 'node:assert/strict';
import {after,before,test} from 'node:test';
import {startTierPage,type TierPage} from './tier-harness';

let h:TierPage;
before(async()=>{h=await startTierPage(`
 import {createRoot} from 'react-dom/client';import {UPlotChart} from './src/chart';import {BarChart,useLangStore} from './src/index';
 useLangStore.getState().setLang('es');
 const form=new URLSearchParams(location.search).get('form');
 createRoot(document.getElementById('root')).render(<div style={{width:338,height:400,margin:24}}>{form==='bars'?<BarChart title="Provisión por segmento bajo tres regímenes" data={[{id:'a',label:'Segmento de referencia con nombre largo',value:1234},{id:'b',label:'Segundo segmento con nombre largo',value:5678}]} axis={{label:'Provisión',unit:'MUSD'}} height="fill"/>:<UPlotChart title="Curvas epidémicas" x={{values:[0,1,2],label:'Día'}} y={{label:'Personas'}} series={[{label:'Susceptibles',values:[12345,12346,12347]},{label:'Infectados',values:[23456,23457,23458]},{label:'Recuperados',values:[34567,34568,34569]}]} height="fill"/>}</div>);
`);});
after(async()=>{await h?.close();});

test('wide Spanish chart accessibility tables keep their deliberate hidden host size and every data cell',async()=>{
 for(const form of ['line','bars']){
  const {page,context,errors}=await h.open('form='+form,{width:390,height:844});
  try{await page.locator('[data-chart-host]').waitFor();await page.addStyleTag({content:':root,:root[data-theme]{--font-sans:Verdana,"DejaVu Sans",sans-serif!important}'});await page.waitForTimeout(60);
   const m=await page.evaluate(()=>{const table=document.querySelector<HTMLTableElement>('[data-chart-table]')!,box=table.parentElement!,drawing=document.querySelector<SVGElement>('svg[data-chart]')??document.querySelector<HTMLCanvasElement>('canvas')!;return{tableWidth:table.getBoundingClientRect().width,hostWidth:box.getBoundingClientRect().width,drawingRight:drawing.getBoundingClientRect().right,cellText:[...table.querySelectorAll('td,th')].map(e=>e.textContent),details:[...document.querySelectorAll('[aria-details]')].some(e=>(e.getAttribute('aria-details')??'').split(' ').includes(table.id)),hidden:box.classList.contains('sr-only'),display:getComputedStyle(table).display,rows:table.rows.length};});
   assert.equal(m.hidden,true);assert.equal(m.display,'table');assert.equal(m.details,true);assert.ok(m.cellText.includes(form==='line'?'12.345':'1.234'));assert.ok(m.rows>=3);assert.ok(m.drawingRight<=390,'the actual drawing already fits and is never clipped to silence the gate');assert.ok(m.tableWidth<=m.hostWidth+1,`${form}: fallback ${m.tableWidth}px must fit its deliberately hidden ${m.hostWidth}px host`);assert.deepEqual(errors,[]);
   assert.equal(await page.getByRole('table').count(),1,'native table semantics remain in the accessibility tree');
   const shown=await page.locator('[data-chart-table]').evaluate(table=>{const parent=table.parentElement!;parent.classList.remove('sr-only');parent.style.cssText='width:338px;overflow:auto';return{display:getComputedStyle(table).display,layout:getComputedStyle(table).tableLayout,width:table.getBoundingClientRect().width,text:[...table.querySelectorAll('td,th')].map(e=>e.textContent),caption:table.querySelector('caption')?.textContent};});
   assert.equal(shown.display,'table');assert.equal(shown.layout,'auto','visible tables do not inherit the hidden-host constraint');assert.ok(shown.width>100);assert.deepEqual(shown.text,m.cellText,'no long header or data value is removed by the hidden/visible layout');assert.ok(shown.caption!.length>10);
   await page.locator('[data-chart-table] tr:last-child td:last-child').scrollIntoViewIfNeeded();assert.equal(await page.getByRole('table').count(),1);
  }finally{await context.close();}
 }
});
