const test = require('node:test');
const assert = require('node:assert/strict');

test('inherited parameters are displayed once using the selected class default', async () => {
  const { uniqueParameterGroups } = await import('../src/bt/utils/strategyDocumentation.mjs');
  const groups = [
    { class_name: 'Research', parameters: [{ name: 'mode', default: 'child' }, { name: 'metric', default: 'gain' }] },
    { class_name: 'Research', parameters: [{ name: 'mode', default: 'base' }, { name: 'metric', default: 'win' }] },
    { class_name: 'Base', parameters: [{ name: 'mode', default: 'file' }, { name: 'other', default: 4 }] },
  ];
  const result = uniqueParameterGroups(groups, [{ name: 'mode', default: 'switch' }, { name: 'metric', default: null }]);
  assert.deepEqual(result.flatMap(g => g.parameters.map(p => p.name)), ['mode', 'metric', 'other']);
  assert.equal(result[0].parameters[0].default, 'switch');
  assert.equal(result[0].parameters[1].default, null);
  assert.equal(result[2].parameters[0].default, 4);
});

test('documentation of an inherited parameter does not steal ownership from its declaring class', async () => {
  const { uniqueParameterGroups } = await import('../src/bt/utils/strategyDocumentation.mjs');
  const groups = [
    { class_name: 'Child', parameters: [{ name: 'inherited', declared: false }, { name: 'override', declared: true }] },
    { class_name: 'Parent', parameters: [{ name: 'inherited', declared: true }, { name: 'override', declared: true }] },
  ];
  const result = uniqueParameterGroups(groups, []);
  assert.deepEqual(result[0].parameters.map(p => p.name), ['override']);
  assert.deepEqual(result[1].parameters.map(p => p.name), ['inherited']);
});
