export function eventKind (row) {
  return row.event_type || (row.timeframe === 'quote' ? 'quote' : row.timeframe === 'trade' ? 'trade' : 'bar')
}

export function marketPlot (rows, width = 1000) {
  const points = rows.map(row => ({ row, time: Date.parse(row.timestamp || row.ts) })).filter(p => Number.isFinite(p.time))
  const values = points.flatMap(({ row }) => eventKind(row) === 'quote' ? [row.bid_price, row.ask_price] : [eventKind(row) === 'trade' ? row.price : row.close]).map(Number).filter(n => Number.isFinite(n) && n > 0)
  if (!values.length) return null
  const start = Math.min(...points.map(p => p.time)), end = Math.max(...points.map(p => p.time))
  const min = Math.min(...values), max = Math.max(...values), padding = (max - min || max * 0.001) * 0.1
  const yMin = min - padding, yMax = max + padding
  const x = time => 70 + (time - start) / (end - start || 1) * (width - 100)
  const y = value => 240 - (value - yMin) / (yMax - yMin) * 215
  const path = field => points.filter(p => eventKind(p.row) === 'quote' && Number(p.row[field]) > 0).map((p, index) => `${index ? 'H' : 'M'}${x(p.time).toFixed(2)}${index ? 'V' : ','}${y(Number(p.row[field])).toFixed(2)}`).join(' ')
  return { start, end, right: width - 30, min: yMin, max: yMax, bid: path('bid_price'), ask: path('ask_price'),
    ticks: points.filter(p => eventKind(p.row) === 'trade' && Number(p.row.price) > 0).map(p => ({ x: x(p.time), y: y(Number(p.row.price)) })),
    bars: points.filter(p => eventKind(p.row) === 'bar' && Number(p.row.close) > 0).map(p => ({ x: x(p.time), y: y(Number(p.row.close)) })) }
}

export function mergeLive (current, incoming, reset, limit = 500) {
  const combined = reset ? incoming : [...current, ...incoming]
  return [...new Map(combined.map(row => [row.sequence, row])).values()].slice(-limit)
}

// Aggregate every received trade before reducing the tick display to 100 ms buckets.
export function mergeTradeCandles (current, incoming, reset, now) {
  const minute = Math.floor(now / 60000) * 60000
  const candles = new Map((reset ? [] : current).filter(c => c.minute === minute).map(c => [c.symbol, { ...c }]))
  for (const row of incoming) {
    const stamp = Date.parse(row.timestamp || row.ts), price = Number(row.price)
    if (eventKind(row) !== 'trade' || !row.symbol || !Number.isFinite(stamp) || Math.floor(stamp / 60000) * 60000 !== minute || !(price > 0)) continue
    let c = candles.get(row.symbol)
    if (!c) {
      c = { symbol: row.symbol, minute, open: price, high: price, low: price, close: price, first: stamp, last: stamp, firstSequence: row.sequence ?? 0, lastSequence: row.sequence ?? 0, maxSequence: row.sequence ?? 0 }
    } else {
      if (row.sequence != null && row.sequence <= c.maxSequence) continue
      c.high = Math.max(c.high, price); c.low = Math.min(c.low, price)
      if (stamp < c.first || (stamp === c.first && (row.sequence ?? 0) < c.firstSequence)) { c.open = price; c.first = stamp; c.firstSequence = row.sequence ?? 0 }
      if (stamp > c.last || (stamp === c.last && (row.sequence ?? 0) >= c.lastSequence)) { c.close = price; c.last = stamp; c.lastSequence = row.sequence ?? 0 }
      c.maxSequence = Math.max(c.maxSequence, row.sequence ?? 0)
    }
    candles.set(row.symbol, c)
  }
  return [...candles.values()]
}

// Bound memory by sampling each symbol and event type at 100 ms resolution.
export function mergeLiveTicks (current, incoming, reset, now) {
  const rows = reset ? incoming : [...current, ...incoming]
  const buckets = new Map(), bars = new Map()
  for (const row of rows) {
    const stamp = Date.parse(row.timestamp || row.ts), kind = eventKind(row)
    if (!row.symbol || !Number.isFinite(stamp)) continue
    if (kind === 'bar') {
      if (row.timeframe === 'daily' || !['open', 'high', 'low', 'close'].every(key => Number(row[key]) > 0)) continue
      const key = `${row.symbol}:${stamp}`, previous = bars.get(key)
      if (!previous || (row.sequence ?? 0) >= (previous.sequence ?? 0)) bars.set(key, row)
      continue
    }
    if (stamp < now - 120000 || (kind !== 'quote' && kind !== 'trade')) continue
    const key = `${row.symbol}:${kind}:${Math.floor(stamp / 100)}`
    const previous = buckets.get(key)
    if (!previous || stamp >= Date.parse(previous.timestamp || previous.ts)) buckets.set(key, row)
  }
  const barsBySymbol = new Map()
  for (const row of bars.values()) {
    if (!barsBySymbol.has(row.symbol)) barsBySymbol.set(row.symbol, [])
    barsBySymbol.get(row.symbol).push(row)
  }
  const recentBars = [...barsBySymbol.values()].flatMap(group => group.sort((a, b) => Date.parse(a.timestamp || a.ts) - Date.parse(b.timestamp || b.ts)).slice(-3))
  return [...buckets.values(), ...recentBars].sort((a, b) => Date.parse(a.timestamp || a.ts) - Date.parse(b.timestamp || b.ts))
}

export function liveTickPlot (rows, now, visibility = { bid: true, ask: true, trades: true, bars: true, provisional: true }, provisional = null) {
  const start = now - 60000
  const timed = rows.map(row => ({ row, time: Date.parse(row.timestamp || row.ts) })).filter(p => Number.isFinite(p.time))
  const points = timed.filter(p => eventKind(p.row) !== 'bar' && p.time >= start && p.time <= now).sort((a, b) => a.time - b.time)
  const bars = timed.filter(p => eventKind(p.row) === 'bar' && p.time <= now && ['open', 'high', 'low', 'close'].every(key => Number(p.row[key]) > 0)).sort((a, b) => a.time - b.time).slice(-3)
  const forming = provisional?.minute === Math.floor(now / 60000) * 60000 ? provisional : null
  const values = [...points.flatMap(({ row }) => eventKind(row) === 'quote' ? [visibility.bid && row.bid_price, visibility.ask && row.ask_price] : [visibility.trades && row.price]), ...(visibility.bars ? bars.flatMap(({ row }) => [row.high, row.low]) : []), ...(visibility.provisional && forming ? [forming.high, forming.low] : [])].map(Number).filter(n => Number.isFinite(n) && n > 0)
  const x = time => (time - start) / 60000 * 750 + 160
  if (!values.length) return { start, end: now, bars: [], bid: '', ask: '', ticks: [], levels: [] }
  const min = Math.min(...values), max = Math.max(...values), pad = (max - min || max * 0.001) * 0.12
  const low = min - pad, high = max + pad, y = value => 370 - (value - low) / (high - low) * 350
  const path = field => {
    const quotes = points.filter(p => eventKind(p.row) === 'quote' && Number(p.row[field]) > 0)
    if (!quotes.length) return ''
    return quotes.map((p, i) => `${i ? 'H' : 'M'}${x(p.time).toFixed(2)}${i ? 'V' : ','}${y(Number(p.row[field])).toFixed(2)}`).join(' ') + `H${x(now).toFixed(2)}`
  }
  return { start, end: now, bid: path('bid_price'), ask: path('ask_price'), bars: bars.map(({ row, time }, i) => ({ row, time, x: 84 - (bars.length - 1 - i) * 28, high: y(Number(row.high)), low: y(Number(row.low)), open: y(Number(row.open)), close: y(Number(row.close)) })), provisional: forming && { row: forming, time: forming.minute, x: 112, high: y(forming.high), low: y(forming.low), open: y(forming.open), close: y(forming.close) }, ticks: points.filter(p => eventKind(p.row) === 'trade' && Number(p.row.price) > 0).map(p => ({ x: x(p.time), y: y(Number(p.row.price)), time: p.time, price: p.row.price })), levels: [0, 1, 2, 3, 4].map(i => ({ y: 20 + i * 87.5, price: high - (high - low) * i / 4 })) }
}
