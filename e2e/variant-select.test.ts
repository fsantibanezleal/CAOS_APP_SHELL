import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Page } from '@playwright/test';
import { startHarness, type Harness } from './harness';

// SHW-063 (issue 207, known defect 61): DinHot's method choice is 14 methods named by their names in a 232 px rail. As chips they wrap into one
// column taller than the rail (G5 441, ADR-0071.6 266 findings); `VariantBar` `layout: 'select'` is one select with the shell's display, so the rail
// keeps its height and width, every option is reachable and the active name is shown whole.

const NAMES: Array<[string, string]> = [
  ['Ordinary least squares regression with a ridge penalty', 'Regresion de minimos cuadrados con penalizacion de cresta'],
  ['Lasso regression with a cross-validated penalty', 'Regresion lasso con penalizacion validada por cruce'],
  ['Elastic net regression over a grid of mixing weights', 'Regresion de red elastica sobre una malla de pesos'],
  ['Principal component regression on the leading modes', 'Regresion sobre componentes principales de los modos'],
  ['Partial least squares with the number of components chosen', 'Minimos cuadrados parciales con numero de componentes'],
  ['Gradient boosted trees with monotone constraints', 'Arboles con refuerzo de gradiente y restricciones'],
  ['Random forest with out-of-bag error estimates', 'Bosque aleatorio con error fuera de bolsa'],
  ['Gaussian process regression with an anisotropic kernel', 'Regresion de proceso gaussiano con nucleo anisotropico'],
  ['Support vector regression with a radial kernel', 'Regresion de vectores de soporte con nucleo radial'],
  ['Neural network with two hidden layers and early stopping', 'Red neuronal con dos capas ocultas y parada temprana'],
  ['Physics-informed model with the heat equation as constraint', 'Modelo informado por fisica con la ecuacion de calor'],
  ['Kalman smoother on the state-space form of the process', 'Suavizador de Kalman en la forma de espacio de estados'],
  ['Hierarchical Bayesian model with partial pooling by site', 'Modelo bayesiano jerarquico con agrupacion parcial'],
  ['Persistence baseline: the last observed value carried forward', 'Linea base de persistencia: el ultimo valor observado'],
];

let h: Harness;
before(async () => {
  const variants = JSON.stringify(NAMES.map(([en, es], i) => ({ id: `m${i}`, label: { en, es }, note: { en: `Note ${i}`, es: `Nota ${i}` }, ...(i === 5 ? { disabled: true } : {}) })));
  h = await startHarness(`
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { VariantBar } from './src/workbench/VariantBar';
    import { useLangStore } from './src/lib/lang';
    const VARIANTS = ${variants};
    const q = new URLSearchParams(location.search);
    if (q.get('lang')) useLangStore.getState().setLang(q.get('lang') as 'en' | 'es');
    if (q.get('font')) document.documentElement.style.fontFamily = q.get('font') as string;
    function App() {
      const [id, setId] = useState('m0');
      (window as any).__picked = id;
      return (
        <aside className="caos-wb-rail" style={{ width: 232, height: 713, boxSizing: 'border-box', margin: 0 }}>
          <VariantBar variants={VARIANTS} activeId={id} onSelect={setId} lane="live" title={{ en: 'Methods', es: 'Metodos' }} layout={q.get('layout') === 'chips' ? 'chips' : 'select'} />
          <label>Horizon<input className="range" type="range" /></label>
        </aside>
      );
    }
    createRoot(document.getElementById('root')!).render(<App />);
  `);
});
after(async () => {
  await h?.close();
});

/** The rail's overflow and the active name as the reader sees it. */
const rail = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('.caos-wb-rail') as HTMLElement;
    const t = document.querySelector('.cs-select-text') as HTMLElement | null;
    return {
      scrollH: r.scrollHeight,
      clientH: r.clientHeight,
      scrollW: r.scrollWidth,
      clientW: r.clientWidth,
      text: t?.textContent ?? null,
      cutV: t ? t.scrollHeight > t.clientHeight + 1 : null,
      cutH: t ? t.scrollWidth > t.clientWidth + 1 : null,
    };
  });

for (const [lang, font] of [['en', 'sans-serif'], ['es', 'sans-serif'], ['es', 'Verdana, "DejaVu Sans", sans-serif']] as const) {
  test(`SHW-063 a 14-option variant select in a 232 px rail keeps the rail whole, shows the active name whole and reaches every option (${lang}, ${font.split(',')[0]})`, async () => {
    const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${h.address}/?lang=${lang}&font=${encodeURIComponent(font)}`);
    await page.waitForSelector('select[data-control="variant"]');
    const sel = page.locator('select[data-control="variant"]');
    assert.equal(await sel.locator('option').count(), 14);
    const col = lang === 'en' ? 0 : 1;
    for (let i = 0; i < 14; i++) {
      if (i === 5) {
        assert.equal(await sel.locator('option').nth(5).isDisabled(), true, 'a disabled variant is a disabled option');
        continue;
      }
      await sel.selectOption(`m${i}`);
      const s = await rail(page);
      const where = `${lang} option ${i}`;
      assert.equal(s.text, NAMES[i][col], `${where}: the whole name in the display`);
      assert.ok(!s.cutV && !s.cutH, `${where}: the name is cut`);
      assert.ok(s.scrollH <= s.clientH + 1, `${where}: the rail scrolls (${s.scrollH} in ${s.clientH})`);
      assert.ok(s.scrollW <= s.clientW + 1, `${where}: the rail is wider than itself (${s.scrollW} in ${s.clientW})`);
      assert.match(await page.locator('.caos-variant-note').innerText(), new RegExp(`${lang === 'en' ? 'Note' : 'Nota'} ${i}$`), `${where}: the note follows`);
    }
    await page.close();
  });
}

test('SHW-063 the variant select keeps the keyboard of a native select and the data attributes the gate reads', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(h.address);
  await page.waitForSelector('select[data-control="variant"]');
  assert.equal(await page.locator('[data-variant-bar]').getAttribute('data-variant-count'), '14');
  await page.locator('select[data-control="variant"]').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('select[data-control="variant"]').inputValue(), 'm1');
  assert.equal(await page.evaluate(() => (window as unknown as { __picked: string }).__picked), 'm1');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('select[data-control="variant"]').inputValue(), 'm3', 'arrows move through the options');
  await page.keyboard.press('End');
  assert.equal(await page.locator('select[data-control="variant"]').inputValue(), 'm13');
  await page.close();
});

test('SHW-063 the same list as chips scrolls the 232 px rail (the defect the select layout answers)', async () => {
  const page = await h.browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${h.address}/?layout=chips`);
  await page.waitForSelector('[data-control="variant"]');
  const s = await rail(page);
  assert.ok(s.scrollH > s.clientH + 1 || s.scrollW > s.clientW + 1, `the chips fit (${s.scrollH} in ${s.clientH})`);
  await page.close();
});
