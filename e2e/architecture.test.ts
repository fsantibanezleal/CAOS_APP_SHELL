import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect, type Browser } from '@playwright/test';

// A real bundled consumer: keyboard focus and SVG geometry cannot be verified by SSR.
let browser: Browser, server: Server, address: string;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const script = await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ArchitectureModal} from './src/shell/ArchitectureModal';
      import {useLangStore} from './src/lib/lang';
      import {useThemeStore} from './src/lib/theme';
      const diagram='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 300"><rect x="0" y="0" width="880" height="300" fill="var(--color-surface)"/><text x="30" y="45" font-size="16" fill="var(--color-fg)" class="l-en">English engineering diagram</text><text x="30" y="45" font-size="16" fill="var(--color-fg)" class="l-es">Diagrama de ingeniería en español</text><text x="720" y="240" font-size="16">880 px</text></svg>';
      const config={tabs:['first','second'].map((id,index)=>({id,en:'Diagram '+(index+1),es:'Diagrama '+(index+1),body_en:'Readable explanation.',body_es:'Explicación legible.',svg:diagram}))};
      function App(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Architecture</button><button onClick={()=>useLangStore.getState().toggle()}>Language</button><button onClick={()=>useThemeStore.getState().toggleTheme()}>Theme</button><button>Background action</button>{open&&<ArchitectureModal config={config} onClose={()=>setOpen(false)}/>}</>}
      createRoot(document.getElementById('root')).render(<App/>);
    `, resolveDir: root, sourcefile: 'consumer.tsx', loader: 'tsx' },
    bundle: true, format: 'esm', platform: 'browser', write: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  server = createServer((req, res) => {
    if (req.url === '/consumer.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script.outputFiles[0].text); }
    else if (req.url === '/styles.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/consumer.js"></script></body></html>'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as {port:number}).port;
  address = `http://127.0.0.1:${port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await new Promise<void>(resolve => server?.close(() => resolve())); });

for (const width of [390, 1440]) for (const es of [false, true]) for (const light of [false, true]) {
  test(`architecture modal contains focus and offers readable diagrams at ${width}px ${es?'ES':'EN'} ${light?'light':'dark'}`, async () => {
    const context = await browser.newContext({viewport: {width, height:844}, colorScheme:'dark'});
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(address);
      if (es) await page.getByRole('button',{name:'Language',exact:true}).click();
      if (light) await page.getByRole('button',{name:'Theme',exact:true}).click();
      const opener=page.getByRole('button',{name:'Architecture',exact:true});
      await opener.focus(); await opener.press('Enter');
      const modal=page.getByRole('dialog');
      const close=modal.getByRole('button',{name:es?'cerrar':'close',exact:true});
      await expect(close).toBeFocused();
      const tabs=modal.getByRole('tab');
      await tabs.first().focus(); await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused(); await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
      await page.keyboard.press('Home'); await expect(tabs.first()).toBeFocused();
      const svg=modal.locator('svg');
      await expect(svg).toBeVisible();
      await expect(svg.locator(es?'.l-es':'.l-en')).toBeVisible();
      await expect(svg.locator(es?'.l-en':'.l-es')).toBeHidden();
      const theme=await page.locator('html').getAttribute('data-theme');
      const fitWidth=(await svg.boundingBox())!.width;
      await modal.getByRole('button',{name:es?'Leer a tamaño completo':'Read at full size',exact:true}).click();
      await expect(modal.getByRole('button',{name:es?'Ajustar diagrama':'Fit diagram',exact:true})).toHaveAttribute('aria-pressed','true');
      expect((await svg.boundingBox())!.width).toBeCloseTo(880,0);
      expect((await svg.locator(es?'.l-es':'.l-en').boundingBox())!.height).toBeGreaterThan(14);
      const region=modal.getByRole('region');
      if(width<880){
        assert.ok(fitWidth<880);
        const dimensions=await region.evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
        assert.ok(dimensions.scroll>dimensions.client);
        await region.focus(); await region.press('ArrowRight');
        await expect.poll(()=>region.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
      }
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await modal.getByRole('button',{name:es?'Ajustar diagrama':'Fit diagram',exact:true}).click();
      expect((await svg.boundingBox())!.width).toBeCloseTo(fitWidth,0);
      for (const key of ['Tab','Shift+Tab']) for(let i=0;i<10;i++){
        await page.keyboard.press(key);
        assert.equal(await modal.evaluate(element=>element.contains(document.activeElement)),true);
      }
      // Programmatic focus cannot send keyboard input behind the modal either.
      await page.getByRole('button',{name:'Background action',exact:true}).focus();
      await expect(close).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0); await expect(opener).toBeFocused();
      assert.deepEqual(errors,[]);
    } finally { await context.close(); }
  });
}
