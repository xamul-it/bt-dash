const test = require('node:test')
const assert = require('node:assert/strict')
const load = () => import('../src/bt/utils/knowledge.mjs')

test('knowledge filters preserve exact identifiers and distinguish study and economic dates', async () => {
  const { buildKnowledgeFilters } = await load()
  assert.deepEqual(buildKnowledgeFilters({ parameters: 'post_up_cooldown_days', study_id: 'a/revision_02',
    study_from: '2026-10-01', study_to: '2026-10-31', period_start_from: '2015-01-01', period_end_to: '2022-12-31',
    ignored: 'x', strategies: '' }), {
    parameters: 'post_up_cooldown_days', study_id: 'a/revision_02',
    study_date: { gte: '2026-10-01', lte: '2026-10-31' },
    period_start: { gte: '2015-01-01' }, period_end: { lte: '2022-12-31' },
  })
})

test('relative document links stay within the catalog root', async () => {
  const { resolveKnowledgeLink } = await load()
  assert.deepEqual(resolveKnowledgeLink('docs/study/report.md', '../guide.md#results'), { path: 'docs/guide.md', anchor: 'results' })
  assert.equal(resolveKnowledgeLink('docs/report.md', '../../private'), null)
  for (const href of ['https://outside', 'javascript:alert(1)', '//outside/a', '%ZZ']) {
    assert.equal(resolveKnowledgeLink('docs/report.md', href), null)
  }
})

test('historical source and scientific unknown labels do not imply validation', async () => {
  const { knowledgeLabel } = await load()
  assert.equal(knowledgeLabel('frozen_copy'), 'Copia congelata')
  assert.equal(knowledgeLabel('unknown'), 'Tipo da assegnare')
  assert.equal(knowledgeLabel('dependency_changed'), 'Fonte collegata modificata')
})

test('scientific state stays distinct from document type and anchors are stable', async () => {
  const { knowledgeLabel, knowledgeHeadingId } = await load()
  assert.equal(knowledgeLabel('unknown', 'status'), 'Stato non dichiarato')
  assert.equal(knowledgeLabel('study_card'), 'Scheda dello studio')
  assert.equal(knowledgeHeadingId('## Dati e costi'), 'knowledge-dati-e-costi')
})
