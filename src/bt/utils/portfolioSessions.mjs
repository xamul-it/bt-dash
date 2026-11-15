const nyClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

const nyDay = time => {
  const p = Object.fromEntries(nyClock.formatToParts(new Date(time * 1000)).map(part => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day}`
}

const nextDay = date => {
  const day = new Date(`${date}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10)
}

export function portfolioSession(time, calendar = {}) {
  const date = nyDay(time)
  if (!calendar.covered_months?.includes(date.slice(0, 7))) return 'UNKNOWN'
  const day = calendar.days?.[date]
  if (day && time >= day.pm && time < day.close) {
    return time < day.rth ? 'PM' : time < day.ah ? 'RTH' : 'AH'
  }
  // Overnight belongs to the following trading day. Its start is always
  // 20:00 New York, even when the preceding day closed early.
  if (day && time < day.pm && time >= day.pm - 8 * 3600) return 'OH'
  const tomorrow = nextDay(date)
  if (!calendar.covered_months?.includes(tomorrow.slice(0, 7))) return 'UNKNOWN'
  const next = calendar.days?.[tomorrow]
  if (next && time >= next.pm - 8 * 3600 && time < next.pm) return 'OH'
  return 'C'
}

export function standardPortfolioPoints(points, timeframe, calendar = {}) {
  if (!/^(\d+)(Min|H)$/i.test(timeframe || '')) return points
  return points.filter(point => {
    const time = typeof point.timestamp === 'number' ? point.timestamp : Date.parse(point.timestamp) / 1000
    return !Number.isFinite(time) || portfolioSession(time, calendar) !== 'C'
  })
}

export function sessionBoundaries(series, timeframe, calendar = {}) {
  const match = /^(\d+)(Min|H)$/i.exec(timeframe || '')
  if (!match) return []
  const step = Number(match[1]) * (match[2].toLowerCase() === 'h' ? 3600 : 60)
  const result = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1], next = series[i]
    const current = portfolioSession(next.time, calendar)
    const previous = portfolioSession(prev.time, calendar)
    if (current === 'UNKNOWN' || current === previous || next.time <= prev.time) continue
    if (next.time - prev.time > step * 2) {
      // Do not invent a boundary across a compressed interval.
      const day = calendar.days?.[nyDay(next.time)]
      if (day && [day.pm, day.rth, day.ah, day.pm - 8 * 3600].includes(next.time) && current !== 'C') {
        result.push({ logical: i, label: current })
      }
      continue
    }
    if (current === 'C' && series[i + 1] && series[i + 1].time - next.time > step * 2) continue
    result.push({ logical: i, label: current })
  }
  return result
}

export function sessionShading(series, timeframe, calendar = {}) {
  if (!/^(\d+)(Min|H)$/i.test(timeframe || '')) return []
  return series.map(point => portfolioSession(point.time, calendar))
}

export function sessionLines(chart, boundaries, labels = false, sessions = []) {
  const colors = { PM: 'rgba(234, 179, 8, 0.045)', AH: 'rgba(139, 92, 246, 0.045)', OH: 'rgba(59, 130, 246, 0.06)', C: 'rgba(100, 116, 139, 0.07)' }
  const view = {
    zOrder: () => 'bottom',
    renderer: () => ({
      draw(target) {
        target.useMediaCoordinateSpace(({ context, mediaSize }) => {
          context.save()
          context.strokeStyle = 'rgba(100, 116, 139, 0.55)'
          context.fillStyle = '#64748b'
          context.lineWidth = 1
          context.setLineDash([4, 4])
          context.font = '11px sans-serif'
          for (let i = 0; i < sessions.length; i++) {
            const color = colors[sessions[i]]
            if (!color) continue
            const left = chart.timeScale().logicalToCoordinate(i)
            const right = chart.timeScale().logicalToCoordinate(i + 1)
            if (left == null || right == null || right < 0 || left > mediaSize.width) continue
            context.fillStyle = color
            context.fillRect(left, 0, right - left, mediaSize.height)
          }
          context.fillStyle = '#64748b'
          for (const boundary of boundaries) {
            const x = chart.timeScale().logicalToCoordinate(boundary.logical)
            if (x == null || x < 0 || x > mediaSize.width) continue
            context.beginPath()
            context.moveTo(x, 0)
            context.lineTo(x, mediaSize.height)
            context.stroke()
            if (labels) context.fillText(boundary.label, x + 4, 13)
          }
          context.restore()
        })
      }
    })
  }
  const views = [view]
  return { paneViews: () => views }
}
