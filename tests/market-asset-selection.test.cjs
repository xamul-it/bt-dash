const { test } = require('node:test')
const assert = require('node:assert/strict')

test('list members remain selectable when Alpaca metadata is incomplete', async () => {
  const { listAssetOptions, toggleListSymbol } = await import('../src/bt/utils/marketAssetSelection.mjs')
  const options = listAssetOptions(['AAPL', 'MSFT'], [{ symbol: 'AAPL', name: 'Apple' }])
  assert.deepEqual(options.map(item => item.symbol), ['AAPL', 'MSFT'])
  assert.equal(options[1].name, '')
  assert.deepEqual(toggleListSymbol(['AAPL'], 'MSFT', true), ['AAPL', 'MSFT'])
  assert.deepEqual(toggleListSymbol(['AAPL', 'MSFT'], 'AAPL', false), ['MSFT'])
  assert.deepEqual(toggleListSymbol(['AAPL'], 'AAPL', true), ['AAPL'])
})
