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
