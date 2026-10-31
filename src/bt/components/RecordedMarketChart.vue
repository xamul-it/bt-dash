<template>
  <div>
    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn-toggle v-model="mode" no-caps unelevated toggle-color="primary" :options="[{label:'Barre · 1 minuto',value:'bars'},{label:'Tick',value:'ticks'},{label:'Confronto',value:'compare'}]" />
      <q-btn flat icon="open_in_new" label="Apri grafico esterno" :href="externalUrl" target="_blank" rel="noopener noreferrer" />
    </div>
    <q-select v-model="selectedRun" :options="runOptions" label="Run backtest da confrontare (facoltativo)" outlined dense clearable emit-value map-options class="q-mb-sm" :loading="runLoading" @focus="loadRuns" @popup-show="loadRuns" @update:model-value="loadTrades"><template #no-option><q-item><q-item-section>{{ runLoading ? 'Caricamento run…' : 'Nessun run preferito completato disponibile' }}</q-item-section></q-item></template></q-select>
    <div v-if="runNote" class="text-caption text-warning q-mb-sm">{{ runNote }}</div>
    <div v-if="simulation.missing" class="text-caption text-warning q-mb-sm">{{ simulation.missing }} eventi nel run simulato senza prezzo o orario con fuso esplicito: non posizionati sui tick.</div>
    <OpenPositionChart :symbol="symbol" historical :start="start" :end="end">
      <template #default="{ positions, fills, fillsNote }">
        <div v-if="mode !== 'ticks'" class="q-mb-md">
          <div class="text-subtitle2">Barre native registrate · 1 minuto</div>
          <div class="text-caption">Seleziona una candela per esaminare i tick di quel minuto. Nessuna barra viene ricostruita dal campione di tick.</div>
          <MarketEventViewer mode="bars" :rows="bars" :positions="positions" :executions="[...fills, ...simulation.markers]" :start="start" :end="end" :visible-range="range" :cursor="cursor" :height="mode === 'compare' ? 280 : 440" empty-label="Nessuna barra registrata nel periodo." @range-change="changeRange" @reset-range="reset" @cursor-change="cursor = $event" @select-minute="selectMinute" />
        </div>
        <div v-if="mode !== 'bars'">
          <div class="text-subtitle2">Tick · bid, ask e scambi</div>
          <MarketEventViewer mode="ticks" :rows="ticks" :positions="mode === 'ticks' ? positions : []" :executions="[...fills, ...simulation.markers]" :start="start" :end="end" :visible-range="range" :cursor="cursor" :height="mode === 'compare' ? 280 : 440" empty-label="Nessun tick registrato nel periodo." @range-change="changeRange" @reset-range="reset" @cursor-change="cursor = $event" />
        </div>
        <div v-if="fillsNote" class="text-warning q-mt-sm">{{ fillsNote }}</div>
        <q-expansion-item label="Eseguiti e simulazioni nel periodo" dense class="q-mt-sm">
          <div class="text-caption">Punti viola: eseguiti Alpaca. Punti verdi: simulazioni del run scelto. Prezzi e orari degli eseguiti disponibili. Acquisti e vendite non sono automaticamente aperture e chiusure di posizione. Il PMC attuale non è un eseguito storico.</div>
          <q-table :rows="[...fills, ...simulation.markers]" :columns="fillColumns" row-key="id" flat dense no-data-label="Nessun eseguito disponibile nel periodo per il conto selezionato." />
        </q-expansion-item>
      </template>
    </OpenPositionChart>
  </div>
</template>
<script>
import { computed, ref, onUnmounted, watch } from 'vue'
import { api } from 'boot/axios'
import { simulationMarkers } from '../utils/executionMarkers.mjs'
import OpenPositionChart from './OpenPositionChart.vue'
import MarketEventViewer from './MarketEventViewer.vue'
export default {
  components: { OpenPositionChart, MarketEventViewer },
  props: { symbol: String, selectionKey: String, bars: { type: Array, default: () => [] }, ticks: { type: Array, default: () => [] }, start: Number, end: Number },
  emits: ['range-change', 'reset-range'],
  setup (props, { emit }) {
    const mode = ref('compare'), range = ref(null), cursor = ref(null)
    let resetPending = false
    watch(() => props.selectionKey, () => { resetPending = true })
    watch(() => [props.bars, props.ticks], () => {
      if (resetPending && props.start != null && props.end != null) {
        range.value = { from: props.start, to: props.end > props.start ? props.end : props.start + 60 }
        resetPending = false
      }
    })
    const selectedRun = ref(null), runs = ref([]), trades = ref([]), runLoading = ref(false), runNote = ref('')
    let generation = 0, disposed = false
    const runOptions = computed(() => runs.value.filter(row => row.kind === 'simulation' && row.status === 'completed' && row.archive?.pinned === true).map(row => ({
      value: row.id, label: [row.archive?.label || row.request_snapshot?.configuration?.label || 'Backtest senza nome', row.request_snapshot?.configuration?.strategy, row.created_at || row.id].filter(Boolean).join(' · '),
    })))
    const simulation = computed(() => simulationMarkers(trades.value, props.symbol, props.start, props.end))
    async function loadRuns () {
      if (runs.value.length || runLoading.value) return
      runLoading.value = true
      try { const { data } = await api.get('/dyn/simulations/jobs'); if (!disposed) runs.value = data }
      catch (e) { if (!disposed) runNote.value = 'Elenco dei run non disponibile.' }
      finally { if (!disposed) runLoading.value = false }
    }
    async function loadTrades () {
      const token = ++generation
      trades.value = []; runNote.value = ''; runLoading.value = false
      if (!selectedRun.value) return
      runLoading.value = true
      try {
        let total = Infinity, collected = []
        for (let page = 1; page <= 20 && collected.length < total; page++) {
          const { data } = await api.get(`/dyn/simulations/jobs/${encodeURIComponent(selectedRun.value)}/trades`, { params: { page, limit: 200, symbol: props.symbol } })
          if (disposed || token !== generation) return
          total = data.total; collected.push(...data.rows)
          if (!data.rows.length) break
        }
        trades.value = collected
        if (collected.length < total) runNote.value = 'Trade simulati parziali: limite di caricamento raggiunto.'
      } catch (e) { if (token === generation && !disposed) runNote.value = e.response?.data?.error || 'Trade del run non disponibili.' }
      finally { if (token === generation && !disposed) runLoading.value = false }
    }
    onUnmounted(() => { disposed = true; generation++ })
    const externalUrl = computed(() => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(props.symbol || '')}`)
    function changeRange (value) {
      if (range.value && Math.abs(range.value.from - value.from) < .001 && Math.abs(range.value.to - value.to) < .001) return
      range.value = value; emit('range-change', value)
    }
    function reset () { range.value = { from: props.start, to: props.end > props.start ? props.end : props.start + 60 }; emit('reset-range') }
    function selectMinute (value) { mode.value = 'compare'; changeRange(value) }
    const fillColumns = [
      { name: 'time', label: 'Ora eseguito · Roma', field: 'timestamp', format: value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) },
      { name: 'account', label: 'Conto', field: 'account' },
      { name: 'side', label: 'Operazione', field: 'side', format: value => value === 'buy' ? 'Acquisto' : 'Vendita' },
      { name: 'qty', label: 'Quantità', field: 'qty' }, { name: 'price', label: 'Prezzo eseguito', field: 'price' },
    ]
    return { selectedRun, runOptions, runLoading, runNote, simulation, loadRuns, loadTrades, mode, range, cursor, externalUrl, changeRange, reset, selectMinute, fillColumns }
  },
}
</script>
