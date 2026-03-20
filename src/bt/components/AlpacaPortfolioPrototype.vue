<template>
  <div class="q-pa-md">
    <q-banner v-if="error" class="bg-red-1 text-red-10 q-mb-md">
      {{ error }}
    </q-banner>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6 col-md-3" v-for="card in metricCards" :key="card.label">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey-7">{{ card.label }}</div>
            <div class="text-h6">{{ card.value }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-md-2">
          <q-select
            v-model="selectedPeriod"
            :options="periodOptions"
            label="Range"
            dense
            outlined
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="selectedSymbols"
            :options="symbolOptions"
            label="Asset overlay"
            dense
            outlined
            use-chips
            multiple
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-2">
          <q-input dense outlined label="Timezone" value="UTC" readonly />
        </div>
        <div class="col-12 col-md-2">
          <q-btn color="primary" label="Refresh" @click="loadAll" :loading="loading" />
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Valore complessivo portafoglio (equity) + overlay trade</div>
        <div ref="dailyChartEl" style="height: 360px"></div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md" v-if="historyPoints.length">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Drill-down minuto e composizione portafoglio</div>
        <q-slider
          v-model="selectedMinuteIndex"
          :min="0"
          :max="historyPoints.length - 1"
          :step="1"
          label
          :label-value="selectedPointLabel"
        />
        <div class="text-caption text-grey-7 q-mt-sm">
          Composizione stimata dal peso corrente delle posizioni, ricalibrata sull'equity selezionata.
        </div>
        <q-table
          class="q-mt-md"
          :rows="compositionRows"
          :columns="compositionColumns"
          row-key="symbol"
          dense
          flat
          bordered
          :pagination="{ rowsPerPage: 10 }"
        />
      </q-card-section>
    </q-card>

    <q-card flat bordered>
      <q-card-section>
        <div class="text-subtitle1">Ciclicità intraday (media cumulata per minuto UTC)</div>
        <div ref="cyclicChartEl" style="height: 300px"></div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'

const PERIOD_TO_TIMEFRAME = {
  '1D': '1Min',
  '1W': '5Min',
  '1M': '15Min'
}

export default {
  name: 'AlpacaPortfolioPrototype',
  setup() {
    const loading = ref(false)
    const error = ref('')

    const portfolio = ref([])
    const account = ref({})
    const historyPoints = ref([])
    const activities = ref([])

    const selectedPeriod = ref('1D')
    const selectedSymbols = ref([])
    const selectedMinuteIndex = ref(0)

    const dailyChartEl = ref(null)
    const cyclicChartEl = ref(null)
    const dailyChart = ref(null)
    const cyclicChart = ref(null)

    const periodOptions = [
      { label: '1 Day', value: '1D' },
      { label: '1 Week', value: '1W' },
      { label: '1 Month', value: '1M' }
    ]

    const compositionColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left' },
      { name: 'qty', label: 'Qty', field: 'qty', align: 'right' },
      { name: 'weight', label: 'Weight %', field: 'weight', align: 'right' },
      { name: 'estimated_market_value', label: 'Est. Market Value', field: 'estimated_market_value', align: 'right' }
    ]

    const toNum = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : 0
    }

    const formatUSD = (value) => new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 2
    }).format(toNum(value))

    const symbolOptions = computed(() => {
      const fromPortfolio = portfolio.value.map((p) => p.symbol)
      const fromActivities = activities.value.map((a) => a.symbol).filter(Boolean)
      const unique = [...new Set([...fromPortfolio, ...fromActivities])].sort()
      return unique.map((sym) => ({ label: sym, value: sym }))
    })

    const selectedPoint = computed(() => historyPoints.value[selectedMinuteIndex.value] || null)

    const selectedPointLabel = computed(() => {
      if (!selectedPoint.value) return 'N/A'
      return selectedPoint.value.timestamp
    })

    const metrics = computed(() => {
      if (!historyPoints.value.length) {
        return { pnlDay: 0, high: 0, low: 0, maxDrawdown: 0 }
      }

      const equities = historyPoints.value.map((p) => toNum(p.equity))
      const first = equities[0]
      const last = equities[equities.length - 1]
      const high = Math.max(...equities)
      const low = Math.min(...equities)

      let peak = equities[0]
      let maxDrawdown = 0
      for (const eq of equities) {
        peak = Math.max(peak, eq)
        if (peak > 0) {
          const drawdown = ((peak - eq) / peak) * 100
          maxDrawdown = Math.max(maxDrawdown, drawdown)
        }
      }

      return {
        pnlDay: last - first,
        high,
        low,
        maxDrawdown
      }
    })

    const metricCards = computed(() => [
      { label: 'PnL (range)', value: formatUSD(metrics.value.pnlDay) },
      { label: 'High', value: formatUSD(metrics.value.high) },
      { label: 'Low', value: formatUSD(metrics.value.low) },
      { label: 'Max Drawdown', value: `${metrics.value.maxDrawdown.toFixed(2)}%` }
    ])

    const compositionRows = computed(() => {
      if (!portfolio.value.length || !selectedPoint.value) return []

      const selectedEquity = toNum(selectedPoint.value.equity)
      const totalMarketValue = portfolio.value.reduce((sum, p) => sum + toNum(p.market_value), 0)
      if (!totalMarketValue) return []

      return portfolio.value.map((p) => {
        const weight = toNum(p.market_value) / totalMarketValue
        return {
          symbol: p.symbol,
          qty: toNum(p.qty),
          weight: (weight * 100).toFixed(2),
          estimated_market_value: formatUSD(selectedEquity * weight)
        }
      })
    })

    const fetchPortfolio = async () => {
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/al/portfolio`)
      portfolio.value = response.data.positions || []
      account.value = response.data.account || {}
    }

    const fetchHistory = async () => {
      const timeframe = PERIOD_TO_TIMEFRAME[selectedPeriod.value] || '1Min'
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/al/portfolio-history`, {
        params: {
          period: selectedPeriod.value,
          timeframe,
          intraday_reporting: 'market_hours',
          pnl_reset: 'per_day',
          extended_hours: false
        }
      })

      historyPoints.value = response.data.points || []
      if (historyPoints.value.length > 0) {
        selectedMinuteIndex.value = historyPoints.value.length - 1
      }
    }

    const fetchActivities = async () => {
      if (!historyPoints.value.length) {
        activities.value = []
        return
      }

      const firstTs = historyPoints.value[0].timestamp
      const lastTs = historyPoints.value[historyPoints.value.length - 1].timestamp

      const response = await axios.get(`${constants.API_BASE_URL}/dyn/al/activities`, {
        params: {
          activity_types: 'FILL',
          after: firstTs,
          until: lastTs,
          direction: 'asc',
          page_size: 200
        }
      })

      activities.value = response.data.activities || []
      if (!selectedSymbols.value.length && symbolOptions.value.length) {
        selectedSymbols.value = symbolOptions.value.slice(0, 3).map((s) => s.value)
      }
    }

    const drawDailyChart = async () => {
      await nextTick()
      if (!dailyChartEl.value || !window.echarts) return

      if (!dailyChart.value) {
        dailyChart.value = window.echarts.init(dailyChartEl.value, 'light')
      }

      const equitySeries = historyPoints.value.map((p) => [p.timestamp, toNum(p.equity)])

      const filteredActivities = activities.value.filter((a) => {
        if (!selectedSymbols.value.length) return true
        return selectedSymbols.value.includes(a.symbol)
      })

      const buyPoints = filteredActivities
        .filter((a) => (a.side || '').toLowerCase() === 'buy')
        .map((a) => [a.timestamp, toNum(a.price), a.symbol])

      const sellPoints = filteredActivities
        .filter((a) => (a.side || '').toLowerCase() === 'sell')
        .map((a) => [a.timestamp, toNum(a.price), a.symbol])

      dailyChart.value.setOption({
        animation: false,
        tooltip: { trigger: 'axis' },
        legend: { data: ['Equity', 'Buy', 'Sell'] },
        xAxis: { type: 'time' },
        yAxis: { type: 'value', scale: true },
        series: [
          {
            name: 'Equity',
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: equitySeries,
            lineStyle: { width: 2 }
          },
          {
            name: 'Buy',
            type: 'scatter',
            data: buyPoints,
            symbolSize: 8,
            itemStyle: { color: '#2e7d32' },
            tooltip: {
              trigger: 'item',
              formatter: (params) => `BUY ${params.data[2]}<br/>${params.data[0]}<br/>${formatUSD(params.data[1])}`
            }
          },
          {
            name: 'Sell',
            type: 'scatter',
            data: sellPoints,
            symbolSize: 8,
            itemStyle: { color: '#c62828' },
            tooltip: {
              trigger: 'item',
              formatter: (params) => `SELL ${params.data[2]}<br/>${params.data[0]}<br/>${formatUSD(params.data[1])}`
            }
          }
        ]
      })
    }

    const buildCyclicData = () => {
      if (!historyPoints.value.length) return []

      const groupsByDay = {}
      historyPoints.value.forEach((p) => {
        const dateKey = p.timestamp.slice(0, 10)
        groupsByDay[dateKey] = groupsByDay[dateKey] || []
        groupsByDay[dateKey].push(p)
      })

      const sumByMinute = {}
      const countByMinute = {}

      Object.values(groupsByDay).forEach((dayPoints) => {
        dayPoints.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        const base = toNum(dayPoints[0]?.equity)

        dayPoints.forEach((p) => {
          const minuteKey = p.timestamp.slice(11, 16)
          const cumulative = toNum(p.equity) - base
          sumByMinute[minuteKey] = (sumByMinute[minuteKey] || 0) + cumulative
          countByMinute[minuteKey] = (countByMinute[minuteKey] || 0) + 1
        })
      })

      return Object.keys(sumByMinute)
        .sort()
        .map((minuteKey) => [minuteKey, sumByMinute[minuteKey] / countByMinute[minuteKey]])
    }

    const drawCyclicChart = async () => {
      await nextTick()
      if (!cyclicChartEl.value || !window.echarts) return

      if (!cyclicChart.value) {
        cyclicChart.value = window.echarts.init(cyclicChartEl.value, 'light')
      }

      const data = buildCyclicData()
      cyclicChart.value.setOption({
        animation: false,
        tooltip: { trigger: 'axis' },
        xAxis: {
          type: 'category',
          data: data.map((d) => d[0]),
          axisLabel: { interval: 59 }
        },
        yAxis: { type: 'value', scale: true },
        series: [
          {
            name: 'Avg cumulative PnL by minute',
            type: 'line',
            showSymbol: false,
            data: data.map((d) => d[1]),
            areaStyle: { opacity: 0.12 }
          }
        ]
      })
    }

    const loadAll = async () => {
      loading.value = true
      error.value = ''
      try {
        await fetchPortfolio()
        await fetchHistory()
        await fetchActivities()
        await drawDailyChart()
        await drawCyclicChart()
      } catch (err) {
        const backendError = err?.response?.data?.error
        error.value = backendError || err.message || 'Error loading Alpaca portfolio prototype'
      } finally {
        loading.value = false
      }
    }

    watch(selectedPeriod, async () => {
      await loadAll()
    })

    watch(selectedSymbols, async () => {
      await drawDailyChart()
    })

    onMounted(async () => {
      await loadAll()
      window.addEventListener('resize', handleResize)
    })

    const handleResize = () => {
      if (dailyChart.value) dailyChart.value.resize()
      if (cyclicChart.value) cyclicChart.value.resize()
    }

    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize)
      if (dailyChart.value) {
        dailyChart.value.dispose()
      }
      if (cyclicChart.value) {
        cyclicChart.value.dispose()
      }
    })

    return {
      loading,
      error,
      selectedPeriod,
      periodOptions,
      selectedSymbols,
      symbolOptions,
      selectedMinuteIndex,
      selectedPointLabel,
      metricCards,
      compositionRows,
      compositionColumns,
      historyPoints,
      dailyChartEl,
      cyclicChartEl,
      loadAll
    }
  }
}
</script>
