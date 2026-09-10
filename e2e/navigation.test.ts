import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect, type Browser } from '@playwright/test';

let browser: Browser, server: Server, address: string;
before(async () => {
  const root=fileURLToPath(new URL('..',import.meta.url));
  const script=await build({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {BrowserRouter,useLocation} from 'react-router';
    import {AppShell} from './src/shell/AppShell';import {useShellLang} from './src/lib/lang';
    const routes=[{path:'/',en:'App',es:'App'},{path:'/introduction',en:'Introduction',es:'Introducción'},{path:'/methodology',en:'Methodology',es:'Metodología'},{path:'/implementation',en:'Implementation',es:'Implementación'},{path:'/experiments',en:'Experiments',es:'Experimentos'},{path:'/benchmark',en:'Benchmark',es:'Benchmark'}];
    const config={product:{name:'Aerovia'},routes,links:{github:'https://example.invalid/code',personal:'https://example.invalid/site',portfolio:'https://example.invalid/work'},version:'0.00.001',fixed:true,footer:{attribution:false},architecture:{tabs:[]}};
    function App(){const {pathname}=useLocation();const lang=useShellLang();return <AppShell config={config}><section aria-label="Instrument" style={{height:'100%'}}><h1>{routes.find(route=>route.path===pathname)?.[lang]}</h1></section></AppShell>}
    createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
  `,resolveDir:root,sourcefile:'consumer.tsx',loader:'tsx'},bundle:true,format:'esm',platform:'browser',write:false,define:{'process.env.NODE_ENV':'"production"'}});
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  server=createServer((req,res)=>{
    if(req.url==='/consumer.js'){res.setHeader('Content-Type','text/javascript');res.end(script.outputFiles[0].text);}
    else if(req.url?.endsWith('.css')){res.setHeader('Content-Type','text/css');res.end(req.url==='/styles.css'?css:'');}
    else {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/consumer.js"></script></body></html>');}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  address=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  browser=await chromium.launch();
});
after(async()=>{await browser?.close();await new Promise<void>(resolve=>server?.close(()=>resolve()));});

for(const width of [320,390,1440]) for(const es of [false,true]) for(const light of [false,true]){
  test(`all shell routes remain visible, focusable and contained at ${width}px ${es?'ES':'EN'} ${light?'light':'dark'}`,async()=>{
    const context=await browser.newContext({viewport:{width,height:844},colorScheme:'dark'});
    const page=await context.newPage(); const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    try{
      await page.goto(address);
      if(light) await page.getByRole('button',{name:'Toggle light / dark',exact:true}).click();
      if(es) await page.getByRole('button',{name:'Switch language',exact:true}).click();
      const nav=page.getByRole('navigation',{name:'Aerovia',exact:true}),links=nav.getByRole('link');
      await expect(nav).toBeVisible();await expect(links).toHaveCount(6);
      for(let i=0;i<6;i++){
        await links.nth(i).click();await expect(links.nth(i)).toHaveAttribute('aria-current','page');
        await expect(page.getByRole('heading',{level:1})).toHaveText((await links.nth(i).innerText()).trim());
        await expect.poll(()=>new URL(page.url()).pathname).toBe(await links.nth(i).getAttribute('href'));
      }
      await links.first().focus();
      for(let i=0;i<6;i++){
        await expect(links.nth(i)).toBeFocused();
        const box=(await links.nth(i).boundingBox())!, navBox=(await nav.boundingBox())!;
        assert.ok(box.x>=navBox.x-1 && box.x+box.width<=navBox.x+navBox.width+1,`focused route ${i} is visible inside the navigation scroller: ${JSON.stringify({box,navBox,scroll:await nav.evaluate(element=>element.scrollLeft)})}`);
        await page.keyboard.press('Enter');await expect(links.nth(i)).toHaveAttribute('aria-current','page');
        await page.keyboard.press('Tab');
      }
      const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewport:innerHeight,header:document.querySelector('header')!.getBoundingClientRect().height,main:document.querySelector('main')!.getBoundingClientRect().height}));
      assert.ok(dimensions.width<=width && dimensions.height<=844);
      assert.ok(dimensions.header<=100,'header remains compact');
      assert.ok(dimensions.main>dimensions.viewport*0.65,'instrument keeps most of the viewport');
      await expect(page.locator('html')).toHaveAttribute('data-theme',light?'light':'dark');
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });
}
