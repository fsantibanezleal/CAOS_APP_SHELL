import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNumber, type FormatOptions } from '../src/lib/format';

// Known defect 68 (CEFOP_DinHot): formatNumber built a new Intl.NumberFormat on every call. UPlotChart's accessible memo and a
// product's screen-reader table format every point and cell, and on DinHot's story step at 1280x800 formatNumber took 255 ms
// self time of a 1.6 s G21 sample. Since 0.26.0 one formatter is kept per locale and options; the output is the same text.

/** Every branch of formatNumber: fixed decimals (with and without grouping), scientific (forced and below 1e-4), integers,
 * significant digits (with and without grouping), percent, zero, a negative, and "not available". */
const CASES: [number | null, FormatOptions][] = [
  [1234.5678, { decimals: 2 }],
  [1234.5678, { decimals: 2, grouping: false }],
  [0.000012345, {}],
  [12345.678, { notation: 'scientific', digits: 3 }],
  [123456.7, {}],
  [123456.7, { grouping: false }],
  [12.345678, {}],
  [12.345678, { digits: 6 }],
  [1.5, { digits: 2, grouping: false }],
  [0.4237, { percent: true }],
  [0.4237, { percent: true, decimals: 1 }],
  [0, {}],
  [-98765.4321, { decimals: 3 }],
  [null, {}],
];

/** The text each case printed on 0.25.0, which built its formatter afresh: the reference the cached formatters must match. */
function reference(value: number | null, lang: 'en' | 'es', o: FormatOptions): string {
  if (value === null) return formatNumber(value, lang, o);
  const loc = lang === 'es' ? 'es-CL' : 'en-US';
  const v = o.percent ? value * 100 : value;
  const digits = o.digits ?? 4;
  const scientific = v !== 0 && (o.notation === 'scientific' || Math.abs(v) < 1e-4);
  const grouping = o.grouping === false ? { useGrouping: false } : {};
  const nf =
    o.decimals !== undefined
      ? new Intl.NumberFormat(loc, { minimumFractionDigits: o.decimals, maximumFractionDigits: o.decimals, ...grouping })
      : scientific
        ? new Intl.NumberFormat(loc, { notation: 'scientific', maximumSignificantDigits: digits })
        : Math.abs(v) >= 10 ** (digits - 1)
          ? new Intl.NumberFormat(loc, { maximumFractionDigits: 0, ...grouping })
          : new Intl.NumberFormat(loc, { maximumSignificantDigits: digits, ...grouping });
  return o.percent ? `${nf.format(v)} %` : nf.format(v);
}

/** Runs `fn` with Intl.NumberFormat replaced by a subclass that counts its constructions. */
function counting<T>(fn: () => T): { result: T; constructed: number } {
  const Original = Intl.NumberFormat;
  let constructed = 0;
  const Counting = function (this: unknown, ...args: ConstructorParameters<typeof Intl.NumberFormat>) {
    constructed += 1;
    return new Original(...args);
  } as unknown as typeof Intl.NumberFormat;
  Object.assign(Counting, Original);
  Counting.prototype = Original.prototype;
  (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = Counting;
  try {
    return { result: fn(), constructed };
  } finally {
    (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = Original;
  }
}

test('SHN-010 formatNumber builds one Intl.NumberFormat per locale and options, not one per call (known defect 68)', () => {
  for (const lang of ['en', 'es'] as const) {
    // a distinct option set so no earlier test has built its formatter yet
    const opts: FormatOptions = { decimals: 5, grouping: false };
    const { result, constructed } = counting(() => Array.from({ length: 1000 }, (_, i) => formatNumber(i + 0.123456, lang, opts)));
    assert.equal(result.length, 1000);
    assert.ok(constructed <= 1, `${lang}: 1000 calls with one locale and one option set built ${constructed} formatters (0.25.0: one per call)`);
  }
  // a table of 4,000 cells over every branch builds at most one formatter per branch and language
  const { constructed } = counting(() => {
    for (let i = 0; i < 4000; i += 1) {
      const [v, o] = CASES[i % CASES.length]!;
      formatNumber(v === null ? null : v * (1 + (i % 7) / 10), i % 2 ? 'es' : 'en', o);
    }
  });
  assert.ok(constructed <= 2 * CASES.length, `4,000 calls over ${CASES.length} branches in two languages built ${constructed} formatters`);
});

test('SHN-010 a cached formatter prints exactly what a fresh one prints, for every branch in both languages (known defect 68)', () => {
  for (const lang of ['en', 'es'] as const) {
    for (const [value, opts] of CASES) {
      const want = reference(value, lang, opts);
      // twice: the first call may build the formatter, the second reads it from the cache
      assert.equal(formatNumber(value, lang, opts), want, `${lang} ${value} ${JSON.stringify(opts)} (first call)`);
      assert.equal(formatNumber(value, lang, opts), want, `${lang} ${value} ${JSON.stringify(opts)} (cached)`);
    }
  }
  // the same options in another language are another formatter: a decimal comma in Spanish, a point in English
  assert.equal(formatNumber(1234.5, 'en', { decimals: 1 }), '1,234.5');
  assert.equal(formatNumber(1234.5, 'es', { decimals: 1 }), '1.234,5');
  assert.equal(formatNumber(1234.5, 'en', { decimals: 1 }), '1,234.5', 'the Spanish formatter did not replace the English one');
});
