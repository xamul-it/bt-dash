const { test } = require('node:test')
const assert = require('node:assert/strict')

test('dates come from the same saved receipt, including no-order decisions', async () => {
  const { receiptSignalDate, receiptOrderDate, orderSignalMismatch } = await import('../src/bt/utils/entryReceiptDates.mjs')
  const order = { symbol: 'AMD', side: 'buy', feed_date: '2026-11-20' }
  const decision = { trading_date: '2026-11-23', run_status: 'completed', signal_date: '2026-11-20',
    payload: { schema_version: 2, date: '2026-11-23', signal_date: '2026-11-20', entry: { orders: [order] } } }
  assert.equal(receiptSignalDate(decision), '2026-11-20')
  assert.equal(receiptOrderDate(decision, order), '2026-11-20')
  assert.equal(orderSignalMismatch(decision, order), false)
  const mismatch = { ...order, feed_date: '2026-11-19' }
  decision.payload.entry.orders = [mismatch]
  assert.equal(orderSignalMismatch(decision, mismatch), true)
  assert.equal(receiptOrderDate(decision, order), null)
  decision.payload.entry.orders = []
  assert.equal(receiptSignalDate(decision), '2026-11-20')
  decision.signal_date = '2026-11-19'
  assert.equal(receiptSignalDate(decision), null)
  decision.payload.date = '2026-11-22'
  assert.equal(receiptOrderDate(decision, mismatch), null)
  decision.run_status = 'failed'
  assert.equal(receiptSignalDate(decision), null)
  assert.equal(receiptSignalDate({ trading_date: '2026-11-23', run_status: 'completed', signal_date: '2026-11-20' }), null)
})
