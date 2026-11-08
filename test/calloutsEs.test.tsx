import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** A reader who chose Spanish: the stored language is read when the shell loads, so it is set before the import. */
(globalThis as { localStorage?: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
  getItem: (k: string) => (k === 'caos.lang' ? 'es' : null),
  setItem: () => undefined,
};

test('SHW-059: a scene callout shows its state as a Spanish word with its glyph on a Spanish page (known defect 58)', async () => {
  const { SceneCallouts } = await import('../src/workbench/SceneCallouts.tsx');
  const states = ['normal', 'warning', 'alarm', 'selected', 'inactive'] as const;
  const words = ['normal', 'aviso', 'alarma', 'seleccionado', 'inactivo'];
  const items = states.map((state, index) => ({ id: state, eyebrow: { en: 'Feed', es: 'Alimentación' }, value: String(100 + index), unit: 't/h', state, anchor: { x: (index + 1) / 6, y: .5 }, source: { en: 'Live trace', es: 'Traza activa' } }));
  const html = renderToStaticMarkup(createElement(SceneCallouts, { items, placement: 'header' }));
  for (const [index, state] of states.entries()) {
    const card = new RegExp(`data-caos-callout="${state}"[\\s\\S]*?</article>`).exec(html)?.[0] ?? '';
    const label = /data-callout-state-label=""[^>]*>[\s\S]*?data-callout-state-glyph=""[^>]*>([^<]+)<\/span>([^<]*)<\/span>/.exec(card);
    assert.ok(label, `the ${state} callout carries a state label with a glyph and a word: ${card}`);
    assert.ok(!/[\p{L}\p{N}]/u.test(label[1]!), `the ${state} glyph is not a letter (got ${label[1]})`);
    assert.equal(label[2]!.trim(), words[index], `the ${state} callout reads "${words[index]}" in Spanish`);
  }
});
