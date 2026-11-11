export const knowledgeFilterFields = [
  { key: 'strategy_families', label: 'Strategia / famiglia' },
  { key: 'doc_type', label: 'Tipo documento' },
  { key: 'strategies', label: 'Classe menzionata' },
  { key: 'parameters', label: 'Parametro menzionato' },
  { key: 'study_id', label: 'Studio' },
  { key: 'version_context', label: 'Versione della fonte' },
  { key: 'status', label: 'Stato documentato' },
]

const labels = {
  unknown: 'Tipo da assegnare', study_card: 'Scheda dello studio', instructions: 'Istruzioni', decision: 'Decisione', index: 'Indice', guide: 'Guida', report: 'Rapporto',
  protocol: 'Protocollo', review: 'Revisione', plan: 'Piano', reference: 'Riferimento',
  code: 'Codice', test: 'Test', in_revision: 'In revisione',
  source_document: 'Documento originale', frozen_copy: 'Copia congelata',
  generated_navigation: 'Scheda automatica', current: 'Aggiornata',
  changed_or_missing: 'Modificata o mancante', dependency_changed: 'Fonte collegata modificata',
  failed: 'Acquisizione fallita', not_indexed: 'Non indicizzata',
  qualified_by: 'Qualificato dalla revisione', reviewed_by: 'Revisione collegata',
}

export function knowledgeLabel(value, field = '') {
  if (value === 'unknown' && field === 'status') return 'Stato non dichiarato'
  return labels[value] || value || 'Non disponibile'
}

export function buildKnowledgeFilters(values = {}) {
  const result = {}
  for (const { key } of knowledgeFilterFields) {
    if (typeof values[key] === 'string' && values[key]) result[key] = values[key]
  }
  const dates = [
    ['study_date', 'study_from', 'study_to'],
    ['period_start', 'period_start_from', null],
    ['period_end', null, 'period_end_to'],
  ]
  for (const [field, from, to] of dates) {
    const range = {}
    if (from && values[from]) range.gte = values[from]
    if (to && values[to]) range.lte = values[to]
    if (Object.keys(range).length) result[field] = range
  }
  return result
}

export function catalogKnowledgeParams(values = {}) {
  // Catalog browsing accepts the same scalar facets; date intervals belong to search.
  return Object.fromEntries(knowledgeFilterFields.filter(({ key }) => values[key]).map(({ key }) => [key, values[key]]))
}

export function resolveKnowledgeLink(source, href) {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null
  const [target] = href.split('#')
  if (!target) return { path: source, ...(href.includes('#') ? { anchor: href.split('#').slice(1).join('#') } : {}) }
  let decoded
  try { decoded = decodeURIComponent(target) } catch (_) { return null }
  const parts = decoded.startsWith('/') ? [] : source.split('/').slice(0, -1)
  for (const part of decoded.replace(/^\/+/, '').split('/')) {
    if (part === '..') { if (!parts.length) return null; parts.pop() }
    else if (part && part !== '.') parts.push(part)
  }
  return { path: parts.join('/'), ...(href.includes('#') ? { anchor: href.split('#').slice(1).join('#') } : {}) }
}

export function knowledgeHeadingId(text) {
  return 'knowledge-' + String(text).toLowerCase().replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-')
}
