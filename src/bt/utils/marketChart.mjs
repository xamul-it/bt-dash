import { eventKind } from './marketFlow.mjs'

export function marketSeries (rows) {
  const maps = { bid: new Map(), ask: new Map(), trades: new Map(), bars: new Map() }
  for (const row of rows) {
    const time = Number.isFinite(row.time) ? row.time : Date.parse(row.timestamp || row.ts) / 1000
    if (!Number.isFinite(time)) continue
    const kind = eventKind(row)
    if (kind === 'quote') {
      if (Number(row.bid_price) > 0) maps.bid.set(time, { time, value: Number(row.bid_price) })
      if (Number(row.ask_price) > 0) maps.ask.set(time, { time, value: Number(row.ask_price) })
    } else if (kind === 'trade' && Number(row.price) > 0) {
      maps.trades.set(time, { time, value: Number(row.price) })
    } else if (kind === 'bar' && ['open', 'high', 'low', 'close'].every(key => Number(row[key]) > 0)) {
      maps.bars.set(time, { time, open: Number(row.open), high: Number(row.high), low: Number(row.low), close: Number(row.close) })
    }
  }
  return Object.fromEntries(Object.entries(maps).map(([key, map]) => [key, [...map.values()].sort((a, b) => a.time - b.time)]))
}
