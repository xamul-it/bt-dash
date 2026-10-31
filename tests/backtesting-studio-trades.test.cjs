const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/BacktestingStudio.vue'), 'utf8')

function method(name) {
  const match = source.match(new RegExp(`    ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\},`))
  assert.ok(match, name)
  return new Function(match[1], match[2])
}

const methods = {
  formatTradeDate: method('formatTradeDate'),
  formatTradeNumber: method('formatTradeNumber'),
  formatTradeDuration: method('formatTradeDuration'),
  formatTradeValue: method('formatTradeValue'),
}

test('trade table puts bold ticker and direction before dates and percentage gain', () => {
  const body = source.match(/    tradeColumns\(\) \{([\s\S]*?)\n    \},\n    performanceCards/)[1]
  const columns = new Function(body).call({
    tradeRows: [{
      asset: 'NVDA', entry_side: 'long', duration_bars: 1440, pnl: 12.3456, pnl_pct: 0.98765,
      open_datetime: '2026-10-14 00:00:00', close_datetime: '2026-10-15 00:00:00',
      entry_signal_dt: '2026-10-13 20:00:00', exit_signal_dt: '2026-10-14 20:00:00',
    }],
    formatTradeValue: methods.formatTradeValue,
  })
  assert.deepEqual(columns.slice(0, 7).map(column => column.name), [
    'asset', 'entry_side', 'open_datetime', 'close_datetime', 'pnl_pct', 'entry_signal_dt', 'exit_signal_dt',
  ])
  assert.deepEqual(columns.slice(0, 5).map(column => column.label), [
    'Ticker', 'Direzione', 'Data ingresso', 'Data uscita', 'Gain %',
  ])
  assert.equal(columns[0].classes, 'text-weight-bold')
  assert.equal(columns.at(-1).name, 'duration_bars')
  assert.equal(columns.at(-1).label, 'Durata (barre)')
})

test('trade values use readable dates, durations and bounded precision', () => {
  const context = methods
  assert.equal(methods.formatTradeDate('2026-10-14 00:00:00'), '14/10/2026')
  assert.equal(methods.formatTradeDate('2026-10-14 23:59:59', 'daily'), '14/10/2026')
  assert.equal(methods.formatTradeDate('2026-10-14 09:31:07', 'minutes'), '14/10/2026 09:31:07')
  assert.equal(methods.formatTradeDate('2026-10-14 00:00:00', 'minutes'), '14/10/2026 00:00')
  assert.equal(methods.formatTradeDuration(1), '00:01 (1 barra)')
  assert.equal(methods.formatTradeDuration(65), '01:05 (65 barre)')
  assert.equal(methods.formatTradeDuration(1440), '24:00 (1440 barre)')
  assert.equal(methods.formatTradeValue.call(context, 'price', 181.57470703125), '181,57')
  assert.equal(methods.formatTradeValue.call(context, 'pnl_pct', 0.8289285), '0,83%')
  assert.equal(methods.formatTradeValue.call(context, 'entry_side', 'long'), 'Long')
  assert.equal(methods.formatTradeValue.call(context, 'exit_reason', null), '—')
})

test('duration wording explains the hours and minutes representation', () => {
  assert.match(source, /strategie minute/)
  assert.match(source, /ore:minuti/)
  assert.doesNotMatch(source, /\.slice\(0, 16\)/)
})

test('trade details expose a full Excel export', () => {
  assert.match(source, /label="Esporta Excel"/)
  assert.match(source, /jobs\/\$\{id\}\/trades\.xlsx/)
  assert.match(source, /responseType: "blob"/)
})
