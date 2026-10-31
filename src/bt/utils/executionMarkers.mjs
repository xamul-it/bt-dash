export function simulationMarkers (trades, symbol, start, end) {
  const markers = []
  let missing = 0
  for (const [i, trade] of trades.entries()) {
    if ((trade.asset || trade.symbol) !== symbol) continue
    for (const entry of [true, false]) {
      const timestamp = entry ? trade.open_datetime : trade.close_datetime
      const price = Number(entry ? (trade.entry_price ?? trade.price) : (trade.exit_price ?? trade.close_price))
      // Do not place daily/naive timestamps on the intraday tape, or infer an
      // exit price from PnL (fees and partial fills make that ambiguous).
      if (!timestamp || !/(Z|[+-]\d\d:\d\d)$/.test(timestamp) || !(price > 0)) { missing++; continue }
      const time = Date.parse(timestamp) / 1000
      if (!Number.isFinite(time) || time < start || time > end) continue
      const short = ['short', 'sell'].includes(trade.entry_side)
      markers.push({ id: `sim-${i}-${entry}`, timestamp, price, qty: Math.abs(Number(trade.size)),
        side: entry !== short ? 'buy' : 'sell', source: 'simulation', account: 'Backtest simulato' })
    }
  }
  return { markers, missing }
}
