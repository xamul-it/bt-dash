export function listAssetOptions (members, assets) {
  const bySymbol = new Map(assets.map(asset => [asset.symbol, asset]))
  return members.map(symbol => bySymbol.get(symbol) || { symbol, name: '', exchange: '', status: '' })
}

export function toggleListSymbol (selected, symbol, enabled) {
  return enabled ? [...new Set([...selected, symbol])] : selected.filter(item => item !== symbol)
}
