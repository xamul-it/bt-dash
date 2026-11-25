// Only display dates recorded in the receipt belonging to this decision.
function receipt(decision) {
  const payload = decision?.payload
  if (decision?.run_status !== 'completed' || payload?.schema_version !== 2 ||
      !payload.entry || payload.date !== decision.trading_date) return null
  return payload
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null
}

export function receiptSignalDate(decision) {
  const payload = receipt(decision)
  const date = validDate(payload?.signal_date)
  return date && date === decision.signal_date ? date : null
}

export function receiptOrderDate(decision, order) {
  const payload = receipt(decision)
  const date = validDate(order?.feed_date)
  if (!date || !Array.isArray(payload?.entry?.orders)) return null
  const matches = payload.entry.orders.filter(item => item.symbol === order.symbol &&
    item.side === order.side && item.feed_date === date)
  return matches.length === 1 ? date : null
}

export function orderSignalMismatch(decision, order) {
  const signal = receiptSignalDate(decision)
  const feed = receiptOrderDate(decision, order)
  return Boolean(signal && feed && signal !== feed)
}
