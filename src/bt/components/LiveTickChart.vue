<template>
  <div class="live-chart">
    <div class="row items-center q-gutter-xs q-mb-sm">
      <q-chip v-for="item in legend" :key="item.key" clickable :outline="!visibility[item.key]" :color="visibility[item.key] ? item.color : 'grey-3'" :text-color="visibility[item.key] ? 'white' : 'grey-8'" @click="visibility[item.key] = !visibility[item.key]">{{ item.label }}</q-chip>
      <span class="text-caption text-grey-7 q-ml-auto">Ultimi 60 secondi · Europe/Rome</span>
    </div>
    <div v-if="quoteLabel" class="text-caption q-mb-sm" :class="plot.staleQuote ? 'text-orange-9' : 'text-grey-7'">{{ quoteLabel }}<span v-if="plot.staleQuote"> · ultima quota fuori dalla finestra, linea tratteggiata</span></div>
    <div v-if="positions.length" class="text-caption text-purple q-mb-sm" aria-label="Posizioni aperte sul grafico">
      <span v-for="(position, i) in positions" :key="i" class="q-mr-md">{{ position.account }} · {{ position.side }} {{ position.qty }} · PMC {{ price(position.avg_entry_price) }}</span>
    </div>
    <svg ref="plotElement" class="live-chart__plot" viewBox="0 0 1000 420" preserveAspectRatio="none" role="img" aria-label="Grafico live bid ask e scambi negli ultimi 60 secondi" :data-range-from="plot.start" :data-range-to="plot.end">
      <g v-for="level in plot.levels" :key="level.y"><line x1="10" x2="910" :y1="level.y" :y2="level.y" stroke="#eef2f6" /><text x="920" :y="level.y + 4" class="axis">{{ price(level.price) }}</text></g>
      <line x1="150" x2="150" y1="20" y2="370" stroke="#d6dde5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
      <text x="75" y="13" text-anchor="middle" class="axis">Barre</text>
      <g v-for="i in 5" :key="i"><line :x1="160 + (i - 1) * 187.5" :x2="160 + (i - 1) * 187.5" y1="20" y2="370" stroke="#f1f4f8" /><text :x="160 + (i - 1) * 187.5" y="400" class="axis" :text-anchor="i === 1 ? 'start' : i === 5 ? 'end' : 'middle'">{{ time(now - 60000 + (i - 1) * 15000) }}</text></g>
      <g v-for="bar in visibility.bars ? plot.bars : []" :key="bar.time" class="live-chart__bar">
        <title>{{ time(bar.time) }} · O {{ price(bar.row.open) }} · H {{ price(bar.row.high) }} · L {{ price(bar.row.low) }} · C {{ price(bar.row.close) }}</title>
        <line :x1="bar.x" :x2="bar.x" :y1="bar.high" :y2="bar.low" :stroke="Number(bar.row.close) >= Number(bar.row.open) ? '#26a69a' : '#ef5350'" stroke-width="1" vector-effect="non-scaling-stroke" />
        <rect :x="bar.x - markerRadius.x * 2" :y="Math.min(bar.open, bar.close)" :width="markerRadius.x * 4" :height="Math.max(Math.abs(bar.close - bar.open), markerRadius.y * 0.4)" :fill="Number(bar.row.close) >= Number(bar.row.open) ? '#26a69a' : '#ef5350'" />
        <text :x="bar.x" y="400" text-anchor="middle" class="axis bar-time">{{ minute(bar.time) }}</text>
      </g>
      <g v-if="visibility.provisional && plot.provisional" class="live-chart__provisional">
        <title>Provvisoria da scambi ricevuti · {{ time(plot.provisional.time) }} · O {{ price(plot.provisional.row.open) }} · H {{ price(plot.provisional.row.high) }} · L {{ price(plot.provisional.row.low) }} · C {{ price(plot.provisional.row.close) }}</title>
        <line :x1="plot.provisional.x" :x2="plot.provisional.x" :y1="plot.provisional.high" :y2="plot.provisional.low" stroke="#757575" stroke-width="1" vector-effect="non-scaling-stroke" />
        <rect :x="plot.provisional.x - markerRadius.x * 2" :y="Math.min(plot.provisional.open, plot.provisional.close)" :width="markerRadius.x * 4" :height="Math.max(Math.abs(plot.provisional.close - plot.provisional.open), markerRadius.y * 0.4)" fill="#757575" />
        <text :x="plot.provisional.x" y="400" text-anchor="middle" class="axis bar-time">{{ minute(plot.provisional.time) }}</text>
      </g>
      <path v-if="visibility.bid" :d="plot.bid" fill="none" stroke="#2e7d32" stroke-width="2" :stroke-dasharray="plot.staleQuote ? '6 4' : null" vector-effect="non-scaling-stroke" />
      <path v-if="visibility.ask" :d="plot.ask" fill="none" stroke="#1976d2" stroke-width="2" :stroke-dasharray="plot.staleQuote ? '6 4' : null" vector-effect="non-scaling-stroke" />
      <line v-for="(line, i) in positionLines" :key="`p${i}`" x1="10" x2="910" :y1="line" :y2="line" stroke="#8e24aa" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
      <ellipse v-for="(tick, i) in visibility.trades ? plot.ticks : []" :key="i" :cx="tick.x" :cy="tick.y" :rx="markerRadius.x" :ry="markerRadius.y" fill="#ef6c00"><title>{{ time(tick.time) }} · {{ price(tick.price) }}</title></ellipse>
      <text v-if="!plot.levels.length" x="535" y="200" text-anchor="middle" class="axis">In attesa di dati nella finestra</text>
    </svg>
  </div>
</template>
<script>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { liveTickPlot } from '../utils/marketFlow.mjs'
export default {
  props: { rows: { type: Array, default: () => [] }, now: { type: Number, required: true }, positions: { type: Array, default: () => [] }, provisional: { type: Object, default: null }, latestQuote: { type: Object, default: null } },
  setup (props) {
    const visibility = reactive({ bid: true, ask: true, trades: true, bars: true, provisional: true })
    const plotElement = ref(null), markerRadius = ref({ x: 2.5, y: 2.5 })
    let observer
    onMounted(() => {
      observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) markerRadius.value = { x: 2500 / width, y: 1050 / height }
      })
      observer.observe(plotElement.value)
    })
    onUnmounted(() => observer?.disconnect())
    const legend = [{ key: 'bid', label: 'Bid', color: 'green-8' }, { key: 'ask', label: 'Ask', color: 'blue-8' }, { key: 'trades', label: 'Scambi', color: 'orange-8' }, { key: 'bars', label: 'Barre Alpaca', color: 'grey-8' }, { key: 'provisional', label: 'Barra da scambi', color: 'grey-7' }]
    const plot = computed(() => liveTickPlot(props.rows, props.now, visibility, props.provisional, props.latestQuote))
    const quoteLabel = computed(() => {
      const stamp = Date.parse(props.latestQuote?.timestamp || props.latestQuote?.ts)
      if (!Number.isFinite(stamp) || stamp > props.now) return ''
      const age = Math.floor((props.now - stamp) / 1000)
      return `Ultimo bid/ask ricevuto: ${time(stamp)} · ${age} s fa`
    })
    const positionLines = computed(() => {
      if (!plot.value.levels.length) return []
      const high = plot.value.levels[0].price, low = plot.value.levels[4].price
      return props.positions.map(p => Number(p.avg_entry_price)).filter(p => p >= low && p <= high).map(p => 20 + (high - p) / (high - low) * 350)
    })
    const time = stamp => new Date(stamp).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false })
    const minute = stamp => new Date(stamp).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false })
    const price = value => Number(value).toLocaleString('it-IT', { maximumFractionDigits: 5 })
    return { visibility, legend, plot, positionLines, plotElement, markerRadius, quoteLabel, time, minute, price }
  }
}
</script>
<style scoped>
.live-chart { min-width: 0; }
.live-chart__plot { display: block; width: 100%; height: 420px; background: white; }
.axis { fill: #536171; font: 12px Roboto, sans-serif; }
.bar-time { font-size: 9px; }
</style>
