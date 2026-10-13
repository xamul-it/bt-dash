const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '../src/bt/pages/WatchtowerCronMonitoring.vue'), 'utf8')
const methods = {}
for (const name of ['replayFailed', 'resultHeadline', 'rowStatusLabel', 'backtestOrderSettlementText', 'orderText', 'orderBrokerDetail', 'replayCheckText', 'originalDayReturn', 'replayVerificationStatus', 'replayVerificationText', 'brokerDisplayStatus', 'alpacaActivityText', 'alpacaActivityDetail', 'brokerTelemetryDetail', 'watchdogMissingSources', 'entryDecisionLabel', 'decisionState', 'decisionErrorText']) {
  const match = source.match(new RegExp(`    ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n    \\},`))
  assert.ok(match, name)
  methods[name] = new Function(match[1], match[2])
}

test('missing original Backtest execution uses the exact requested wording in both views', () => {
  const verification = { status: 'completed', evidence: { original_history_missing: true, historical_association_pending: true } }
  assert.equal(methods.replayVerificationStatus(verification), "Manca l'esecuzione di backtest!")
  assert.equal(methods.replayVerificationText(verification), "Manca l'esecuzione di backtest!")
})

test('mirror 1 October summary separates missing receipts from strategy failures', () => {
  const decision = { run_status: 'failed', error: 'scheduled entry did not start before watchdog deadline' }
  const item = { decisions: { backtest: decision, alpaca: decision }, alpacaActivity: [{}, {}, {}, {}, {}] }
  assert.equal(methods.brokerTelemetryDetail.call(methods, item), 'Ricevute mancanti: Backtest / Alpaca · 5 ordini Alpaca rilevati')
  assert.equal(methods.entryDecisionLabel(decision), 'ricevuta mancante')
  assert.equal(methods.decisionState(decision), 'ricevuta mancante')
  assert.match(methods.decisionErrorText(decision), /non dimostra.*fallita/)
  assert.equal(methods.decisionErrorText({ error: 'real strategy exception' }), 'real strategy exception')
})

test('an unavailable cause is not displayed as a replay cause', () => {
  assert.equal(methods.replayVerificationText({ evidence: { replay_reasons: [{ code: 'reason_unavailable', label: 'Causale Backtrader non disponibile' }] } }), 'Replay completato senza chiusure')
  assert.equal(methods.replayVerificationText({ evidence: { replay_reasons: [{ code: 'cooldown', label: 'Cooldown strategia' }] } }), 'Replay completato senza chiusure · Causale replay: Cooldown strategia')
})

test('completed replay without closures is not an execution failure', () => {
  const result = { status: 'ok', summary: { bt_settlement_pending: true,
    bt_replay_reasons: [{ code: 'cooldown', label: 'Cooldown strategia' }] } }
  assert.equal(methods.replayFailed(result), false)
  assert.equal(methods.rowStatusLabel.call(methods, result), 'chiusure non recuperate')
  assert.match(methods.resultHeadline.call(methods, result), /Replay completato.*Cooldown strategia/)
  assert.doesNotMatch(methods.resultHeadline.call(methods, result), /fallito/)
  result.status = 'error' // Legacy pending-closure misclassification.
  assert.equal(methods.replayFailed(result), false)
})

test('real execution errors retain their diagnostic detail', () => {
  const result = { status: 'error', error: 'Missing dependency', summary: {} }
  assert.equal(methods.replayFailed(result), true)
  assert.match(methods.resultHeadline.call(methods, result), /Errore di esecuzione.*Missing dependency/)
  result.summary = { replay_execution_status: 'failed', bt_settlement_pending: true }
  assert.equal(methods.replayFailed(result), true)
})

test('completed historical audits are not labelled clean or failed', () => {
  const result = { status: 'ok', summary: { historical_association_pending: true,
    replay_execution_status: 'completed', bt_no_trade: true, bt_entry_count: 0 } }
  assert.equal(methods.replayFailed(result), false)
  assert.match(methods.rowStatusLabel.call(methods, result), /da verificare/)
  assert.match(methods.resultHeadline.call(methods, result), /nessun ordine.*causale non disponibile.*confronto non validato/)
  result.summary.bt_no_trade_reasons = [{ code: 'cooldown', label: 'Cooldown strategia' }]
  assert.match(methods.resultHeadline.call(methods, result), /Cooldown strategia/)
  result.summary.bt_no_trade = false
  result.summary.bt_entry_count = 5
  assert.match(methods.resultHeadline.call(methods, result), /5 ordine\/i.*confronto non validato/)
})

test('no cause is stated explicitly and cooldown appears on the closure row', () => {
  const result = { status: 'ok', summary: { bt_settlement_pending: true } }
  assert.match(methods.resultHeadline.call(methods, result), /causale non disponibile/)
  const context = { backtestOrderSettlement: () => ({ symbol: 'NVDA', status: 'pending',
    detail: { replay_no_trade_reasons: [{ code: 'cooldown' }] } }) }
  const verification = { evidence: { checks: [{ symbol: 'NVDA', reasons: [{ code: 'cooldown' }] }] } }
  assert.match(methods.backtestOrderSettlementText.call(context, {}, [], verification), /CHIUSURA non recuperata.*cooldown/)
})

test('decision price is never shown as execution price for either source', () => {
  const context = { brokerDisplayStatus: methods.brokerDisplayStatus, qty: String, num: String, backtestOrderSettlement: () => null, alpacaOrderSettlement: () => null }
  const order = { symbol: 'NVDA', side: 'buy', qty: 5, reference_price: 999 }
  for (const source of ['backtest', 'alpaca']) {
    const text = methods.orderText.call(context, order, source, [])
    assert.doesNotMatch(text, /999/)
    assert.match(text, /prezzo di esecuzione non disponibile/)
  }
  context.backtestOrderSettlement = () => ({ entry_price: 110 })
  assert.match(methods.orderText.call(context, order, 'backtest', []), /@ 110/)
  assert.match(methods.orderText.call(context, { ...order, filled_qty: 5, filled_avg_price: 112 }, 'alpaca', []), /@ 112/)
})

test('missing original execution price never produces a fictitious P&L', () => {
  assert.equal(methods.originalDayReturn([{ status: 'closed', qty: 5, entry_price: null, pnl: 10 }]), null)
  const context = { qty: String, num: String, formatDate: String, signedPct: String,
    backtestOrderSettlement: () => ({ symbol: 'NVDA', status: 'closed', qty: 5, exit_price: 110, pnl: null }) }
  assert.match(methods.backtestOrderSettlementText.call(context, {}, []), /P&L non disponibile/)
})

test('missing original position is verification evidence, not a replacement entry', () => {
  const check = { symbol: 'NVDA', code: 'original_position_missing', reasons: [] }
  assert.match(methods.replayCheckText(check), /posizione assente.*nessuna posizione aggiunta/)
  assert.match(methods.replayVerificationStatus({ status: 'completed', evidence: { checks: [check] } }), /1 chiusura\/e senza posizione originale/)
  assert.doesNotMatch(source.match(/detail: [^\n]*\[([\s\S]*?)\]\.filter\(Boolean\)/)[1], /resultHeadline/)
})

test('challenger 30 September shows AVGO execution 351.19 and return 0.27%, not decision 355.10', () => {
  const settlement = { symbol: 'AVGO', status: 'closed', qty: 187,
    entry_price: 351.19000244140625, exit_price: 352.149994, exit_date: '2026-10-01',
    pnl: (352.149994 - 351.19000244140625) * 187, pnl_pct: 0.2733538868 }
  const context = { qty: String, num: n => Number(n).toFixed(2), formatDate: String,
    signedPct: n => `+${Number(n).toFixed(2)}%`, backtestOrderSettlement: () => settlement }
  const opening = methods.orderText.call(context, { symbol: 'AVGO', side: 'buy', qty: 187, reference_price: 355.1 }, 'backtest', [])
  const closing = methods.backtestOrderSettlementText.call(context, {}, [])
  assert.match(opening, /351\.19/)
  assert.doesNotMatch(opening, /355\.10/)
  assert.match(closing, /352\.15.*\+0\.27%/)
  assert.doesNotMatch(closing, /\(\)/)
  assert.doesNotMatch(source.split('<script>')[0], /symbolCards\(/)
})

test('Alpaca 30 September opening and summary use the same actual NVDA fill', () => {
  const entry = { source: 'alpaca', symbol: 'NVDA', side: 'buy', status: 'closed', qty: 162,
    entry_price: 228.29, exit_price: 235.76, pnl: 1210.14,
    detail: { entry_filled_qty: 162, entry_execution: 'CLS' } }
  const expired = { source: 'alpaca', symbol: 'AVGO', status: 'pending', entry_price: null,
    detail: { pending_reason: 'entry_not_filled', entry_filled_qty: 0 } }
  const context = { brokerDisplayStatus: methods.brokerDisplayStatus, qty: String, num: n => Number(n).toFixed(2), alpacaOrderSettlement: () => entry }
  const text = methods.orderText.call(context, { side: 'buy', symbol: 'NVDA', qty: 162, broker_status: 'filled' }, 'alpaca', [entry, expired])
  assert.match(text, /@ 228\.29/)
  assert.doesNotMatch(text, /non disponibile/)
  assert.ok(Math.abs(methods.originalDayReturn([entry, expired]) - 3.2721538394) < 0.000001)
  assert.equal(methods.originalDayReturn([expired]), null)
  assert.equal(methods.originalDayReturn([entry, { ...entry, status: 'pending' }]), null)
})

test('summary shows total daily P&L divided by invested capital without a comparison record', () => {
  const positions = [
    { status: 'closed', entry_price: 100, qty: 1, pnl: 10 },
    { status: 'closed', entry_price: 100, qty: 20, pnl: 40 },
    { status: 'closed', entry_price: 100, qty: 5, pnl: 15 }
  ]
  assert.equal(methods.originalDayReturn(positions), 65 / 2600 * 100)
  assert.equal(methods.originalDayReturn([
    { status: 'closed', entry_price: 100, qty: 10, pnl: 49.39 }
  ]), 49.39 / 1000 * 100)
  const cell = source.split('<q-td key="day_return"')[1].split('</q-td>')[0]
  assert.doesNotMatch(cell, /props.row.raw/)
})

test('expired Alpaca orders distinguish partial fills from no execution', () => {
  const context = { brokerDisplayStatus: methods.brokerDisplayStatus, qty: String, num: String, alpacaOrderSettlement: () => null }
  const order = { symbol: 'NVDA', side: 'buy', qty: 157, broker_status: 'expired' }
  const settlement = { symbol: 'NVDA', side: 'buy', entry_price: 239.28,
    detail: { entry_filled_qty: 151, entry_execution: 'CLS' } }
  const partial = methods.orderText.call(context, order, 'alpaca', [settlement])
  assert.match(partial, /151\/157 eseguite @ 239\.28.*partial fill/)
  assert.doesNotMatch(partial, /expired|residuo|parzialmente/)
  assert.doesNotMatch(methods.orderBrokerDetail({ ...order, execution_effective: false }, 'alpaca', [settlement]), /non conta come esecuzione/)
  const expired = methods.orderText.call(context, { ...order, symbol: 'MU', qty: 35 }, 'alpaca', [])
  assert.match(expired, /expired/)
  assert.doesNotMatch(expired, /@|prezzo/)
})

test('order activity box uses exact partial fill, expired, filled labels for opens and closes', () => {
  const context = { brokerDisplayStatus: methods.brokerDisplayStatus, qty: String, num: String }
  for (const intent of ['OPEN', 'CLOSE']) {
    const partial = { intent, side: intent === 'OPEN' ? 'buy' : 'sell', symbol: 'NVDA', status: 'expired', filled_qty: 53, qty: 111, filled_avg_price: 233.86 }
    assert.match(methods.alpacaActivityText.call(context, partial), /partial fill$/)
    assert.doesNotMatch(methods.alpacaActivityText.call(context, partial), /expired/)
    assert.match(methods.alpacaActivityDetail.call(context, partial), /53 \/ 111.*233\.86/)
    assert.match(methods.alpacaActivityText.call(context, { ...partial, filled_qty: 0 }), /expired$/)
    assert.doesNotMatch(methods.alpacaActivityDetail.call(context, { ...partial, filled_qty: 0 }), /prezzo/)
    assert.match(methods.alpacaActivityText.call(context, { ...partial, status: 'filled', filled_qty: 111 }), /filled$/)
  }
})
