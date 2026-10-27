<template>
  <div ref="container">
    <div class="row q-gutter-md text-caption q-mb-sm"><span class="text-green-9">━ Bid</span><span class="text-blue-9">━ Ask</span><span class="text-orange-9">● Tick scambiati</span><span class="text-grey-7">× Close barra</span><span>Orari Europe/Rome · size native del feed</span></div>
    <svg v-if="plot" :viewBox="`0 0 ${width} 280`" style="width:100%; min-height:180px; max-height:360px" role="img" aria-label="Bid, ask e tick sullo stesso asse temporale">
      <line x1="70" y1="240" :x2="plot.right" y2="240" stroke="#aaa" />
      <text x="0" y="30" font-size="14">{{ number(plot.max) }}</text><text x="0" y="240" font-size="14">{{ number(plot.min) }}</text>
      <path :d="plot.bid" fill="none" stroke="#2e7d32" stroke-width="2" /><path :d="plot.ask" fill="none" stroke="#1565c0" stroke-width="2" />
      <circle v-for="(point, index) in plot.ticks" :key="`t${index}`" :cx="point.x" :cy="point.y" r="3" fill="#ef6c00" />
      <text v-for="(point, index) in plot.bars" :key="`b${index}`" :x="point.x" :y="point.y" fill="#757575" font-size="14">×</text>
      <text x="70" y="270" font-size="14">{{ time(plot.start) }}</text><text :x="plot.right" y="270" text-anchor="end" font-size="14">{{ time(plot.end) }}</text>
    </svg>
    <div v-else class="q-pa-md text-grey-7">Nessun prezzo disponibile nel segmento selezionato.</div>
    <q-table :rows="tableRows" :columns="columns" row-key="_key" flat dense :pagination="{ rowsPerPage: 15 }" no-data-label="Nessun evento ricevuto" />
  </div>
</template>
<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { eventKind, marketPlot } from '../utils/marketFlow.mjs'
export default {
  name: 'MarketEventViewer',
  props: { rows: { type: Array, default: () => [] } },
  setup (props) {
    const container = ref(null), width = ref(1000)
    let observer
    onMounted(() => {
      observer = new ResizeObserver(entries => { width.value = Math.max(320, entries[0].contentRect.width) })
      observer.observe(container.value)
    })
    onUnmounted(() => observer?.disconnect())
    const time = value => new Date(value).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', fractionalSecondDigits: 3, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const number = value => value == null ? '—' : Number(value).toLocaleString('it-IT', { maximumFractionDigits: 5 })
    const plot = computed(() => marketPlot(props.rows, width.value))
    const tableRows = computed(() => props.rows.slice(-100).map((row, i) => ({ ...row, _key: row.sequence || i, kind: eventKind(row) })).reverse())
    const columns = [{ name: 'timestamp', label: 'Ora · Roma', field: 'timestamp', format: time }, { name: 'symbol', label: 'Simbolo', field: 'symbol' }, { name: 'kind', label: 'Flusso', field: 'kind' },
      ...[['bid_price', 'Bid'], ['ask_price', 'Ask'], ['price', 'Tick'], ['size', 'Size tick'], ['bid_size', 'Size bid'], ['ask_size', 'Size ask'], ['close', 'Close barra']].map(([name, label]) => ({ name, label, field: name, format: number }))]
    return { plot, tableRows, columns, number, time, container, width }
  }
}
</script>
