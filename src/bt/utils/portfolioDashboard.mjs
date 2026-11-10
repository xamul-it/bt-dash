export function historySeries(points = []) {
  const unique = new Map()
  for (const point of points) {
    const time = Date.parse(point.timestamp) / 1000
    if (point.equity == null || point.equity === '') continue
    const value = Number(point.equity)
    if (Number.isFinite(time) && Number.isFinite(value)) unique.set(Math.floor(time), { time: Math.floor(time), value })
  }
  return [...unique.values()].sort((a, b) => a.time - b.time)
}

export function equityStatistics(points = []) {
  const series = historySeries(points)
  let peak = -Infinity
  let maximum = 0
  const drawdown = series.map(point => {
    peak = Math.max(peak, point.value)
    const value = peak > 0 ? (point.value / peak - 1) * 100 : 0
    maximum = Math.min(maximum, value)
    return { time: point.time, value }
  })
  return { series, drawdown, maxDrawdown: series.length ? maximum : null,
    change: series.length ? series.at(-1).value - series[0].value : null }
}

export function effectiveTimeframe(requested, start, end) {
  // Alpaca only supports daily portfolio history over 30 days.
  return (Date.parse(end) - Date.parse(start)) / 86400000 > 30 ? '1D' : requested
}

export function historyWindows(start, end, timeframe) {
  const last = Date.parse(end)
  let cursor = Date.parse(start)
  const windows = []
  const step = timeframe === '1D' ? last - cursor : 29 * 86400000
  if (!Number.isFinite(cursor) || !Number.isFinite(last) || last <= cursor) throw new Error('Intervallo storico non valido')
  while (cursor < last) {
    const next = Math.min(last, cursor + step)
    windows.push({ start: new Date(cursor).toISOString(), end: new Date(next).toISOString() })
    cursor = next
  }
  return windows
}

export function mergeHistoryResponses(responses) {
  const points = new Map()
  const fallback = responses.find(response => response.cache?.mode === 'local-fallback') || responses.find(response => response.cache?.mode !== 'remote+cached')
  for (const response of responses) {
    for (const point of response.points || []) points.set(point.timestamp, point)
  }
  return { points: [...points.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    timeframe: responses[0]?.timeframe,
    cache: fallback?.cache || responses[0]?.cache || {} }
}

export async function loadHistoryWindows(windows, request) {
  // Sequential reads preserve the broker cache shared by these windows.
  const responses = []
  for (const window of windows) responses.push(await request(window))
  return mergeHistoryResponses(responses)
}

export function periodBounds(period, start, end, now = new Date()) {
  if (period === 'CUSTOM') {
    if (!start || !end || start > end) throw new Error('Seleziona un intervallo di date valido')
    return { after: `${start}T00:00:00Z`, until: `${end}T23:59:59Z` }
  }
  const since = new Date(now)
  if (period === '1D') {
    const ny = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
    const part = type => ny.find(item => item.type === type).value
    const summerMidnight = Date.parse(`${part('year')}-${part('month')}-${part('day')}T04:00:00Z`)
    const localHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit' }).format(new Date(summerMidnight))
    since.setTime(summerMidnight + (localHour === '00' ? 0 : 3600000))
  } else {
    since.setUTCDate(since.getUTCDate() - ({ '1W': 7, '1M': 30, '3M': 90, '1A': 365 }[period] || 7))
  }
  return { after: since.toISOString(), until: now.toISOString() }
}

export const TIMEFRAME_LIMITS = { '1Min': 30, '5Min': Infinity, '15Min': 30, '1H': 30, '1D': Infinity }
export const PERIOD_OPTIONS = [
  { label: 'Oggi', value: '1D', days: 1 }, { label: '7 giorni', value: '1W', days: 7 },
  { label: '30 giorni', value: '1M', days: 30 }, { label: '3 mesi', value: '3M', days: 90 },
  { label: '1 anno', value: '1A', days: 365 }, { label: 'Personalizzato', value: 'CUSTOM' }
]
export function horizonDays(period, start, end) {
  if (period !== 'CUSTOM') return PERIOD_OPTIONS.find(option => option.value === period)?.days ?? Infinity
  if (!start || !end || start > end) return null
  return (Date.parse(end) - Date.parse(start)) / 86400000 + 1
}
export function validTimeframes(days) {
  return Object.entries(TIMEFRAME_LIMITS).filter(([, max]) => days == null || days <= max)
    .map(([value, max]) => ({ value, label: `${value} · ${value === '5Min' ? 'archivio intraday' : Number.isFinite(max) ? `fino a ${max} giorni` : 'storico giornaliero'}` }))
}
export function defaultPortfolioContext(contexts = []) {
  return (contexts.find(row => !row.paper && String(row.profile || '').toLowerCase() === 'live') ||
    contexts.find(row => !row.paper) || contexts[0])?.portfolio_key_id || ''
}
export function archivedHistoryWindows(start, end, now = Date.now()) {
  const first = Date.parse(start), last = Date.parse(end), cutoff = now - 30 * 86400000
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) throw new Error('Intervallo storico non valido')
  const windows = []
  if (first < cutoff) windows.push({ start: new Date(first).toISOString(), end: new Date(Math.min(last, cutoff)).toISOString(), archive_only: true })
  if (last > cutoff) windows.push(...historyWindows(new Date(Math.max(first, cutoff)).toISOString(), end, '5Min'))
  return windows
}
export function validPeriods(timeframe) {
  return PERIOD_OPTIONS.filter(option => option.value === 'CUSTOM' || option.days <= TIMEFRAME_LIMITS[timeframe])
}
const tradingDay = time => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time * 1000))
export function periodIndicators(points, timeframe = '5Min') {
  const { series, change, maxDrawdown } = equityStatistics(points)
  if (!series.length) return { pnl: null, returnPct: null, maxDrawdown: null, maxDrawdownCash: null, ddDays: null, currentDdDays: null, averageDay: null, averageDayPct: null, sessions: 0 }
  let peak = series[0], longest = 0, current = 0, cash = 0
  for (const point of series) {
    const duration = (point.time - peak.time) / 86400
    if (point.value >= peak.value) {
      if (current > 0) longest = Math.max(longest, duration)
      peak = point; current = 0
    } else {
      current = duration; longest = Math.max(longest, duration)
      cash = Math.max(cash, peak.value - point.value)
    }
  }
  const days = new Map()
  for (const point of series) {
    const key = tradingDay(point.time), day = days.get(key)
    days.set(key, { first: day?.first || point, last: point, count: (day?.count || 0) + 1 })
  }
  let previous = null
  const daily = []
  for (const day of days.values()) {
    const baseline = previous || (timeframe !== '1D' && day.count > 1 ? day.first : null)
    if (baseline) daily.push({ change: day.last.value - baseline.value, pct: baseline.value > 0 ? (day.last.value / baseline.value - 1) * 100 : null })
    previous = day.last
  }
  const percentages = daily.filter(day => day.pct != null)
  return { pnl: change, returnPct: series[0].value > 0 ? change / series[0].value * 100 : null, maxDrawdown, maxDrawdownCash: cash,
    ddDays: longest, currentDdDays: current, averageDay: daily.length ? daily.reduce((sum, day) => sum + day.change, 0) / daily.length : null,
    averageDayPct: percentages.length ? percentages.reduce((sum, day) => sum + day.pct, 0) / percentages.length : null, sessions: daily.length }
}
export function symbolLegend(symbols) {
  const usedHues = new Set()
  return [...new Set(symbols)].sort().map(symbol => {
    const hash = [...symbol].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
    let hue = hash % 360
    for (let attempt = 0; attempt < 360 && usedHues.has(hue); attempt++) hue = (hue + 137) % 360
    usedHues.add(hue)
    const channel = offset => {
      const k = (offset + hue / 30) % 12
      return Math.round(255 * (0.38 - 0.266 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0')
    }
    return { symbol, color: `#${[0, 8, 4].map(channel).join('')}` }
  })
}
export function openingPositions(fills, before) {
  const quantities = {}
  const seen = new Set()
  for (const fill of fills) {
    if (fill.id && seen.has(fill.id)) continue
    if (fill.id) seen.add(fill.id)
    if (Date.parse(fill.timestamp) >= Date.parse(before)) continue
    const side = String(fill.side || '').toLowerCase()
    const qty = Number(fill.qty)
    if (!fill.symbol || !Number.isFinite(qty) || qty <= 0 || !['buy', 'sell', 'sell_short'].includes(side)) continue
    quantities[fill.symbol] = (quantities[fill.symbol] || 0) + (side === 'buy' ? qty : -qty)
  }
  return quantities
}

export function positionCycles(fills, openingQuantities = {}) {
  const states = new Map(), seen = new Set(), result = []
  const zero = value => Math.abs(value) < 1e-10 ? 0 : value
  const sorted = fills.map((fill, index) => ({ fill, index })).sort((a, b) => Date.parse(a.fill.timestamp) - Date.parse(b.fill.timestamp) || a.index - b.index)
  for (const { fill, index } of sorted) {
    if (fill.id && seen.has(fill.id)) continue
    if (fill.id) seen.add(fill.id)
    const side = String(fill.side || '').toLowerCase(), qty = Number(fill.qty)
    if (!fill.symbol || !Number.isFinite(Date.parse(fill.timestamp)) || !Number.isFinite(qty) || qty <= 0 || !['buy', 'sell', 'sell_short'].includes(side)) continue
    const state = states.get(fill.symbol) || { qty: zero(Number(openingQuantities[fill.symbol]) || 0), cycle: 1 }
    let delta = side === 'buy' ? qty : -qty
    let leg = 0
    const append = (action, amount) => {
      const before = state.qty
      state.qty = zero(state.qty + Math.sign(delta) * amount)
      result.push({ ...fill, id: `${fill.id || `fill-${index}`}:${leg++}`, execution_id: fill.id,
        source_qty: qty, qty: amount, action, cycle: state.cycle, position_before: before, position_after: state.qty })
    }
    if (state.qty !== 0 && Math.sign(state.qty) !== Math.sign(delta)) {
      const closing = Math.min(Math.abs(state.qty), Math.abs(delta))
      append('Uscita', closing)
      delta = zero(delta - Math.sign(delta) * closing)
      if (state.qty === 0) state.cycle++
    }
    if (delta !== 0) append('Ingresso', Math.abs(delta))
    states.set(fill.symbol, state)
  }
  return result
}

export function executionMarkers(points, fills, selectedSymbols, orders = [], timeframe = '5Min', openingQuantities = {}) {
  const series = historySeries(points), selected = new Set(selectedSymbols)
  if (!series.length || !selected.size) return []
  const colors = new Map(symbolLegend([...fills.map(fill => fill.symbol), ...selectedSymbols]).map(row => [row.symbol, row.color]))
  const byDay = new Map(series.map((point, index) => [tradingDay(point.time), index]))
  return positionCycles(fills, openingQuantities).filter(fill => selected.has(fill.symbol)).flatMap((fill, index) => {
    const timestamp = Date.parse(fill.timestamp) / 1000
    if (!Number.isFinite(timestamp)) return []
    const dailyIndex = timeframe === '1D' ? byDay.get(tradingDay(timestamp)) : null
    if (timeframe === '1D' ? dailyIndex == null : timestamp < series[0].time || timestamp > series.at(-1).time) return []
    const buy = fill.side === 'buy', sell = ['sell', 'sell_short'].includes(fill.side)
    if (!buy && !sell) return []
    let low = 0, high = series.length - 1
    while (low < high) {
      const mid = Math.ceil((low + high) / 2)
      if (series[mid].time <= timestamp) low = mid
      else high = mid - 1
    }
    if (timeframe === '1D') low = dailyIndex
    const action = fill.action
    const entry = action === 'Ingresso'
    return [{ id: fill.id, time: series[low].time, position: entry ? 'belowBar' : 'aboveBar',
      color: colors.get(fill.symbol), shape: entry ? 'arrowUp' : 'arrowDown', text: `${fill.symbol} #${fill.cycle}`, action, cycle: fill.cycle, fill }]
  }).sort((a, b) => a.time - b.time || Date.parse(a.fill.timestamp) - Date.parse(b.fill.timestamp))
}
