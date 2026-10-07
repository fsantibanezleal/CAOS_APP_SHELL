import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** A reader who chose Spanish: the stored language is read when the shell loads, so it is set before the import. */
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k: string) => (k === 'caos.lang' ? 'es' : null),
  setItem: () => undefined,
};

test('a word unit follows the interface language, a symbol stays as written (failure class 5)', async () => {
  const { Readout } = await import('../src/workbench/Readouts.tsx');
  const { Knob } = await import('../src/workbench/Controls.tsx');
  const html = renderToStaticMarkup(
    <>
      <Readout
        lane="live"
        provenance="synthetic"
        items={[
          { label: { en: 'Peak', es: 'Pico' }, value: 27345, unit: { en: 'people', es: 'personas' } },
          { label: { en: 'Day', es: 'Día' }, value: 24.25, unit: 'd' },
        ]}
      />
      <Knob id="n" label={{ en: 'Population', es: 'Población' }} value={1000} min={0} max={2000} step={10} unit={{ en: 'people', es: 'personas' }} onChange={() => undefined} />
    </>,
  );
  assert.match(html, /27\.345/);
  assert.match(html, /personas/);
  assert.doesNotMatch(html, /people/);
  // the unit joined by a no-break space (known shell defect 22, 0.8.0)
  assert.match(html, /> d</);
  assert.match(html, /Población/);
});
