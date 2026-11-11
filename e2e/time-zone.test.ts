import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startHarness, type Harness } from './harness.ts';

// Known defect 43 (CAOS_Contraste U16-R3): a time axis formatted an epoch in the browser's time zone, so a document day passed
// as UTC midnight read one day early west of UTC (2022-01-03 read "2 ene 2022" in Santiago) in the readout, the data table
// and the axis. Since 0.26.0 a time axis reads its epochs as UTC by default (`x.timeZone: 'UTC'`); `'local'` keeps the
// reader's time zone for real local instants. The browser runs in America/Santiago (UTC-3 in January).

let h: Harness;
before(async () => {
  h = await startHarness(`
    import { createRoot } from 'react-dom/client';
    import { UPlotChart } from './src/chart';
    import { useLangStore } from './src/lib/lang';
    const q = new URLSearchParams(location.search);
    const lang = q.get('lang') === 'es' ? 'es' : 'en';
    useLangStore.setState({ lang });
    document.documentElement.lang = lang;
    const tz = q.get('tz');
    // ten document days from 2022-01-03, each passed as UTC midnight in epoch seconds
    const xs = Array.from({ length: 10 }, (_, i) => Date.UTC(2022, 0, 3 + i) / 1000);
    createRoot(document.getElementById('root')).render(<div style={{ width: 900, height: 420 }}><UPlotChart height={400}
      x={{ values: xs, label: 'Day', time: true, ...(tz ? { timeZone: tz } : {}) }} y={{ label: 'Price', unit: 'USD' }}
      series={[{ label: 'Close', values: xs.map((_, i) => 100 + i) }]} /></div>);
  `);
});
after(async () => { await h?.close(); });

const FIRST = { en: 'Jan 3, 2022', es: '3 ene 2022' } as const;
const EVE = { en: 'Jan 2, 2022', es: '2 ene 2022' } as const;

for (const lang of ['en', 'es'] as const) {
  test(`SHC-105 a time axis of UTC days names the right day west of UTC in the readout, the data table and the axis (${lang}, known defect 43)`, async () => {
    const ctx = await h.browser.newContext({ timezoneId: 'America/Santiago', viewport: { width: 1000, height: 600 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${h.address}?lang=${lang}`);
      await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
      assert.equal(await page.evaluate(() => new Date(Date.UTC(2022, 0, 3)).getDate()), 2, 'the browser runs west of UTC (UTC midnight is the evening before)');
      await page.locator('[data-chart-focus]').focus();
      await page.keyboard.press('ArrowRight');
      const read = (await page.locator('.caos-chart-readout').textContent()) ?? '';
      assert.ok(read.includes(FIRST[lang]), `the readout names ${FIRST[lang]}: "${read}"`);
      assert.ok(!read.includes(EVE[lang]), `the readout does not name the day before: "${read}"`);
      const table = await page.evaluate(() => [...document.querySelectorAll('table.caos-chart-table tbody tr')].map((r) => (r.firstElementChild?.textContent ?? '').trim()));
      assert.equal(table[0], FIRST[lang], `the data table starts on ${FIRST[lang]}: ${table.join(' | ')}`);
      assert.ok(!table.includes(EVE[lang]), `the data table never names the day before: ${table.join(' | ')}`);
      // the axis declares the labels it drew (data-x-time-labels); its first day tick is the 3rd, never the 2nd
      const axis = (await page.locator('.caos-chart').getAttribute('data-x-time-labels')) ?? '';
      assert.ok(axis.length > 0, 'the time axis declares its labels');
      // a label reads the day as "1/3" (month/day) or "Jan 3" / "3 ene": the day is the number after the slash, else the first number
      const days = axis.split('|').map((l) => { const md = l.match(/(\d+)\/(\d+)/); return Number(md ? md[2] : (l.match(/\d+/) ?? ['NaN'])[0]); });
      assert.ok(days.every((d) => d >= 3 && d <= 12), `every day tick is one of the document days 3 to 12: ${axis}`);
    } finally { await ctx.close(); }
  });
}

test('SHC-105 a time axis given timeZone "local" reads the epochs in the browser time zone', async () => {
  const ctx = await h.browser.newContext({ timezoneId: 'America/Santiago', viewport: { width: 1000, height: 600 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${h.address}?lang=en&tz=local`);
    await page.waitForSelector('.caos-chart[data-drawn="1"] canvas');
    await page.locator('[data-chart-focus]').focus();
    await page.keyboard.press('ArrowRight');
    const read = (await page.locator('.caos-chart-readout').textContent()) ?? '';
    assert.ok(read.includes(EVE.en), `local time: UTC midnight of the 3rd is the evening of the 2nd in Santiago: "${read}"`);
  } finally { await ctx.close(); }
});
