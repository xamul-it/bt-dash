const nyClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

const nyDay = time => {
  const p = Object.fromEntries(nyClock.formatToParts(new Date(time * 1000)).map(part => [part.type, part.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export function sessionBoundaries(series, timeframe, calendar = {}) {
  const match = /^(\d+)(Min|H)$/i.exec(timeframe || '')
  if (!match) return []
  const step = Number(match[1]) * (match[2].toLowerCase() === 'h' ? 3600 : 60)
  const result = []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1], next = series[i]
    const a = nyDay(prev.time), b = nyDay(next.time)
    const previousDay = calendar.days?.[a]
    if (a !== b && previousDay && prev.time < previousDay.close && previousDay.close <= next.time && next.time - prev.time <= step * 2 && !(series[i + 1] && series[i + 1].time - next.time > step * 2)) {
      result.push({ logical: i - 1 + (previousDay.close - prev.time) / (next.time - prev.time), label: 'C' })
    }
    const day = calendar.days?.[b]
    if (!day) continue
    const limits = [[day.pm, 'PM'], [day.rth, 'RTH'], [day.ah, 'AH'], [day.close, 'C']]
    if (next.time - prev.time > step * 2 || a !== b) {
      // The chart compresses missing time: mark an exact session start at its
      // first sample, without projecting a boundary across the empty interval.
      const boundary = limits.find(([seconds]) => seconds === next.time)
      if (boundary && boundary[1] !== 'C') result.push({ logical: i, label: boundary[1] })
      continue
    }
    if (next.time <= prev.time) continue
    for (const [seconds, label] of limits) {
      if (prev.time < seconds && seconds <= next.time) {
        // Do not place a closed-session label beside the next day's first bar
        // when the closed interval has no samples and is compressed away.
        if (label === 'C' && series[i + 1] && series[i + 1].time - next.time > step * 2) continue
        result.push({ logical: i - 1 + (seconds - prev.time) / (next.time - prev.time), label })
      }
    }
  }
  return result
}

export function sessionShading(series, timeframe, calendar = {}) {
  if (!/^(\d+)(Min|H)$/i.test(timeframe || '')) return []
  return series.map(point => {
    const date = nyDay(point.time)
    if (!calendar.covered_months?.includes(date.slice(0, 7))) return 'UNKNOWN'
    const day = calendar.days?.[date]
    if (!day) return 'C'
    return point.time < day.pm || point.time >= day.close ? 'C' : point.time < day.rth ? 'PM' : point.time < day.ah ? 'RTH' : 'AH'
  })
}

export function sessionLines(chart, boundaries, labels = false, sessions = []) {
  const colors = { PM: 'rgba(234, 179, 8, 0.045)', AH: 'rgba(139, 92, 246, 0.045)', ON: 'rgba(100, 116, 139, 0.07)', C: 'rgba(100, 116, 139, 0.07)' }
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
