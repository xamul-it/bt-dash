const test = require('node:test');
const assert = require('node:assert/strict');

test('strategy change preserves effective common parameters and drops inactive or absent ones', async () => {
  const { preserveCommonParameters } = await import('../src/bt/utils/strategyParameters.mjs');
  const previous = { parameters: [
    { name: 'exposure', default: 1 }, { name: 'hedge', default: false },
    { name: 'weight', default: 0.7 }, { name: 'same', default: 2 },
    { name: 'source_unused', default: 'weak_theme', unused: true },
    { name: 'target_unused', default: 3 }, { name: 'removed', default: 5 },
  ] };
  const next = { parameters: [
    { name: 'exposure', default: 1 }, { name: 'hedge', default: true },
    { name: 'weight', default: 0.25 }, { name: 'same', default: 2 },
    { name: 'source_unused', default: 'weak_theme_switch' },
    { name: 'target_unused', default: 0, unused: true }, { name: 'new', default: 7 },
  ] };
  assert.deepEqual(preserveCommonParameters(previous, next, { exposure: '2', hedge: 'false', removed: '9', target_unused: '4' }),
    { exposure: '2', hedge: 'false', weight: '0.7' });
});
