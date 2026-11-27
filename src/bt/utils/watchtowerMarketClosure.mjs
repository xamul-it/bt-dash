// A missing calendar month is unknown, never evidence of a market holiday.
export function normalClosedMarketDay(day, item, calendar) {
  if (!calendar?.covered_months?.includes(day.slice(0, 7)) || calendar.days?.[day]) return false
  const receipts = [item?.decisions?.backtest, item?.decisions?.alpaca]
  if (!receipts.every(d => d?.run_status === 'completed' && !d.error &&
    (!d.outcome || d.outcome === 'no_orders') && !(d.orders || []).length &&
    !(d.reasons || []).some(r => r?.code !== 'reason_unavailable'))) return false
  if (item.alpacaActivity?.length || Object.values(item.settlements || {}).some(rows => rows?.length)) return false
  const comparison = item.comparison
  if (comparison && (comparison.status !== 'error' || !(comparison.diffs || []).length ||
    !comparison.diffs.every(d => d.kind === 'decision_not_communicated'))) return false
  const summary = item.result?.summary || {}
  if (item.result?.status === 'error' || summary.bt_settlement_pending || summary.historical_association_pending ||
    Object.entries(summary.counts || {}).some(([key, count]) => key !== 'matched' && Number(count) > 0)) return false
  return !item.verification
}
