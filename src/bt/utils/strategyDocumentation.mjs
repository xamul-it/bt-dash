// Explicit prefix sections are opt-in through the owning class docstring.
export function parameterSections(group) {
  const lines = (group.description || '').split('\n')
  const start = lines.findIndex(line => line.trim() === 'Parameter Groups')
  const definitions = []
  if (start >= 0) {
    let i = start + 2
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue }
      const header = lines[i].match(/^(\s*)([a-z]\w*)\s*$/)
      if (!header) break
      let end = i + 1
      while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) > header[1].length)) end++
      definitions.push({ prefix: header[2] + '_', title: header[2] === 'spy_drawdown_filter' ? 'Filtro drawdown SPY' : header[2],
        description: lines.slice(i + 1, end).map(line => line.trim()).join('\n').trim() })
      i = end
    }
  }
  const sections = new Map()
  for (const parameter of group.parameters || []) {
    const definition = definitions.filter(d => parameter.name.startsWith(d.prefix))
      .sort((a, b) => b.prefix.length - a.prefix.length)[0]
    const key = definition?.prefix || ''
    if (!sections.has(key)) sections.set(key, { ...(definition || { prefix: '', title: definitions.length ? 'Altri parametri' : '', description: '' }), parameters: [] })
    sections.get(key).parameters.push({ ...parameter,
      label: definition ? parameter.name.slice(definition.prefix.length) : parameter.name })
  }
  return [...sections.values()]
}

// Prefer actual declarations over documentation-only mentions; among actual
// overrides, the closest declaration in the MRO owns the displayed parameter.
export function uniqueParameterGroups(groups, parameters) {
  const seen = new Set()
  const effective = new Map((parameters || []).map(parameter => [parameter.name, parameter]))
  const declared = new Set((groups || []).flatMap(group =>
    (group.parameters || []).filter(parameter => parameter.declared === true).map(parameter => parameter.name)))
  return (groups || []).map(group => ({
    ...group,
    parameters: (group.parameters || []).filter(parameter => {
      if (declared.has(parameter.name) && parameter.declared !== true) return false
      if (seen.has(parameter.name)) return false
      seen.add(parameter.name)
      return true
    }).map(parameter => ({
      ...parameter,
      default: effective.has(parameter.name) ? effective.get(parameter.name).default : parameter.default,
    })),
  }))
}

// Extract NumPy-style parameter entries without changing the source docstring.
export function strategyDocumentation(schema) {
  const lines = (schema.description || '').replace(
    /^[ \t]*Parameter Groups\s*\n[ \t]*-{3,}[^]*?(?=^[ \t]*(?:Parameters|Parametri)\s*$|$(?![^]))/m, '',
  ).split('\n')
  const names = new Set((schema.parameters || []).map(parameter => parameter.name))
  const descriptions = {}
  const remaining = []
  for (let i = 0; i < lines.length;) {
    const header = lines[i].match(/^(\s*)([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*:\s*\S.*$/)
    const keys = header ? header[2].split(/\s*,\s*/) : []
    if (!header || !keys.some(key => names.has(key))) {
      remaining.push(lines[i++])
      continue
    }
    let end = i + 1
    while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) > header[1].length)) end++
    const description = lines.slice(i + 1, end).map(line => line.trim()).join('\n').trim()
    if (!description) {
      remaining.push(...lines.slice(i, end))
    } else {
      for (const key of keys) if (names.has(key)) descriptions[key] = description
    }
    i = end
  }
  // Drop a section heading only when extraction left that section empty.
  const description = remaining.join('\n').replace(
    /^\s*(?:Parameters|Parametri)\s*\n[ \t]*-{3,}[ \t]*\n\s*(?=$|[^\s])/gm, '',
  ).trim()
  const parameters = (schema.parameters || []).map(parameter => ({
    ...parameter,
    description: parameter.description || descriptions[parameter.name] || '',
    unused: /^unused\b/i.test((parameter.description || descriptions[parameter.name] || '').trim()),
  }))
  const groups = (schema.parameter_groups || []).map(group => ({
    ...group,
    parameters: strategyDocumentation({ description: group.description, parameters: group.parameters }).parameters,
  }))
  // Effective help takes precedence; groups run from subclass to base class.
  const effective = new Map(parameters.map(parameter => [parameter.name, parameter]))
  for (const group of groups) {
    for (const parameter of group.parameters) {
      if (!effective.has(parameter.name)) effective.set(parameter.name, parameter)
    }
  }
  return {
    ...schema,
    parameter_groups: groups.map(group => ({
      ...group,
      parameters: group.parameters.map(parameter => ({
        ...parameter,
        unused: effective.get(parameter.name)?.unused || false,
      })),
    })),
    description,
    parameters,
  }
}
