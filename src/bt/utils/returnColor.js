export function returnColor(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) || Number(value) === 0) return 'text-grey-7'
  return Number(value) > 0 ? 'text-positive' : 'text-negative'
}
