<template>
  <div ref="wrapper" class="market-viewer" :class="{ 'market-viewer--fullscreen': fullscreen }">
    <div class="market-viewer__toolbar q-mb-sm">
      <q-chip v-for="item in visibleLegend" :key="item.key" clickable :outline="!visibility[item.key]" :color="visibility[item.key] ? item.color : 'grey-3'" :text-color="visibility[item.key] ? 'white' : 'grey-8'" @click="toggle(item.key)">{{ item.label }} <span v-if="hover[item.key]" class="q-ml-sm">{{ hover[item.key] }}</span></q-chip>
      <div class="market-viewer__tools"><span class="text-caption text-grey-7">{{ hoverTime || 'Orari Europe/Rome' }}</span>
      <q-btn flat round dense icon="fit_screen" aria-label="Mostra tutto il periodo" @click="fit"><q-tooltip>Tutto il periodo</q-tooltip></q-btn>
      <q-btn flat round dense :icon="fullscreen ? 'fullscreen_exit' : 'fullscreen'" aria-label="Espandi grafico" @click="fullscreen = !fullscreen"><q-tooltip>Schermo intero</q-tooltip></q-btn>
    </div></div>
    <div v-if="positions.length || position" class="market-viewer__positions q-mb-sm" aria-label="Posizioni aperte sul grafico">
      <div v-for="(item, i) in positionItems" :key="`${item.accountId || ''}:${i}`" class="market-viewer__position"><span aria-hidden="true">┄</span> {{ item.account || 'Posizione aperta' }} · {{ item.side }} {{ item.qty }} · <strong>PMC {{ number(item.avg_entry_price) }}</strong><q-tooltip>Posizione attuale. Il riferimento resta visibile qui anche se il prezzo è fuori dalla scala del grafico.</q-tooltip></div>
    </div>
    <div ref="container" class="market-viewer__chart" :style="{ height: fullscreen ? 'calc(100vh - 160px)' : `${height}px` }" role="img" :aria-label="mode === 'bars' ? 'Grafico barre native' : 'Grafico finanziario bid ask e scambi'" />
    <div v-if="!rows.length" class="text-center text-grey-6 q-pa-md">{{ emptyLabel }}</div>
    <div class="text-caption text-grey-6 q-mt-xs">Trascina per scorrere · rotella o pizzica con due dita per lo zoom</div>
    <q-expansion-item v-if="rows.length" dense icon="data_object" label="Dati grezzi del campione" class="q-mt-md">
      <q-table :rows="tableRows" :columns="columns" row-key="_key" flat dense :pagination="{ rowsPerPage: 10 }" />
    </q-expansion-item>
  </div>
</template>
<script>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { createChart, LineSeries, CandlestickSeries, ColorType, LineType, HistogramSeries } from 'lightweight-charts'
import { marketSeries } from '../utils/marketChart.mjs'
import { eventKind, isOutOfSequenceTrade } from '../utils/marketFlow.mjs'
export default {
  props: { mode: { type: String, default: 'all' }, visibleRange: Object, cursor: Object, executions: { type: Array, default: () => [] }, rows: { type: Array, default: () => [] }, timeline: { type: Array, default: () => [] }, start: Number, end: Number, height: { type: Number, default: 420 }, follow: Boolean, position: { type: Object, default: null }, positions: { type: Array, default: () => [] }, emptyLabel: { type: String, default: 'In attesa di dati per il simbolo selezionato.' } },
  emits: ['range-change', 'reset-range', 'cursor-change', 'select-minute'],
  setup (props, { emit }) {
    const wrapper = ref(null), container = ref(null), fullscreen = ref(false), hover = ref({}), hoverTime = ref('')
    const visibility = ref({ bid: true, ask: true, trades: true, bars: true })
    const legend = [{ key: 'bid', label: 'Bid', color: 'green-8' }, { key: 'ask', label: 'Ask', color: 'blue-8' }, { key: 'trades', label: 'Scambi', color: 'orange-8' }, { key: 'bars', label: 'Barre', color: 'grey-7' }]
    const visibleLegend = computed(() => legend.filter(item => props.mode === 'all' || (props.mode === 'bars' ? item.key === 'bars' : item.key !== 'bars')))
    const positionItems = computed(() => props.positions.length ? props.positions : props.position ? [props.position] : [])
    let chart, volumeSeries, executionSeries, simulationSeries, timelineSeries, syncingCursor = false, positionSeries, positionLines = [], series = {}, observer, initialized = false, suppress = false, rangeTimer, disposed = false
    const number = value => value == null ? '—' : Number(value).toLocaleString('it-IT', { maximumFractionDigits: 5 })
    const time = value => new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome', hour12: false })
    function fit () { suppress = true; if (props.start != null && props.end > props.start) chart?.timeScale().setVisibleRange({ from: props.start, to: props.end }); else chart?.timeScale().fitContent(); setTimeout(() => { suppress = false }, 0); emit('reset-range') }
    function updatePosition () {
      if (!positionSeries) return
      positionLines.forEach(line => positionSeries.removePriceLine(line))
      positionLines = positionItems.value.filter(item => Number(item.avg_entry_price) > 0).map(item => positionSeries.createPriceLine({ price: Number(item.avg_entry_price), color: '#8e24aa', lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title: `PMC ${item.account || ''} · ${item.side || ''} ${item.qty}` }))
    }

    function applyRange (range) {
      if (!chart || !range || !(range.to > range.from)) return
      clearTimeout(rangeTimer); suppress = true
      chart.timeScale().setVisibleRange(range)
      setTimeout(() => { suppress = false }, 0)
    }
    function update () {
      if (!chart) return
      suppress = true
      clearTimeout(rangeTimer)
      const previous = initialized ? chart.timeScale().getVisibleRange() : null
      const data = marketSeries(props.rows)
      timelineSeries.setData(props.timeline.map(time => ({ time })))
      for (const key of Object.keys(series)) {
        const points = data[key].slice()
        if (props.start != null && (!points.length || points[0].time > props.start)) points.unshift({ time: props.start })
        if (props.end != null && props.end > props.start && (!points.length || points.at(-1).time < props.end)) points.push({ time: props.end })
        series[key].setData(points)
      }
      volumeSeries.setData(props.mode === 'bars' ? props.rows.filter(row => eventKind(row) === 'bar' && row.volume != null)
        .map(row => ({ time: row.time ?? Date.parse(row.timestamp) / 1000, value: Number(row.volume), color: Number(row.close) >= Number(row.open) ? '#26a69a55' : '#ef535055' }))
        .filter((row, i, all) => !i || row.time > all[i - 1].time) : [])
      for (const [target, simulated] of [[executionSeries, false], [simulationSeries, true]]) {
        const fills = props.executions.filter(fill => (fill.source === 'simulation') === simulated)
          .map(fill => ({ time: Date.parse(fill.timestamp) / 1000, value: Number(fill.price) }))
          .filter(fill => Number.isFinite(fill.time) && fill.value > 0)
        target.setData([...new Map(fills.map(fill => [fill.time, fill])).values()].sort((a, b) => a.time - b.time))
      }
      // Independent series keeps position lines visible when Bid is hidden.
      const anchor = Object.values(data).flat().map(point => ({ time: point.time, value: Number(positionItems.value[0]?.avg_entry_price) || 1 }))
      positionSeries.setData([...new Map(anchor.map(point => [point.time, point])).values()].sort((a, b) => a.time - b.time))
      if (previous && !props.follow) chart.timeScale().setVisibleRange(previous)
      if (!initialized && props.rows.length) { initialized = true; if (props.start != null && props.end > props.start) chart.timeScale().setVisibleRange({ from: props.start, to: props.end }); else chart.timeScale().fitContent() }
      if (props.visibleRange) applyRange(props.visibleRange)
      if (props.follow && initialized) chart.timeScale().scrollToRealTime()
      setTimeout(() => { suppress = false }, 0)
    }
    const onKeyDown = event => { if (event.key === 'Escape') fullscreen.value = false }
    function toggle (key) { visibility.value[key] = !visibility.value[key]; series[key]?.applyOptions({ visible: visibility.value[key] }) }
    onMounted(async () => {
      await nextTick()
      if (disposed) return
      window.addEventListener('keydown', onKeyDown)
      chart = createChart(container.value, { autoSize: true, layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#536171', fontFamily: 'Roboto, sans-serif' },
        grid: { vertLines: { color: '#f1f4f8' }, horzLines: { color: '#eef2f6' } }, rightPriceScale: { borderColor: '#dde4ec' },
        timeScale: { timeVisible: true, secondsVisible: true, borderColor: '#dde4ec', tickMarkFormatter: (value, type) => new Date(Number(value) * 1000).toLocaleString('it-IT', type <= 2 ? { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit' } : { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, localization: { locale: 'it-IT', timeFormatter: value => time(Number(value) * 1000) }, crosshair: { mode: 0 } })
      series.bid = chart.addSeries(LineSeries, { color: '#2e7d32', lineWidth: 2, lineType: LineType.WithSteps, priceLineVisible: false })
      series.ask = chart.addSeries(LineSeries, { color: '#1976d2', lineWidth: 2, lineType: LineType.WithSteps, priceLineVisible: false })
      series.trades = chart.addSeries(LineSeries, { color: '#ef6c00', lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2, priceLineVisible: false })
      series.bars = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350', borderVisible: false, priceLineVisible: false })
      for (const [key, item] of Object.entries(series)) item.applyOptions({ visible: props.mode === 'all' || (props.mode === 'bars' ? key === 'bars' : key !== 'bars') })
      volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false })
      volumeSeries.priceScale().applyOptions({ scaleMargins: { top: .85, bottom: 0 } })
      executionSeries = chart.addSeries(LineSeries, { color: '#7b1fa2', lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 5, lastValueVisible: false, priceLineVisible: false })
      simulationSeries = chart.addSeries(LineSeries, { color: '#2e7d32', lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 5, lastValueVisible: false, priceLineVisible: false })
      timelineSeries = chart.addSeries(LineSeries, { lineVisible: false, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false })
      positionSeries = chart.addSeries(LineSeries, { lineVisible: false, pointMarkersVisible: false, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null })
      chart.subscribeCrosshairMove(param => { if (!param.time) { if (!syncingCursor && param.sourceEvent) emit('cursor-change', null); return }; if (!syncingCursor && param.sourceEvent && props.cursor?.time !== Number(param.time)) emit('cursor-change', { time: Number(param.time) }); hoverTime.value = time(Number(param.time) * 1000); const next = {}; for (const [key, item] of Object.entries(series)) { const point = param.seriesData.get(item); if (point) next[key] = number(point.value ?? point.close) } hover.value = next })
      chart.subscribeClick(param => { if (props.mode === 'bars' && param.time) emit('select-minute', { from: Number(param.time), to: Number(param.time) + 60 }) })
      chart.timeScale().subscribeVisibleTimeRangeChange(range => { if (range && container.value) { container.value.dataset.rangeFrom = String(range.from); container.value.dataset.rangeTo = String(range.to) }; if (!range || suppress) return; clearTimeout(rangeTimer); rangeTimer = setTimeout(() => { if (!disposed) emit('range-change', { from: Number(range.from), to: Number(range.to) }) }, 250) })
      observer = new ResizeObserver(() => { chart?.applyOptions({ width: container.value.clientWidth, height: container.value.clientHeight }) }); observer.observe(container.value)
      update(); updatePosition()
    })
    watch(() => JSON.stringify(positionItems.value), () => { updatePosition(); update() })
    watch(() => props.rows, update)
    watch(() => props.timeline, update)
    watch(() => [props.start, props.end], update)
    watch(() => props.visibleRange, applyRange)
    watch(() => JSON.stringify(props.executions), update)
    watch(() => props.cursor, cursor => {
      if (!chart) return
      syncingCursor = true
      if (cursor) {
        const key = props.mode === 'bars' ? 'bars' : 'bid'
        const data = marketSeries(props.rows)[key]
        const point = data.reduce((best, row) => !best || Math.abs(row.time - cursor.time) < Math.abs(best.time - cursor.time) ? row : best, null)
        if (point) chart.setCrosshairPosition(point.value ?? point.close, point.time, series[key])
      } else chart.clearCrosshairPosition()
      syncingCursor = false
    })
    watch(fullscreen, () => nextTick(() => window.dispatchEvent(new Event('resize'))))
    onUnmounted(() => { disposed = true; window.removeEventListener('keydown', onKeyDown); clearTimeout(rangeTimer); observer?.disconnect(); chart?.remove(); chart = null })
    const tableRows = computed(() => props.rows.filter(row => !isOutOfSequenceTrade(row)).slice(-100).map((row, i) => ({ ...row, _key: row.sequence || row.id || i, kind: eventKind(row) })).reverse())
    const columns = [{ name: 'timestamp', label: 'Ora · Roma', field: 'timestamp', format: time }, { name: 'kind', label: 'Flusso', field: 'kind' }, ...[['bid_price', 'Bid'], ['ask_price', 'Ask'], ['price', 'Scambio'], ['close', 'Close']].map(([name, label]) => ({ name, label, field: name, format: number }))]
    return { positionItems, number, wrapper, container, fullscreen, visibility, visibleLegend, hover, hoverTime, fit, toggle, tableRows, columns }
  }
}
</script>
<style scoped>
.market-viewer { min-width: 0; background: white; }
.market-viewer__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.market-viewer__toolbar .q-chip { margin: 0; }
.market-viewer__tools { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.market-viewer__positions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.market-viewer__position { color: #7b1fa2; background: #f3e5f5; border: 1px dashed #8e24aa; border-radius: 4px; padding: 4px 8px; font-size: 12px; overflow-wrap: anywhere; max-width: 100%; }
.market-viewer__chart { width: 100%; }
.market-viewer--fullscreen { position: fixed; inset: 0; z-index: 6000; padding: 20px; overflow: auto; }
</style>
