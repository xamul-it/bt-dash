<template>
  <div>
    <div class="row justify-end q-mb-sm"><q-btn flat icon="sync" label="Aggiorna catalogo run" :loading="refreshing" @click="refreshRuns" /></div>
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-md-4"><q-select v-model="family" outlined dense clearable label="Strategia / famiglia dei run" :options="facets.strategy_family || []" option-label="value" option-value="value" emit-value map-options /></div>
      <div class="col-12 col-md-4"><q-select v-model="state" outlined dense clearable label="Stato del run" :options="facets.status || []" option-label="value" option-value="value" emit-value map-options /></div>
      <div class="col-12 col-md-4"><q-input v-model="parameter" outlined dense clearable label="Parametro effettivo presente" placeholder="post_up_cooldown_days" /></div>
    </div>
    <q-form @submit="offset = 0; load()" class="row q-col-gutter-sm">
      <div class="col-12 col-md"><q-input v-model="query" outlined clearable label="Cerca nei run" placeholder="ID, configurazione o comportamento da ritrovare" /></div>
      <div class="col-12 col-md-3"><q-select v-model="mode" outlined label="Ricerca run" :options="modes" emit-value map-options /></div>
      <div class="col-12 col-md-auto"><q-btn label="Cerca run" type="submit" color="primary" icon="search" :loading="loading" style="height: 56px" /></div>
    </q-form>
    <div class="text-caption text-grey-7 q-mt-sm q-mb-md">{{ coverage.runs || 0 }} run/configurazioni riconciliati. Le varianti con parametri diversi mantengono identità distinte. I numeri conservano le unità delle fonti. {{ coverage.empty_result_files || 0 }} risultati vuoti sono mantenuti come tali, senza parametri o metriche inventati.</div>
    <q-banner v-if="coverage.result_errors?.length || coverage.parser_warnings?.length" class="bg-orange-1 q-mb-sm">{{ coverage.result_errors?.length || 0 }} file non leggibili e {{ coverage.parser_warnings?.length || 0 }} sorgenti recuperate parzialmente: i limiti sono conservati nel catalogo.</q-banner>
    <q-banner v-if="error" class="bg-red-1 text-negative" role="alert">{{ error }}</q-banner>
    <div class="text-caption q-mb-sm">{{ total }} risultati{{ ranked ? ' fra i candidati più pertinenti' : '' }}</div>
    <q-list separator bordered class="rounded-borders">
      <q-item v-for="run in rows" :key="run.id" clickable @click="openRun(run.id)">
        <q-item-section>
          <strategy-badges :families="[run.strategy_family]" @select="value => { family = value; offset = 0; load() }" />
          <q-item-label class="wrap-path"><strong>{{ run.run_id }}</strong></q-item-label>
          <q-item-label caption class="wrap-path">{{ run.strategy }} · {{ run.start || '?' }} → {{ run.end || '?' }} · {{ run.mode }} · {{ run.status }}</q-item-label>
          <q-item-label caption>{{ run.parameter_state === 'artifact_param_fields' ? 'Parametri effettivi dall’artefatto' : 'Parametri da verificare / sola richiesta' }} · {{ run.source_count }} fonti · {{ run.study_documents?.length || 0 }} documenti collegati</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
    <div class="row justify-between q-mt-sm"><q-btn flat label="Run precedenti" :disable="offset === 0 || loading" @click="offset -= 30; load()" /><q-btn flat label="Run successivi" :disable="offset + 30 >= total || loading" @click="offset += 30; load()" /></div>
    <q-dialog v-model="dialog" :maximized="$q.screen.lt.sm">
      <q-card style="width: 1050px; max-width: 96vw">
        <q-card-section class="row items-start"><div class="col wrap-path"><strategy-badges :families="selected ? [selected.strategy_family] : []" /><div class="text-h6">{{ selected?.run_id || 'Run' }}</div></div><q-btn flat round icon="close" aria-label="Chiudi run" v-close-popup /></q-card-section>
        <q-separator /><q-card-section class="scroll" style="max-height: 72vh">
          <q-banner v-if="detailError" class="bg-red-1 text-negative">{{ detailError }}</q-banner>
          <template v-if="selected">
            <div>{{ selected.strategy }} · {{ selected.status }} · {{ selected.mode }}</div>
            <div class="q-mb-md">Periodo: {{ selected.start || '?' }} → {{ selected.end || '?' }}</div>
            <q-banner v-if="selected.parse_error" class="bg-orange-1">{{ selected.parse_error }}</q-banner>
            <h3 class="text-subtitle1">Parametri effettivi</h3><pre>{{ JSON.stringify(selected.resolved_parameters, null, 2) }}</pre>
            <div class="text-caption">Origine: {{ selected.parameter_state }} · configurazione {{ selected.configuration_fingerprint?.slice(0, 12) }}</div>
            <q-expansion-item label="Input registrati nell’artefatto"><pre>{{ JSON.stringify(selected.artifact_inputs, null, 2) }}</pre></q-expansion-item>
            <q-expansion-item label="Configurazioni richieste, distinte dai parametri effettivi"><pre>{{ JSON.stringify(selected.requested_configurations, null, 2) }}</pre></q-expansion-item>
            <h3 class="text-subtitle1">Metriche e unità</h3><div class="text-caption wrap-path">{{ selected.metrics_source }}</div>
            <q-markup-table dense flat><thead><tr><th class="text-left">Metrica</th><th>Valore</th><th>Unità</th></tr></thead><tbody><tr v-for="(value, key) in selected.metrics" :key="key"><td>{{ key }}</td><td>{{ value }}</td><td>{{ selected.metric_units?.[key] || 'Non dichiarata' }}</td></tr></tbody></q-markup-table>
            <h3 class="text-subtitle1">Documenti che citano l’ID</h3><q-btn v-for="path in selected.study_documents" :key="path" flat no-caps color="primary" class="wrap-path full-width" align="left" :label="path" @click="emit('source', path)" />
            <q-btn v-for="job in selected.job_ids" :key="job" flat no-caps icon="science" label="Apri in Backtest e confronti" :to="{ path: '/ExecuteStrategy', query: { run: job } }" />
            <q-expansion-item label="Provenienza e versioni dei risultati" default-opened><div v-for="(origin, index) in selected.sources" :key="index" class="text-caption wrap-path q-mb-sm">{{ origin.kind }} · {{ origin.path || origin.id }}<span v-if="origin.parser"> · {{ origin.parser }}</span><br />{{ origin.sha256 }}</div></q-expansion-item>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import StrategyBadges from './StrategyBadges.vue'
const props = defineProps({ coverage: { type: Object, default: () => ({}) } })
const emit = defineEmits(['source','refresh'])
const facets = computed(() => props.coverage.facets || {})
const family = ref(null), state = ref(null), parameter = ref(''), query = ref(''), mode = ref('keyword')
const modes = [{value:'keyword',label:'Parole chiave'}, {value:'hybrid',label:'Ibrida'}, {value:'semantic',label:'Semantica'}]
const rows = ref([]), total = ref(0), offset = ref(0), loading = ref(false), error = ref(''), ranked = ref(false)
const refreshing = ref(false); let refreshTimer
const dialog = ref(false), selected = ref(null), detailError = ref('')
async function load() {
  loading.value = true; error.value = ''
  const filters = {}; if (family.value) filters.strategy_family = family.value; if (state.value) filters.status = state.value; if (parameter.value?.trim()) filters.parameter = parameter.value.trim()
  try { const {data} = await api.get('/dyn/knowledge/runs', { params: { filters: JSON.stringify(filters), q: query.value || '', mode: mode.value, offset: offset.value, limit: 30 }, timeout: 120000 }); rows.value = data.runs; total.value = data.total; ranked.value = data.ranked_candidates || false }
  catch (e) { error.value = e.response?.data?.error || e.message } finally { loading.value = false }
}
async function openRun(id) { dialog.value = true; selected.value = null; detailError.value = ''; try { selected.value = (await api.get('/dyn/knowledge/run', { params: { id } })).data } catch(e) { detailError.value = e.response?.data?.error || e.message } }
async function refreshRuns() {
  refreshing.value = true; error.value = ''
  try {
    await api.post('/dyn/knowledge/runs/refresh')
    refreshTimer = setInterval(async () => {
      try {
        const { data } = await api.get('/dyn/knowledge/runs/refresh')
        if (data.state !== 'running') {
          clearInterval(refreshTimer); refreshing.value = false
          if (data.state !== 'completed') error.value = data.error || 'Aggiornamento interrotto'
          else { emit('refresh'); load() }
        }
      } catch (e) { clearInterval(refreshTimer); refreshing.value = false; error.value = e.response?.data?.error || e.message }
    }, 2000)
  } catch (e) { refreshing.value = false; error.value = e.response?.data?.error || e.message }
}
onMounted(load)
onBeforeUnmount(() => clearInterval(refreshTimer))
</script>
<style scoped>
.wrap-path { overflow-wrap: anywhere; word-break: break-word; }
pre { background: #f0f0f0; padding: 12px; font: 12px/1.5 Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
