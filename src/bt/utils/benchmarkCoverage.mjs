export function benchmarkLimits(inventory, benchmark) {
  const valid = inventory.filter(row => row.available && !row.error && row.first_bar && row.last_bar)
  const date = value => String(value || '').slice(0, 10)
  return {
    start: valid.filter(row => date(row.first_bar) === benchmark?.first_date).map(row => row.symbol),
    end: valid.filter(row => date(row.last_bar) === benchmark?.last_date).map(row => row.symbol),
    missing: inventory.filter(row => !row.available || row.error || !row.first_bar || !row.last_bar).map(row => row.symbol),
  }
}
