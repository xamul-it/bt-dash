<template>
  <div>
    <div class="row q-gutter-md text-caption q-mb-sm" aria-live="polite">
      <strong>{{ legend.date }}</strong>
      <span>Equity {{ money(legend.equity) }}</span>
      <span>Drawdown {{ legend.drawdown == null ? '—' : `${legend.drawdown.toFixed(2)}%` }}</span>
    </div>
    <div ref="container" style="height: 420px" role="img" aria-label="Equity del conto e drawdown nel periodo" />
    <div v-if="selectedCount" class="text-caption text-grey-7 q-mt-sm" data-testid="marker-count">{{ markers.length }} movimenti marcati su {{ selectedCount }}. Clicca il grafico per il dettaglio.</div>
    <div v-if="selectedCount > markers.length" class="text-caption text-orange-9">{{ selectedCount - markers.length }} movimenti fuori dalla copertura equity.</div>
    <div v-for="event in events" :key="event.id" class="text-caption q-mt-xs" :style="{ color: event.color }">{{ event.fill.symbol }} #{{ event.cycle }} · {{ event.action }} · {{ date(Date.parse(event.fill.timestamp) / 1000) }} · {{ event.fill.qty }} @ {{ money(event.fill.price) }}</div>
    <div v-if="!stats.series.length" class="text-grey-7 q-pa-md">Nessun campione equity disponibile nel periodo.</div>
    <div class="text-caption text-grey-7 q-mt-sm">Equity sopra · drawdown sotto · sessioni dal calendario di trading locale · orari America/New_York · <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView</a></div>
  </div>
</template>
<script>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createChart, LineSeries, HistogramSeries, PriceScaleMode, createSeriesMarkers } from 'lightweight-charts'
import { equityStatistics, executionMarkers, positionCycles } from '../utils/portfolioDashboard.mjs'
import { sessionBoundaries, sessionLines, sessionShading } from '../utils/portfolioSessions.mjs'
export default {
  props: { points: { type: Array, default: () => [] }, calendar: { type: Object, default: () => ({}) }, logarithmic: Boolean, timeframe: { type: String, default: '5Min' }, currency: { type: String, default: 'USD' }, fills: { type: Array, default: () => [] }, selectedSymbols: { type: Array, default: () => [] }, orders: { type: Array, default: () => [] }, openingQuantities: { type: Object, default: () => ({}) }, cyclesReady: { type: Boolean, default: true } },
  setup(props) {
    const container = ref(null)
    const legend = ref({})
    const stats = computed(() => equityStatistics(props.points))
    const markers = computed(() => props.cyclesReady ? executionMarkers(props.points, props.fills, props.selectedSymbols, props.orders, props.timeframe, props.openingQuantities) : [])
    const events = ref([])
    const selectedCount = computed(() => props.cyclesReady ? positionCycles(props.fills, props.openingQuantities).filter(fill => props.selectedSymbols.includes(fill.symbol)).length : 0)
    let chart, observer, markerPlugin
    const money = value => value == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: props.currency }).format(value)
    const date = time => new Intl.DateTimeFormat('it-IT', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' }).format(new Date(time * 1000))
    const render = async () => {
      await nextTick()
      if (!container.value?.clientWidth) return
      markerPlugin?.detach(); markerPlugin = null
      if (chart) chart.remove()
      events.value = []
      chart = createChart(container.value, { width: container.value.clientWidth, height: 420,
        layout: { background: { color: '#ffffff' }, textColor: '#475569' },
        grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
        localization: { timeFormatter: date }, timeScale: { timeVisible: true, secondsVisible: false,
          tickMarkFormatter: (time, type) => new Intl.DateTimeFormat('it-IT', { timeZone: 'America/New_York', ...(type <= 2 ? { day: '2-digit', month: '2-digit' } : { hour: '2-digit', minute: '2-digit' }) }).format(new Date(time * 1000)) }, rightPriceScale: { borderVisible: false } })
      const equity = chart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 2, priceFormat: { type: 'price', precision: 2, minMove: .01 } })
      equity.setData(stats.value.series)
      markerPlugin = createSeriesMarkers(equity, markers.value.map(({ action, cycle, fill, ...marker }) => marker))
      equity.priceScale().applyOptions({ mode: props.logarithmic && stats.value.series.every(p => p.value > 0) ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal })
      const dd = chart.addSeries(HistogramSeries, { color: '#ef9a9a', priceFormat: { type: 'custom', formatter: v => `${v.toFixed(2)}%` } }, 1)
      dd.setData(stats.value.drawdown)
      const boundaries = sessionBoundaries(stats.value.series, props.timeframe, props.calendar)
      const sessions = sessionShading(stats.value.series, props.timeframe, props.calendar)
      equity.attachPrimitive(sessionLines(chart, boundaries, true, sessions))
      dd.attachPrimitive(sessionLines(chart, boundaries, false, sessions))
      dd.priceScale().applyOptions({ mode: PriceScaleMode.Normal })
      chart.panes()[1]?.setHeight(100)
      const update = (time, e, d) => { legend.value = { date: date(time), equity: e, drawdown: d } }
      const last = stats.value.series.at(-1)
      if (last) update(last.time, last.value, stats.value.drawdown.at(-1).value)
      else legend.value = {}
      chart.subscribeCrosshairMove(param => {
        const e = param.seriesData.get(equity)
        if (e && typeof param.time === 'number') update(param.time, e.value, param.seriesData.get(dd)?.value)
      })
      chart.subscribeClick(param => {
        events.value = typeof param.time === 'number' ? markers.value.filter(marker => marker.time === param.time) : []
      })
      chart.timeScale().fitContent()
    }
    onMounted(() => {
      observer = new ResizeObserver(() => {
        if (chart && container.value?.clientWidth) chart.applyOptions({ width: container.value.clientWidth })
        else render()
      })
      observer.observe(container.value)
      render()
    })
    watch([stats, markers, () => props.logarithmic, () => props.currency, () => props.timeframe, () => props.calendar], render)
    onBeforeUnmount(() => { observer?.disconnect(); markerPlugin?.detach(); chart?.remove(); chart = null })
    return { container, legend, stats, money, markers, events, selectedCount, date }
  }
}
</script>
