// Carry effective common values, including defaults that differ in the target.
export function preserveCommonParameters(previousSchema, nextSchema, inputs) {
  const oldParameters = new Map((previousSchema.parameters || []).map(p => [p.name, p]));
  const result = {};
  for (const target of nextSchema.parameters || []) {
    const source = oldParameters.get(target.name);
    if (!source || source.unused || target.unused) continue;
    if (Object.hasOwn(inputs, target.name)) {
      result[target.name] = inputs[target.name];
      continue;
    }
    if (source.default === undefined || JSON.stringify(source.default) === JSON.stringify(target.default)) continue;
    const value = typeof source.default === 'string' ? source.default : JSON.stringify(source.default);
    if (value !== undefined) result[target.name] = value;
  }
  return result;
}
