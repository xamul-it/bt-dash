<template>
  <q-page class="q-pa-md knowledge-page">
    <div class="row items-start q-gutter-sm q-mb-md">
      <div class="col"><h1 class="text-h5 q-my-none">Documentazione e studi</h1>
        <div class="text-grey-7 q-mt-xs">Trova le fonti prima di sviluppare o avviare un nuovo studio.</div>
      </div>
      <q-btn flat icon="refresh" label="Aggiorna stato" :loading="loadingStatus" @click="loadStatus" />
    </div>
    <q-banner v-if="statusError" rounded class="bg-red-1 text-negative q-mb-md" role="alert">{{ statusError }}</q-banner>
    <div v-if="status" class="row q-gutter-xs q-mb-sm">
      <q-chip dense icon="description">{{ status.originals }} documenti</q-chip>
      <q-chip dense icon="science">{{ status.study_cards }} schede</q-chip>
      <q-chip dense icon="update">Catalogo: {{ formatDate(status.last_sync_unix) }}</q-chip>
      <q-chip dense :color="staleCount ? 'orange-2' : 'green-1'">{{ staleCount ? `${staleCount} fonti da aggiornare` : 'Fonti verificate' }}</q-chip>
    </div>
    <q-expansion-item v-if="status" dense icon="info" label="Copertura e stato del catalogo" class="q-mb-md bg-white rounded-borders">
      <div class="q-pa-sm text-body2">
        {{ status.notice }}
        <div class="q-mt-xs">{{ status.pending_formats?.length || 0 }} notebook/PDF in attesa di acquisizione. Espansione del codice ancora da completare. Run riconciliati: {{ status.runs?.runs || 0 }}.</div>
        <div class="q-mt-xs">Ricerca {{ serviceLabel }}. Spegnimento dopo {{ Math.round((status.service?.idle_seconds || 600) / 60) }} minuti di inattività; il modello condiviso resta disponibile.</div>
        <div v-for="(message, path) in status.errors" :key="path" class="text-negative wrap-path">{{ path }}: {{ message }}</div>
      </div>
    </q-expansion-item>
    <q-card flat bordered>
      <q-tabs v-model="tab" align="left" active-color="primary" indicator-color="primary" no-caps>
        <q-tab name="search" label="Cerca" /><q-tab name="catalog" label="Esplora documenti" /><q-tab name="studies" label="Studi" /><q-tab name="runs" label="Run" />
      </q-tabs>
      <q-separator />
      <q-card-section v-if="tab === 'search' || tab === 'catalog'">
        <knowledge-filters v-model="filters" :facets="status?.filters || {}" :dates="tab === 'search'" />
        <div class="row justify-end q-mt-xs"><q-btn flat dense size="sm" label="Azzera filtri" @click="filters = {}" /></div>
      </q-card-section>
      <q-card-section v-if="tab === 'search'" class="q-pt-none">
        <q-form @submit="search">
          <div class="row q-col-gutter-sm">
            <div class="col-12 col-md"><q-input v-model="query" outlined clearable label="Cerca nella documentazione"
              placeholder="Un parametro, un argomento o una domanda…" maxlength="2000" /></div>
            <div class="col-12 col-sm-7 col-md-3"><q-select v-model="mode" outlined label="Modalità di ricerca" emit-value map-options :options="modes" /></div>
            <div class="col-12 col-sm-5 col-md-auto"><q-btn type="submit" color="primary" icon="search" label="Cerca" class="search-button" :loading="searching" :disable="!query?.trim()" /></div>
          </div>
        </q-form>
        <div class="text-caption text-grey-7 q-mt-sm">Le domande cercano passaggi pertinenti. I filtri si impostano esplicitamente; non vengono generate risposte.</div>
        <q-banner v-if="searching" class="bg-blue-1 q-mt-md" role="status">Ricerca in corso. Il primo accesso può richiedere l’avvio del motore.</q-banner>
        <q-banner v-if="searchError" class="bg-red-1 text-negative q-mt-md" role="alert">{{ searchError }}</q-banner>
        <q-banner v-if="searchDirty" class="bg-orange-1 q-mt-md">Ricerca o filtri modificati: premi Cerca per aggiornare i risultati.</q-banner>
        <div v-if="searchResult" class="q-mt-md">
          <div class="text-subtitle2 q-mb-sm">{{ searchResult.hits.length }} risultati per «{{ submittedQuery }}»</div>
          <q-banner v-if="!searchResult.hits.length" class="bg-grey-2">Nessuna fonte trovata con questi criteri. Prova meno filtri o termini diversi.</q-banner>
          <q-card v-for="hit in searchResult.hits" :key="hit.path" flat bordered class="q-mb-sm">
            <q-card-section>
              <strategy-badges :families="hit.metadata.strategy_families || []" @select="filterStrategy" />
              <q-btn flat no-caps align="left" color="primary" class="q-pa-none result-title" :label="hit.metadata.title || hit.heading" @click="openSource(hit.path, hit.context.start_line)" />
              <div class="text-caption text-grey-7 wrap-path">{{ hit.path }} · righe {{ hit.context.start_line }}–{{ hit.context.end_line }}</div>
              <div class="q-my-xs"><q-badge outline color="primary">{{ knowledgeLabel(hit.metadata.doc_type) }}</q-badge>
                <q-badge v-if="hit.metadata.version_context !== 'source_document'" class="q-ml-xs" color="orange-2" text-color="brown-10">{{ knowledgeLabel(hit.metadata.version_context) }}</q-badge>
                <q-badge v-if="hit.metadata.status !== 'unknown'" class="q-ml-xs" color="orange">{{ knowledgeLabel(hit.metadata.status) }}</q-badge>
              </div>
              <pre class="source-excerpt">{{ hit.context.text }}</pre>
              <div class="text-caption text-grey-7">{{ hit.metadata.metadata_state === 'mixed_curated_and_proposed' ? 'Metadati parzialmente revisionati' : 'Metadati proposti' }}</div>
              <q-expansion-item v-if="hit.aliases?.length" dense :label="`${hit.aliases.length} copie identiche collegate`">
                <q-btn v-for="alias in hit.aliases" :key="alias" flat no-caps color="primary" class="wrap-path full-width" align="left" :label="alias" @click="openSource(alias)" />
              </q-expansion-item>
              <div v-for="related in hit.related" :key="related.target" class="q-mt-sm">
                <q-btn flat dense no-caps color="deep-orange" icon="fact_check" :label="knowledgeLabel(related.relation) + ': ' + related.target.split('/').at(-1)" :disable="related.status !== 'current'" @click="openSource(related.target)" />
                <span v-if="related.status !== 'current'" class="text-negative text-caption">{{ knowledgeLabel(related.status) }}</span>
              </div>
              <q-btn v-if="hit.metadata.study_id" flat dense no-caps icon="science" label="Apri studio" color="primary" @click="openStudy(hit.metadata.study_id)" />
            </q-card-section>
          </q-card>
        </div>
        <div v-else-if="!searching" class="q-py-lg text-grey-7">Esempio: «Abbiamo già studiato il cooldown dopo un rialzo?» oppure un nome esatto come <code>post_up_cooldown_days</code>.</div>
      </q-card-section>
      <q-card-section v-if="tab === 'catalog'" class="q-pt-none">
        <q-input v-model="catalogQuery" outlined dense clearable label="Filtra titolo o percorso" class="q-mb-md" />
        <q-banner v-if="catalogError" class="bg-red-1 text-negative q-mb-sm" role="alert">{{ catalogError }}</q-banner>
        <q-linear-progress v-if="loadingCatalog" indeterminate />
        <div class="text-caption text-grey-7">{{ catalogTotal }} documenti · {{ catalogOffset + 1 }}–{{ Math.min(catalogOffset + 30, catalogTotal) }}</div>
        <q-list separator>
          <q-item v-for="doc in catalog" :key="doc.path" clickable @click="openSource(doc.path)">
            <q-item-section avatar><q-icon :name="doc.catalog_kind === 'study_card' ? 'science' : 'description'" /></q-item-section>
            <q-item-section><strategy-badges :families="doc.strategy_families || []" @select="filterStrategy" /><q-item-label>{{ doc.title }}</q-item-label><q-item-label caption class="wrap-path">{{ doc.path }}</q-item-label>
              <q-item-label caption :class="doc.freshness !== 'current' ? 'text-negative' : ''">{{ knowledgeLabel(doc.doc_type) }} · {{ knowledgeLabel(doc.version_context) }} · {{ knowledgeLabel(doc.freshness) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div class="row justify-between q-mt-md"><q-btn flat label="Precedenti" :disable="catalogOffset === 0 || loadingCatalog" @click="catalogOffset -= 30; loadCatalog()" /><q-btn flat label="Successivi" :disable="catalogOffset + 30 >= catalogTotal || loadingCatalog" @click="catalogOffset += 30; loadCatalog()" /></div>
      </q-card-section>
      <q-card-section v-if="tab === 'studies'">
        <q-input v-model="studyQuery" outlined dense clearable label="Filtra gli studi" class="q-mb-md" />
        <q-banner v-if="studiesError" class="bg-red-1 text-negative" role="alert">{{ studiesError }}</q-banner>
        <q-linear-progress v-if="loadingStudies" indeterminate />
        <q-list separator><q-item v-for="study in visibleStudies" :key="study.id" clickable @click="openStudy(study.id)">
          <q-item-section avatar><q-icon name="science" /></q-item-section>
          <q-item-section><strategy-badges :families="study.strategy_families || []" @select="filterStrategy" /><q-item-label>{{ study.title }}</q-item-label><q-item-label caption class="wrap-path">{{ study.id }}</q-item-label><q-item-label caption>{{ study.documents }} documenti · raggruppamento proposto</q-item-label></q-item-section>
          <q-item-section side><q-badge v-if="Object.keys(study.freshness).some(k => k !== 'current')" color="orange">Da aggiornare</q-badge></q-item-section>
        </q-item></q-list>
      </q-card-section>
      <q-card-section v-if="tab === 'runs'"><knowledge-runs :coverage="status?.runs || {}" @source="openSource" @refresh="loadStatus" /></q-card-section>
    </q-card>
    <q-dialog v-model="studyDialog" :maximized="$q.screen.lt.sm">
      <q-card class="study-dialog">
        <q-card-section class="row items-start"><div class="col text-h6 wrap-path">{{ selectedStudy?.id || 'Studio' }}</div><q-btn flat round icon="close" aria-label="Chiudi studio" v-close-popup /></q-card-section>
        <q-separator /><q-card-section class="scroll" style="max-height: 70vh">
          <q-linear-progress v-if="loadingStudy" indeterminate /><q-banner v-if="studyError" class="bg-red-1 text-negative" role="alert">{{ studyError }}</q-banner>
          <div v-if="selectedStudy" class="text-body2 q-mb-md">{{ selectedStudy.notice }}</div>
          <q-list separator><q-item v-for="doc in selectedStudy?.documents || []" :key="doc.path" clickable @click="openSource(doc.path)">
            <q-item-section><strategy-badges :families="doc.strategy_families || []" @select="filterStrategy" /><q-item-label>{{ doc.title }}</q-item-label><q-item-label caption class="wrap-path">{{ doc.path }}</q-item-label><q-item-label caption>{{ knowledgeLabel(doc.version_context) }} · {{ knowledgeLabel(doc.freshness) }}</q-item-label></q-item-section>
          </q-item></q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="sourceDialog" :maximized="$q.screen.lt.sm">
      <q-card class="source-dialog">
        <q-card-section class="row items-start"><div class="col"><strategy-badges :families="source?.metadata.strategy_families || []" @select="filterStrategy" /><div class="text-h6">{{ source?.metadata.title || 'Fonte' }}</div><div class="text-caption wrap-path">{{ sourcePath }}</div></div><q-btn flat round icon="close" aria-label="Chiudi fonte" v-close-popup /></q-card-section>
        <q-separator /><q-card-section class="reader-content scroll" @click="sourceLink">
          <q-linear-progress v-if="loadingSource" indeterminate /><q-banner v-if="sourceError" class="bg-red-1 text-negative" role="alert">{{ sourceError }}</q-banner>
          <template v-if="source">
            <div class="row items-center justify-between q-mb-sm"><div class="text-caption">{{ formatted ? `Documento completo · ${source.total_lines} righe` : `Righe ${source.start_line}–${source.end_line} di ${source.total_lines}` }}</div><q-toggle v-model="formatted" label="Testo formattato" dense /></div>
            <q-linear-progress v-if="loadingDocument" indeterminate />
            <knowledge-markdown v-if="formatted && documentSource" :text="documentSource.text" :references="documentSource.references" />
            <div v-else class="numbered-source"><div v-for="line in source.lines" :key="line.number" class="source-line"><span class="line-number">{{ line.number }}</span><span class="line-text">{{ line.text || ' ' }}</span></div></div>
            <div class="text-caption text-grey-7 q-mt-md wrap-path">SHA256 {{ source.sha256 }}</div>
            <q-expansion-item dense label="Provenienza dei metadati"><div v-for="(evidence, i) in source.evidence" :key="i" class="text-caption q-mb-xs wrap-path">{{ evidence.field }} = {{ evidence.value }} · {{ evidence.method }}<span v-if="evidence.line"> · riga {{ evidence.line }}: {{ evidence.quote }}</span></div></q-expansion-item>
          </template>
        </q-card-section>
        <q-separator /><q-card-actions align="between"><q-btn flat icon="arrow_back" label="Fonte precedente" :disable="!sourceHistory.length" @click="previousSource" /><q-btn v-if="!formatted" flat label="Righe precedenti" :disable="!source || source.start_line <= 1 || loadingSource" @click="openSource(sourcePath, Math.max(1, source.start_line - 100))" /><q-btn v-if="!formatted" flat label="Righe successive" :disable="!source || source.end_line >= source.total_lines || loadingSource" @click="openSource(sourcePath, source.end_line + 1)" /></q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { api } from 'boot/axios'
import { useRoute, useRouter } from 'vue-router'
import KnowledgeFilters from '../components/KnowledgeFilters.vue'
import KnowledgeMarkdown from '../components/KnowledgeMarkdown.vue'
import StrategyBadges from '../components/StrategyBadges.vue'
import KnowledgeRuns from '../components/KnowledgeRuns.vue'
import { buildKnowledgeFilters, catalogKnowledgeParams, knowledgeLabel, knowledgeHeadingId, resolveKnowledgeLink } from '../utils/knowledge.mjs'

const route = useRoute(), router = useRouter()
const endpoint = '/dyn/knowledge'
const tab = ref('search'), filters = ref({}), query = ref(String(route.query.q || '')), mode = ref('hybrid')
const modes = [{ value: 'hybrid', label: 'Ibrida: parole e significato' }, { value: 'keyword', label: 'Parole chiave' }, { value: 'semantic', label: 'Semantica' }]
const status = ref(null), statusError = ref(''), loadingStatus = ref(false)
const searchResult = ref(null), searchError = ref(''), searching = ref(false), submittedQuery = ref(''), signature = ref('')
const catalog = ref([]), catalogQuery = ref(''), catalogTotal = ref(0), catalogOffset = ref(0), catalogError = ref(''), loadingCatalog = ref(false)
const studies = ref([]), studyQuery = ref(''), studiesError = ref(''), loadingStudies = ref(false)
const studyDialog = ref(false), selectedStudy = ref(null), studyError = ref(''), loadingStudy = ref(false)
const sourceDialog = ref(false), source = ref(null), sourcePath = ref(''), sourceError = ref(''), loadingSource = ref(false), formatted = ref(false)
const documentSource = ref(null), loadingDocument = ref(false), sourceHistory = ref([])
let documentController
let searchController, catalogController, sourceController, studyController, filterTimer
const message = error => error.response?.data?.error || error.message || 'Servizio non disponibile'
const staleCount = computed(() => Object.entries(status.value?.freshness || {}).reduce((n, [key, value]) => n + (key === 'current' ? 0 : value), 0))
const serviceLabel = computed(() => ({ stopped: 'spenta', starting: 'in avvio', ready: 'disponibile', error: 'non disponibile' }[status.value?.service?.phase] || 'su richiesta'))
const visibleStudies = computed(() => studies.value.filter(s => (s.id + ' ' + s.title).toLowerCase().includes((studyQuery.value || '').toLowerCase())))
const currentSignature = () => JSON.stringify({ query: query.value, mode: mode.value, filters: buildKnowledgeFilters(filters.value) })
const searchDirty = computed(() => searchResult.value && signature.value !== currentSignature())
function formatDate(value) { return value ? new Date(value * 1000).toLocaleString('it-IT') : 'non disponibile' }
async function loadStatus() {
  loadingStatus.value = true; statusError.value = ''
  try { status.value = (await api.get(endpoint + '/status')).data } catch (error) { statusError.value = message(error) }
  finally { loadingStatus.value = false }
}
async function search() {
  searchController?.abort(); const controller = new AbortController(); searchController = controller
  searching.value = true; searchError.value = ''
  const body = { query: query.value, filters: buildKnowledgeFilters(filters.value), mode: mode.value, limit: 10 }
  const submittedSignature = currentSignature()
  try {
    const { data } = await api.post(endpoint + '/search', body, { signal: controller.signal, timeout: 120000 })
    if (controller.signal.aborted) return
    searchResult.value = data; submittedQuery.value = body.query; signature.value = submittedSignature
    router.replace({ query: { q: body.query } }).catch(() => {})
    loadStatus()
  } catch (error) { if (!controller.signal.aborted) searchError.value = message(error) }
  finally { if (searchController === controller) searching.value = false }
}
async function loadCatalog() {
  catalogController?.abort(); const controller = new AbortController(); catalogController = controller
  loadingCatalog.value = true; catalogError.value = ''
  try {
    const { data } = await api.get(endpoint + '/catalog', { params: { ...catalogKnowledgeParams(filters.value), q: catalogQuery.value || '', offset: catalogOffset.value, limit: 30 }, signal: controller.signal })
    catalog.value = data.documents; catalogTotal.value = data.total
  } catch (error) { if (!controller.signal.aborted) catalogError.value = message(error) }
  finally { if (catalogController === controller) loadingCatalog.value = false }
}
async function loadStudies() {
  loadingStudies.value = true; studiesError.value = ''
  try { studies.value = (await api.get(endpoint + '/studies')).data.studies }
  catch (error) { studiesError.value = message(error) } finally { loadingStudies.value = false }
}
async function openStudy(id) {
  studyController?.abort(); const controller = new AbortController(); studyController = controller
  studyDialog.value = true; selectedStudy.value = null; studyError.value = ''; loadingStudy.value = true
  try { selectedStudy.value = (await api.get(endpoint + '/study', { params: { id }, signal: controller.signal })).data }
  catch (error) { if (!controller.signal.aborted) studyError.value = message(error) }
  finally { if (studyController === controller) loadingStudy.value = false }
}
async function openSource(path, start = 1, anchor = '', remember = false) {
  if (remember && source.value) sourceHistory.value.push({ path: sourcePath.value, start: source.value.start_line })
  if (!sourceDialog.value) sourceHistory.value = []
  documentSource.value = null
  documentController?.abort()
  sourceController?.abort(); const controller = new AbortController(); sourceController = controller
  sourceDialog.value = true; sourcePath.value = path; source.value = null; sourceError.value = ''; loadingSource.value = true
  try {
    source.value = (await api.get(endpoint + '/source', { params: { path, start_line: start, line_count: 100 }, signal: controller.signal })).data
    if (formatted.value) await loadDocument(anchor)
  }
  catch (error) { if (!controller.signal.aborted) sourceError.value = message(error) }
  finally { if (sourceController === controller) loadingSource.value = false }
}
function sourceLink(event) {
  const link = event.target.closest('a')
  if (!link) return
  event.preventDefault()
  const href = link.getAttribute('href')
  if (/^https?:\/\//i.test(href || '')) { window.open(href, '_blank', 'noopener,noreferrer'); return }
  const resolved = link.dataset.source ? { path: link.dataset.source, anchor: href?.split('#')[1] || '' } : resolveKnowledgeLink(sourcePath.value, href)
  if (resolved) openSource(resolved.path, Number(link.dataset.line || 1), resolved.anchor || '', true)
}
async function loadDocument(anchor = '') {
  documentController?.abort(); const controller = new AbortController(); documentController = controller
  loadingDocument.value = true
  try {
    documentSource.value = (await api.get(endpoint + '/document', { params: { path: sourcePath.value }, signal: controller.signal })).data
    await nextTick()
    if (anchor) {
      let decoded = anchor; try { decoded = decodeURIComponent(anchor) } catch (_) {}
      document.getElementById(knowledgeHeadingId(decoded))?.scrollIntoView({ block: 'start' })
    }
  } catch (error) { if (!controller.signal.aborted) sourceError.value = message(error) }
  finally { if (documentController === controller) loadingDocument.value = false }
}
function previousSource() { const previous = sourceHistory.value.pop(); if (previous) openSource(previous.path, previous.start) }
function filterStrategy(family) { sourceDialog.value = false; studyDialog.value = false; filters.value = { ...filters.value, strategy_families: family }; tab.value = 'catalog'; catalogOffset.value = 0; loadCatalog() }
watch(formatted, value => { if (value && source.value) loadDocument() })
watch(tab, value => { if (value === 'catalog') loadCatalog(); if (value === 'studies') loadStudies() })
watch([filters, catalogQuery], () => { if (tab.value === 'catalog') { clearTimeout(filterTimer); catalogOffset.value = 0; filterTimer = setTimeout(loadCatalog, 150) } }, { deep: true })
onMounted(() => { loadStatus(); if (query.value) search() })
onBeforeUnmount(() => { clearTimeout(filterTimer); for (const controller of [searchController, catalogController, sourceController, studyController, documentController]) controller?.abort() })
</script>

<style scoped>
.knowledge-page { max-width: 1600px; margin: auto; }
.wrap-path, .result-title { overflow-wrap: anywhere; word-break: break-word; max-width: 100%; }
.result-title :deep(.q-btn__content) { justify-content: flex-start; text-align: left; }
.search-button { min-height: 56px; width: 100%; }
.source-excerpt { white-space: pre-wrap; overflow-wrap: anywhere; margin: 10px 0; font: 12px/1.6 monospace; max-height: 270px; overflow: auto; background: #f5f7fa; padding: 10px; border-radius: 4px; }
.source-dialog { width: 1100px; max-width: 96vw; }
.study-dialog { width: 1000px; max-width: 96vw; }
.reader-content { max-height: 65vh; }
.numbered-source { font: 12px/1.7 monospace; }
.source-line { display: flex; }
.line-number { flex: 0 0 44px; text-align: right; padding-right: 12px; color: #667085; user-select: none; }
.line-text { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 599px) {
  .knowledge-page { padding: 12px; }
  .source-dialog, .study-dialog { width: 100%; max-width: 100vw; }
  .reader-content { max-height: calc(100dvh - 210px); }
}
</style>
