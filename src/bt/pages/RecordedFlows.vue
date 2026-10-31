<template>
  <q-page padding class="zmq-history">
    <div class="row items-center q-col-gutter-md q-mb-lg"><div class="col-12 col-md"><div class="text-h5">Gestione storico</div><div class="text-body2 text-grey-7">Le registrazioni di mercato salvate, organizzate per simbolo e finestra temporale.</div></div><div class="col-auto"><q-btn outline icon="refresh" label="Aggiorna archivio" :loading="loading" @click="load" /></div></div>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>
    <q-card v-if="symbol" flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="row items-center q-col-gutter-md"><div class="col-12 col-md"><div class="text-h6">{{ symbol }} <q-badge color="blue-1" text-color="primary" class="q-ml-sm">{{ index.windows?.length ? `${index.windows.length} finestre salvate` : 'Analisi finestre' }}<q-tooltip>Finestre raggruppate per giorno, sessione di mercato e interruzioni oltre 30 minuti.</q-tooltip></q-badge></div><div class="text-caption text-grey-7">{{ coverageLabel }}</div></div><div class="col-auto"><q-btn flat icon="replay" label="Apri nel replay" :to="{ path: '/Zmq/Replay', query: { symbol } }" /></div><div class="col-auto"><q-btn flat round icon="close" aria-label="Chiudi grafico storico" @click="close" /></div></div>
        <div v-if="index.windows?.length" class="row items-center q-col-gutter-md q-mt-sm">
          <div class="col-12 col-md-8"><q-select v-model="selectedWindows" :options="windowOptions" :display-value="`${selectedWindows.length} finestre selezionate su ${index.windows?.length || 0}`" label="Finestre da visualizzare" multiple emit-value map-options outlined dense options-dense hint="Spunta o togli la spunta alle finestre da mostrare." @update:model-value="loadOverview">
            <template #option="scope"><q-item v-bind="scope.itemProps"><q-item-section side><q-checkbox :model-value="scope.selected" :aria-label="scope.opt.label" @click.stop="scope.toggleOption(scope.opt)" /></q-item-section><q-item-section><q-item-label>{{ scope.opt.label }}</q-item-label></q-item-section></q-item></template>
          </q-select></div>
          <div class="col-auto"><q-btn flat label="Tutte le finestre" icon="select_all" @click="selectAll" /></div><div class="col-auto"><q-btn flat label="Deseleziona tutte" icon="deselect" :disable="!selectedWindows.length" @click="deselectAll" /></div><div class="col-auto"><q-btn flat label="Solo AH" icon="nights_stay" :disable="!index.windows.some(w => w.session === 'After-hours')" @click="selectAh" /></div><div class="col-auto text-caption">{{ selectedWindows.length }} selezionate su {{ index.windows.length }}</div>
        </div>
        <div v-if="index.state === 'INDEXING' || index.state === 'QUEUED'" class="q-mt-md"><q-linear-progress :value="index.progress || 0" :indeterminate="index.state === 'QUEUED'" color="primary" /><div class="text-caption q-mt-xs">{{ index.state === 'QUEUED' ? 'Analisi in attesa…' : `Analisi dello storico completo · ${Math.round((index.progress || 0) * 100)}%` }} · La pagina resta utilizzabile.</div></div>
        <q-banner v-if="index.stale" rounded class="bg-amber-1 q-mt-md">Sono stati registrati nuovi dati dopo l’ultima analisi. <q-btn flat dense label="Aggiorna finestre" @click="analyze(true)" /></q-banner>
        <div v-if="index.error" class="text-negative q-mt-sm">{{ index.error }} <q-btn flat dense label="Riprova analisi" @click="analyze(true)" /></div>
        <div class="relative-position q-mt-md"><RecordedMarketChart :symbol="symbol" historical :key="symbol" :selection-key="selectedWindows.join(',')" :bars="chart.bars || []" :ticks="chart.rows || []" :start="chart.start" :end="chart.end" :height="460" empty-label="Seleziona una finestra o attendi l’analisi dello storico." @range-change="zoom" @reset-range="loadOverview" /><q-inner-loading :showing="chartLoading"><q-spinner color="primary" size="32px" /></q-inner-loading></div>
        <q-banner v-if="gaps.length" class="bg-amber-1 q-mt-sm">Interruzioni tra le finestre selezionate:
          <div v-for="gap in gaps" :key="gap.from">{{ dateTime(gap.from) }} → {{ dateTime(gap.to) }}</div>
        </q-banner>
        <div v-if="chart.events != null" class="text-caption text-grey-7 q-mt-md">{{ chart.bars?.length || 0 }} barre native · {{ chart.rows?.length || 0 }} tick visualizzati su {{ chart.visible_events ?? chart.events }} nel segmento. {{ chart.sampled ? 'La panoramica copre l’intero periodo; ingrandisci per caricare più dettaglio.' : 'Tick del segmento caricati integralmente; eventi allo stesso istante possono sovrapporsi.' }}</div>
      </q-card-section>
    </q-card>
    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md"><div class="col"><div class="text-h6">Flussi registrati <q-badge color="grey-3" text-color="grey-9">{{ archives.length }}</q-badge></div></div><div class="col-12 col-sm-5"><q-input v-model="search" label="Cerca un simbolo" outlined dense clearable><template #prepend><q-icon name="search" /></template></q-input></div></q-card-section>
      <q-table :rows="archives" :grid="$q.screen.lt.sm" :columns="columns" :filter="search" row-key="symbol" :pagination="{ rowsPerPage: 15 }" flat no-data-label="Nessuna registrazione disponibile">
        <template #item="props"><div class="col-12 q-pa-sm"><q-card flat bordered><q-card-section class="row items-center"><div class="text-h6">{{ props.row.symbol }}</div><q-space /><q-btn flat round dense color="primary" icon="show_chart" :aria-label="`Grafico storico ${props.row.symbol}`" @click="open(props.row.symbol)" /><q-btn flat round dense icon="replay" :aria-label="`Replay ${props.row.symbol}`" :to="{ path: '/Zmq/Replay', query: { symbol: props.row.symbol } }" /><q-btn flat round dense color="negative" icon="delete_outline" :aria-label="`Cancella ${props.row.symbol}`" @click="askDelete(props.row)" /></q-card-section><q-card-section class="q-pt-none text-caption text-grey-7">{{ (props.row.bytes / 1000000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) }} MB · Ultima registrazione {{ dateTime(props.row.modified_at * 1000) }}</q-card-section></q-card></div></template>
        <template #body-cell-symbol="props"><q-td :props="props"><q-btn flat no-caps color="primary" :label="props.row.symbol" @click="open(props.row.symbol)" /></q-td></template>
        <template #body-cell-actions="props"><q-td :props="props" class="text-right"><q-btn flat round dense color="primary" icon="show_chart" :aria-label="`Grafico storico ${props.row.symbol}`" @click="open(props.row.symbol)"><q-tooltip>Grafico e finestre salvate</q-tooltip></q-btn><q-btn flat round dense icon="replay" :aria-label="`Replay ${props.row.symbol}`" :to="{ path: '/Zmq/Replay', query: { symbol: props.row.symbol } }"><q-tooltip>Apri nel replay ZMQ</q-tooltip></q-btn><q-btn flat round dense color="negative" icon="delete_outline" :aria-label="`Cancella ${props.row.symbol}`" @click="askDelete(props.row)"><q-tooltip>Cancella archivio</q-tooltip></q-btn></q-td></template>
      </q-table>
    </q-card>
    <HistoricalQuoteDownload />
    <q-dialog v-model="deleteOpen" persistent><q-card style="width:500px;max-width:95vw"><q-card-section><div class="text-h6">Cancella {{ deleting?.symbol }}</div><p>Elimina definitivamente tutte le finestre registrate per questo simbolo. Prima interrompi le sottoscrizioni e gli eventuali replay.</p><q-input v-model="confirmation" label="Digita il simbolo per confermare" outlined /><div v-if="deleteError" class="text-negative q-mt-sm">{{ deleteError }}</div></q-card-section><q-card-actions align="right"><q-btn flat label="Annulla" v-close-popup :disable="deletingBusy" /><q-btn color="negative" label="Elimina definitivamente" :disable="confirmation !== deleting?.symbol" :loading="deletingBusy" @click="remove" /></q-card-actions></q-card></q-dialog>
  </q-page>
</template>
<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import RecordedMarketChart from '../components/RecordedMarketChart.vue'
import { latestContinuousWindows, recordingGaps } from '../utils/archiveSelection.mjs'
import HistoricalQuoteDownload from '../components/HistoricalQuoteDownload.vue'
export default {
  components: { RecordedMarketChart, HistoricalQuoteDownload },
  setup () {
    const route = useRoute(), archives = ref([]), search = ref(''), error = ref(''), loading = ref(false), symbol = ref(''), index = ref({}), selectedWindows = ref([]), chart = ref({}), chartLoading = ref(false)
    const deleteOpen = ref(false), deleting = ref(null), confirmation = ref(''), deleteError = ref(''), deletingBusy = ref(false)
    let pollTimer, generation = 0, chartRequest = 0, lastRange = '', disposed = false
    const dateTime = value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
    const windowOptions = computed(() => (index.value.windows || []).map(window => ({ value: window.id, label: `${window.date} · ${window.session} · ${dateTime(window.start_ns / 1e6)} → ${dateTime(window.end_ns / 1e6)} · ${window.event_count.toLocaleString('it-IT')} eventi` })))
    const gaps = computed(() => recordingGaps((index.value.windows || []).filter(w => selectedWindows.value.includes(w.id))))
    const coverageLabel = computed(() => { const windows = index.value.windows || []; return windows.length ? `${dateTime(windows[0].start_ns / 1e6)} → ${dateTime(windows.at(-1).end_ns / 1e6)} · Orari Roma` : 'Preparazione delle finestre temporali' })
    const columns = [{ name: 'symbol', label: 'Simbolo', field: 'symbol', align: 'left', sortable: true }, { name: 'bytes', label: 'Dimensione', field: 'bytes', format: value => `${(value / 1000000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`, sortable: true }, { name: 'modified_at', label: 'Ultima registrazione', field: 'modified_at', format: value => dateTime(value * 1000), sortable: true }, { name: 'actions', label: 'Azioni', field: 'symbol' }]
    const failure = e => { error.value = e.response?.data?.error || e.message }
    async function load () { loading.value = true; try { archives.value = (await api.get('/dyn/quote-monitor/archives')).data.rows } catch (e) { failure(e) } finally { loading.value = false } }
    async function readIndex (token) {
      const { data } = await api.get(`/dyn/quote-monitor/archives/${encodeURIComponent(symbol.value)}/index`)
      if (token !== generation || disposed) return
      const wasReady = !!index.value.windows?.length
      const previousState = index.value.state
      const previousSelection = selectedWindows.value.slice()
      index.value = data
      if (data.state === 'READY' && data.windows.length && (!wasReady || previousState !== 'READY')) {
        selectedWindows.value = !wasReady ? latestContinuousWindows(data.windows) : previousSelection.filter(id => data.windows.some(w => w.id === id))
        await loadOverview()
      }
      if (['INDEXING', 'QUEUED'].includes(data.state)) pollTimer = setTimeout(() => readIndex(token).catch(failure), 1500)
    }
    async function analyze (refresh = false) { try { await api.post(`/dyn/quote-monitor/archives/${encodeURIComponent(symbol.value)}/index`, { refresh }); clearTimeout(pollTimer); await readIndex(generation) } catch (e) { failure(e) } }
    async function open (value) {
      clearTimeout(pollTimer); generation++; chartRequest++; symbol.value = value; index.value = {}; selectedWindows.value = []; chart.value = {}; chartLoading.value = false; error.value = ''; lastRange = ''
      try { await readIndex(generation); if (index.value.state === 'MISSING') await analyze() } catch (e) { failure(e) }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    async function fetchChart (range) {
      const request = ++chartRequest
      if (!symbol.value || !selectedWindows.value.length) { chart.value = {}; chartLoading.value = false; return }
      chartLoading.value = true
      try {
        const params = { windows: selectedWindows.value.join(','), from: range?.from, to: range?.to }
        const endpoint = `/dyn/quote-monitor/archives/${encodeURIComponent(symbol.value)}/chart`
        const [ticks, bars] = await Promise.all([
          api.get(endpoint, { params: { ...params, mode: 'ticks' }, timeout: 45000 }),
          api.get(endpoint, { params: { ...params, mode: 'bars' }, timeout: 45000 }),
        ])
        if (request === chartRequest && !disposed) chart.value = { ...ticks.data, bars: bars.data.rows }
      } catch (e) { if (request === chartRequest) failure(e) } finally { if (request === chartRequest) chartLoading.value = false }
    }
    function loadOverview () { lastRange = ''; return fetchChart() }
    function zoom (range) { const key = `${Math.round(range.from)}:${Math.round(range.to)}`; if (key === lastRange || range.from <= chart.value.start && range.to >= chart.value.end) return; lastRange = key; fetchChart(range) }
    function selectAll () { selectedWindows.value = (index.value.windows || []).map(w => w.id); loadOverview() }
    function deselectAll () { selectedWindows.value = []; loadOverview() }
    function selectAh () { selectedWindows.value = (index.value.windows || []).filter(w => w.session === 'After-hours').map(w => w.id); loadOverview() }
    function close () { generation++; chartRequest++; clearTimeout(pollTimer); symbol.value = '' }
    function askDelete (row) { deleting.value = row; confirmation.value = ''; deleteError.value = ''; deleteOpen.value = true }
    async function remove () { deletingBusy.value = true; try { await api.delete(`/dyn/quote-monitor/archives/${encodeURIComponent(deleting.value.symbol)}`, { data: { confirm_symbol: confirmation.value, version: deleting.value.version } }); if (symbol.value === deleting.value.symbol) close(); deleteOpen.value = false; await load() } catch (e) { deleteError.value = e.response?.data?.error || e.message } finally { deletingBusy.value = false } }
    onMounted(async () => { await load(); if (route.query.symbol) open(String(route.query.symbol)) })
    onUnmounted(() => { disposed = true; generation++; chartRequest++; clearTimeout(pollTimer) })
    return { archives, search, error, loading, symbol, index, selectedWindows, windowOptions, gaps, coverageLabel, chart, chartLoading, columns, dateTime, load, open, close, analyze, loadOverview, zoom, selectAll, deselectAll, selectAh, deleteOpen, deleting, confirmation, deleteError, deletingBusy, askDelete, remove }
  }
}
</script>
