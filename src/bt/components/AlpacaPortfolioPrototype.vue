<template>
  <div class="q-pa-md">
    <q-banner v-if="error" class="bg-red-1 text-red-10 q-mb-md">
      {{ error }}
    </q-banner>
    <q-banner v-if="cacheSummary" class="bg-blue-1 text-blue-10 q-mb-md">
      {{ cacheSummary }}
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
      <q-card-section>
        <div class="text-subtitle1">Posizioni correnti</div>
        <q-table
          :rows="portfolioRows"
          :columns="positionColumns"
          row-key="symbol"
          dense
          flat
          bordered
          :pagination="{ rowsPerPage: 10 }"
        />
      </q-card-section>
    </q-card>

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
        <div class="col-12 col-md-2">
          <q-input
            v-model="dateStart"
            dense
            outlined
            type="date"
            label="Start date"
            :disable="selectedPeriod !== 'CUSTOM'"
          />
        </div>
        <div class="col-12 col-md-2">
          <q-input
            v-model="dateEnd"
            dense
            outlined
            type="date"
            label="End date"
            :disable="selectedPeriod !== 'CUSTOM'"
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
            clearable
            emit-value
            map-options
            option-label="label"
            option-value="value"
          />
          <div class="text-caption text-grey-7 q-mt-xs">
            Nessun asset selezionato = mostra tutti i trade del range.
          </div>
        </div>
        <div class="col-12 col-md-2">
          <q-select
            v-model="intradayReporting"
            :options="intradayReportingOptions"
            label="Session view"
            dense
            outlined
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-2">
          <q-btn color="primary" label="Refresh" @click="loadAll" :loading="loading" />
        </div>
        <div class="col-12">
          <div class="text-caption text-grey-7">
            `Range` e date sono sincronizzati: scegli un preset oppure usa `Custom` per impostare le date manualmente.
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Equity nel range selezionato + overlay trade</div>
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
        <div v-if="hasIntradayResolution" ref="cyclicChartEl" style="height: 300px"></div>
        <div v-else class="text-caption text-grey-7">
          La ciclicità intraday è disponibile solo quando il timeframe risultante è intraday (`1Min`, `5Min`, `15Min`, `1H`).
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mt-md">
      <q-card-section>
        <div class="text-subtitle1 q-mb-md">Driver PnL nel range</div>
        <q-table
          :rows="pnlDriverRows"
          :columns="pnlDriverColumns"
          row-key="symbol"
          dense
          flat
          bordered
          :pagination="{ rowsPerPage: 10 }"
        />
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
    const historyCache = ref({})
    const activitiesCache = ref({})
    const activeTimeframe = ref(PERIOD_TO_TIMEFRAME['1D'])

    const selectedPeriod = ref('1D')
    const selectedSymbols = ref([])
    const selectedMinuteIndex = ref(0)
    const dateStart = ref('')
    const dateEnd = ref('')
    const intradayReporting = ref('market_hours')
    const timeDisplayZone = ref('America/New_York')

    const dailyChartEl = ref(null)
    const cyclicChartEl = ref(null)
    const dailyChart = ref(null)
    const cyclicChart = ref(null)

    const periodOptions = [
      { label: '1 Day', value: '1D' },
      { label: '1 Week', value: '1W' },
      { label: '1 Month', value: '1M' },
      { label: 'Custom', value: 'CUSTOM' }
    ]

    const intradayReportingOptions = [
      { label: 'Trading hours', value: 'market_hours' },
      { label: 'Extended hours', value: 'extended_hours' },
      { label: 'All hours', value: 'continuous' }
    ]

    const compositionColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left' },
      { name: 'qty', label: 'Qty', field: 'qty', align: 'right' },
      { name: 'weight', label: 'Weight %', field: 'weight', align: 'right' },
      { name: 'estimated_market_value', label: 'Est. Market Value', field: 'estimated_market_value', align: 'right' }
    ]

    const pnlDriverColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left' },
      { name: 'fills', label: 'Fills', field: 'fills', align: 'right' },
      { name: 'buys', label: 'Buys', field: 'buys', align: 'right' },
      { name: 'sells', label: 'Sells', field: 'sells', align: 'right' },
      { name: 'buy_notional', label: 'Buy Notional', field: 'buy_notional', align: 'right' },
      { name: 'sell_notional', label: 'Sell Notional', field: 'sell_notional', align: 'right' },
      { name: 'net_cash_flow', label: 'Net Cash Flow', field: 'net_cash_flow', align: 'right' },
      { name: 'last_fill', label: 'Last Fill', field: 'last_fill', align: 'left' }
    ]

    const positionColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left' },
      { name: 'side', label: 'Side', field: 'side', align: 'left' },
      { name: 'qty', label: 'Qty', field: 'qty', align: 'right' },
      { name: 'avg_entry_price', label: 'Avg Entry', field: 'avg_entry_price', align: 'right' },
      { name: 'current_price', label: 'Current', field: 'current_price', align: 'right' },
      { name: 'market_value', label: 'Market Value', field: 'market_value', align: 'right' },
      { name: 'unrealized_pl', label: 'Unrealized PnL', field: 'unrealized_pl', align: 'right' }
    ]

    const toNum = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : 0
    }

    const formatUSD = (value) => new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 2
    }).format(toNum(value))

    const toIsoDateBoundary = (value, boundary) => {
      if (!value) return null
      return boundary === 'start'
        ? `${value}T00:00:00Z`
        : `${value}T23:59:59Z`
    }

    const hasCustomRange = computed(() => (
      selectedPeriod.value === 'CUSTOM' &&
      Boolean(dateStart.value && dateEnd.value)
    ))

    const formatDay = (date) => {
      const year = date.getUTCFullYear()
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const shiftUtcDays = (date, days) => {
      const shifted = new Date(date)
      shifted.setUTCDate(shifted.getUTCDate() + days)
      return shifted
    }

    const syncDatesWithPreset = (period) => {
      if (period === 'CUSTOM') return
      const today = new Date()
      const end = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      ))
      let start = end
      if (period === '1D') start = end
      if (period === '1W') start = shiftUtcDays(end, -6)
      if (period === '1M') start = shiftUtcDays(end, -29)
      dateStart.value = formatDay(start)
      dateEnd.value = formatDay(end)
    }

    const formatChartTs = (value) => {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value || '')
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timeDisplayZone.value,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date)
    }

    const shortChartTs = (value) => {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value || '')
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timeDisplayZone.value,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date).replace(',', '')
    }

    const resolveTimeframe = () => {
      if (!hasCustomRange.value) {
        return PERIOD_TO_TIMEFRAME[selectedPeriod.value] || '1Min'
      }

      const start = new Date(`${dateStart.value}T00:00:00Z`)
      const end = new Date(`${dateEnd.value}T23:59:59Z`)
      const diffDays = Math.max(1, Math.ceil((end - start) / 86400000))

      if (diffDays <= 2) return '1Min'
      if (diffDays <= 7) return '5Min'
      if (diffDays <= 30) return '15Min'
      return '1D'
    }

    const hasIntradayResolution = computed(() => activeTimeframe.value !== '1D')

    const findNearestPoint = (timestamp) => {
      if (!historyPoints.value.length || !timestamp) return null
      const target = new Date(timestamp).getTime()
      let best = historyPoints.value[0]
      let bestDiff = Math.abs(new Date(best.timestamp).getTime() - target)
      for (const point of historyPoints.value) {
        const diff = Math.abs(new Date(point.timestamp).getTime() - target)
        if (diff < bestDiff) {
          best = point
          bestDiff = diff
        }
      }
      return best
    }

    const symbolOptions = computed(() => {
      const fromPortfolio = portfolio.value.map((p) => p.symbol)
      const fromActivities = activities.value.map((a) => a.symbol).filter(Boolean)
      const unique = [...new Set([...fromPortfolio, ...fromActivities])].sort()
      return unique.map((sym) => ({ label: sym, value: sym }))
    })

    const cacheSummary = computed(() => {
      const historyMode = historyCache.value?.mode
      const historyUpdated = historyCache.value?.updated_at
      const activityMode = activitiesCache.value?.mode
      const activityUpdated = activitiesCache.value?.updated_at

      if (!historyMode && !activityMode) return ''

      const chunks = []
      if (historyMode) {
        chunks.push(`History: ${historyMode}${historyUpdated ? ` (${historyUpdated})` : ''}`)
      }
      if (activityMode) {
        chunks.push(`Activities: ${activityMode}${activityUpdated ? ` (${activityUpdated})` : ''}`)
      }
      return chunks.join(' | ')
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
      { label: 'Start Equity', value: formatUSD(historyPoints.value[0]?.equity) },
      { label: 'End Equity', value: formatUSD(historyPoints.value[historyPoints.value.length - 1]?.equity) },
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

    const portfolioRows = computed(() => (
      portfolio.value.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        qty: toNum(p.qty),
        avg_entry_price: formatUSD(p.avg_entry_price),
        current_price: formatUSD(p.current_price),
        market_value: formatUSD(p.market_value),
        unrealized_pl: formatUSD(p.unrealized_pl)
      }))
    ))

    const fetchPortfolio = async () => {
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/al/portfolio`)
      portfolio.value = response.data.positions || []
      account.value = response.data.account || {}
    }

    const filteredActivities = computed(() => {
      if (!selectedSymbols.value.length) return activities.value
      const allowed = new Set(selectedSymbols.value)
      return activities.value.filter((activity) => allowed.has(activity.symbol))
    })

    const pnlDriverRows = computed(() => {
      const bySymbol = {}
      filteredActivities.value.forEach((activity) => {
        const symbol = activity.symbol || 'N/A'
        bySymbol[symbol] = bySymbol[symbol] || {
          symbol,
          fills: 0,
          buys: 0,
          sells: 0,
          buy_notional_raw: 0,
          sell_notional_raw: 0,
          last_fill: ''
        }

        const row = bySymbol[symbol]
        const side = String(activity.side || '').toLowerCase()
        const qty = toNum(activity.qty)
        const price = toNum(activity.price)
        const notional = toNum(activity.notional) || qty * price

        row.fills += 1
        if (side === 'buy') {
          row.buys += 1
          row.buy_notional_raw += Math.abs(notional)
        } else if (side === 'sell' || side === 'sell_short') {
          row.sells += 1
          row.sell_notional_raw += Math.abs(notional)
        }

        if (activity.timestamp && (!row.last_fill || activity.timestamp > row.last_fill)) {
          row.last_fill = activity.timestamp
        }
      })

      return Object.values(bySymbol)
        .sort((a, b) => Math.abs((b.sell_notional_raw - b.buy_notional_raw)) - Math.abs((a.sell_notional_raw - a.buy_notional_raw)))
        .map((row) => ({
          symbol: row.symbol,
          fills: row.fills,
          buys: row.buys,
          sells: row.sells,
          buy_notional: formatUSD(row.buy_notional_raw),
          sell_notional: formatUSD(row.sell_notional_raw),
          net_cash_flow: formatUSD(row.sell_notional_raw - row.buy_notional_raw),
          last_fill: row.last_fill || 'N/A'
        }))
    })

    const estimatedOvernightPoints = computed(() => {
      if (!activities.value.length || !historyPoints.value.length) return []

      const sortedActivities = [...activities.value]
        .filter((activity) => activity.timestamp && activity.symbol)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

      const qtyBySymbol = {}
      const overnightByDate = {}

      sortedActivities.forEach((activity) => {
        const symbol = activity.symbol
        const side = String(activity.side || '').toLowerCase()
        const qty = toNum(activity.qty)
        const signedQty = ['sell', 'sell_short'].includes(side) ? -qty : qty
        qtyBySymbol[symbol] = (qtyBySymbol[symbol] || 0) + signedQty

        const timestamp = new Date(activity.timestamp)
        if (Number.isNaN(timestamp.getTime())) return
        const nextDay = new Date(Date.UTC(
          timestamp.getUTCFullYear(),
          timestamp.getUTCMonth(),
          timestamp.getUTCDate() + 1,
          0, 0, 0
        ))

        const openSymbols = Object.keys(qtyBySymbol)
          .filter((key) => Math.abs(qtyBySymbol[key]) > 0.000001)
          .sort()

        if (openSymbols.length) {
          const dayKey = nextDay.toISOString().slice(0, 10)
          overnightByDate[dayKey] = openSymbols
        }
      })

      return Object.entries(overnightByDate)
        .map(([dayKey, symbols]) => {
          const targetPrefix = `${dayKey}T`
          const point = historyPoints.value.find((row) => row.timestamp.startsWith(targetPrefix)) || historyPoints.value.find((row) => row.timestamp.slice(0, 10) === dayKey)
          if (!point) return null
          return {
            timestamp: point.timestamp,
            equity: toNum(point.equity),
            symbols
          }
        })
        .filter(Boolean)
    })

    const groupTradeMarkers = (items, sideMatcher, baselineEquity) => {
      const grouped = new Map()

      items
        .filter((activity) => sideMatcher((activity.side || '').toLowerCase()))
        .forEach((activity) => {
          const nearest = findNearestPoint(activity.timestamp)
          if (!nearest) return
          const index = historyPoints.value.findIndex((point) => point.timestamp === nearest.timestamp)
          if (index < 0) return

          const key = `${index}`
          const current = grouped.get(key) || {
            index,
            equity: toNum(nearest.equity),
            timestamp: nearest.timestamp,
            symbols: new Set(),
            fills: [],
            pnlDelta: toNum(nearest.equity) - baselineEquity
          }

          current.symbols.add(activity.symbol)
          current.fills.push(activity)
          grouped.set(key, current)
        })

      return [...grouped.values()]
        .sort((a, b) => a.index - b.index)
        .map((entry) => ([
          entry.index,
          entry.equity,
          [...entry.symbols].sort().join(', '),
          entry.timestamp,
          entry.fills.length,
          entry.fills.map((fill) => `${String(fill.side || '').toUpperCase()} ${fill.symbol} ${formatUSD(fill.price)} x ${toNum(fill.qty)}`).join('<br/>'),
          entry.pnlDelta
        ]))
    }

    const fetchHistory = async () => {
      const timeframe = resolveTimeframe()
      activeTimeframe.value = timeframe
      const params = {
        timeframe,
        intraday_reporting: intradayReporting.value,
        pnl_reset: timeframe === '1D' ? 'no_reset' : 'per_day',
        extended_hours: intradayReporting.value !== 'market_hours',
        prefer_cache: false
      }

      if (hasCustomRange.value) {
        params.start = toIsoDateBoundary(dateStart.value, 'start')
        params.end = toIsoDateBoundary(dateEnd.value, 'end')
      } else {
        params.period = selectedPeriod.value
      }

      const response = await axios.get(`${constants.API_BASE_URL}/dyn/al/portfolio-history`, {
        params
      })

      historyPoints.value = response.data.points || []
      historyCache.value = response.data.cache || {}
      activeTimeframe.value = response.data.timeframe || timeframe
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
          page_size: 100,
          fetch_all: true,
          max_pages: 50,
          prefer_cache: false
        }
      })

      activities.value = response.data.activities || []
      activitiesCache.value = response.data.cache || {}
    }

    const drawDailyChart = async () => {
      await nextTick()
      if (!dailyChartEl.value || !window.echarts) return

      if (!dailyChart.value) {
        dailyChart.value = window.echarts.init(dailyChartEl.value, 'light')
      }

      const baselineEquity = historyPoints.value.length ? toNum(historyPoints.value[0].equity) : 0
      const axisLabels = historyPoints.value.map((p) => p.timestamp)
      const equitySeries = historyPoints.value.map((p, idx) => [idx, toNum(p.equity), p.timestamp, toNum(p.equity) - baselineEquity])
      const overnightPoints = estimatedOvernightPoints.value
        .map((point) => {
          const index = historyPoints.value.findIndex((row) => row.timestamp === point.timestamp)
          if (index < 0) return null
          return [index, point.equity, point.symbols.join(', '), point.timestamp]
        })
        .filter(Boolean)
      const overnightMarkLines = overnightPoints.map((point) => ({
        xAxis: point[0],
        lineStyle: {
          color: '#1565c0',
          type: 'dashed',
          width: 1.5
        },
        label: {
          show: false
        }
      }))

      const buyPoints = groupTradeMarkers(
        filteredActivities.value,
        (side) => side === 'buy',
        baselineEquity
      )

      const sellPoints = groupTradeMarkers(
        filteredActivities.value,
        (side) => ['sell', 'sell_short'].includes(side),
        baselineEquity
      )

      const equityValues = equitySeries.map((row) => row[1])
      const minEquity = equityValues.length ? Math.min(...equityValues) : 0
      const maxEquity = equityValues.length ? Math.max(...equityValues) : 1
      const padding = Math.max(10, (maxEquity - minEquity) * 0.05 || 10)

      dailyChart.value.setOption({
        animation: false,
        tooltip: {
          trigger: 'axis',
          formatter: (params) => {
            const rows = Array.isArray(params) ? params : [params]
            if (!rows.length) return ''
            const timestamp = rows[0]?.data?.[2] || rows[0]?.axisValueLabel || ''
            const parts = [formatChartTs(timestamp)]
            rows.forEach((row) => {
              if (row.seriesName === 'Equity') {
                parts.push(`Equity: ${formatUSD(row.data?.[1] ?? row.value?.[1] ?? 0)}`)
                parts.push(`PnL from range start: ${formatUSD(row.data?.[3] ?? row.value?.[3] ?? 0)}`)
              }
            })
            return parts.join('<br/>')
          }
        },
        legend: { data: ['Equity', 'Buy', 'Sell', 'Overnight'] },
        xAxis: {
          type: 'category',
          data: axisLabels,
          boundaryGap: false,
          axisLabel: {
            formatter: (value) => shortChartTs(value)
          }
        },
        yAxis: {
          type: 'value',
          scale: true,
          min: minEquity - padding,
          max: maxEquity + padding,
          axisLabel: {
            formatter: (value) => formatUSD(value)
          }
        },
        series: [
          {
            name: 'Equity',
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: equitySeries,
            lineStyle: { width: 2 },
            markLine: {
              symbol: ['none', 'none'],
              silent: true,
              data: overnightMarkLines
            }
          },
          {
            name: 'Buy',
            type: 'scatter',
            data: buyPoints,
            symbolSize: (value) => Math.min(24, 8 + (value?.[4] || 1) * 3),
            itemStyle: { color: '#2e7d32' },
            z: 8,
            zlevel: 1,
            tooltip: {
              trigger: 'item',
              formatter: (params) => `BUY<br/>${formatChartTs(params.data[3])}<br/>Symbols: ${params.data[2]}<br/>Fills: ${params.data[4]}<br/>${params.data[5]}<br/>Equity: ${formatUSD(params.data[1])}<br/>PnL from range start: ${formatUSD(params.data[6])}`
            }
          },
          {
            name: 'Sell',
            type: 'scatter',
            data: sellPoints,
            symbolSize: (value) => Math.min(24, 8 + (value?.[4] || 1) * 3),
            itemStyle: { color: '#c62828' },
            z: 8,
            zlevel: 1,
            tooltip: {
              trigger: 'item',
              formatter: (params) => `SELL<br/>${formatChartTs(params.data[3])}<br/>Symbols: ${params.data[2]}<br/>Fills: ${params.data[4]}<br/>${params.data[5]}<br/>Equity: ${formatUSD(params.data[1])}<br/>PnL from range start: ${formatUSD(params.data[6])}`
            }
          },
          {
            name: 'Overnight',
            type: 'scatter',
            data: overnightPoints,
            symbol: 'roundRect',
            symbolSize: (value) => {
              const text = String(value?.[2] || '')
              return [Math.min(220, Math.max(70, text.length * 7)), 28]
            },
            itemStyle: { color: '#1565c0', borderColor: '#0d47a1', borderWidth: 1 },
            z: 10,
            zlevel: 2,
            label: {
              show: true,
              color: '#fff',
              fontSize: 10,
              overflow: 'truncate',
              width: 200,
              formatter: (params) => params.data[2]
            },
            tooltip: {
              trigger: 'item',
              formatter: (params) => `Overnight<br/>${formatChartTs(params.data[3])}<br/>Symbols: ${params.data[2]}`
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
      if (!hasIntradayResolution.value) return
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
        if (dateStart.value && dateEnd.value && dateStart.value > dateEnd.value) {
          throw new Error('Start date must be before end date')
        }

        await fetchPortfolio()
        await fetchHistory()
        try {
          await fetchActivities()
        } catch (err) {
          const backendError = err?.response?.data?.error
          error.value = backendError || err.message || 'Activities unavailable'
        }
        selectedSymbols.value = selectedSymbols.value.filter((symbol) =>
          symbolOptions.value.some((option) => option.value === symbol)
        )
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
      syncDatesWithPreset(selectedPeriod.value)
      await loadAll()
    })

    watch(intradayReporting, async () => {
      await loadAll()
    })

    watch([dateStart, dateEnd], async () => {
      if (selectedPeriod.value !== 'CUSTOM') return
      if (!dateStart.value || !dateEnd.value) return
      await loadAll()
    })

    watch(selectedSymbols, async () => {
      await drawDailyChart()
    }, { deep: true })

    onMounted(async () => {
      syncDatesWithPreset(selectedPeriod.value)
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
      dateStart,
      dateEnd,
      selectedSymbols,
      symbolOptions,
      intradayReporting,
      intradayReportingOptions,
      selectedMinuteIndex,
      selectedPointLabel,
      cacheSummary,
      hasIntradayResolution,
      metricCards,
      compositionRows,
      compositionColumns,
      portfolioRows,
      positionColumns,
      pnlDriverRows,
      pnlDriverColumns,
      historyPoints,
      dailyChartEl,
      cyclicChartEl,
      loadAll
    }
  }
}
</script>
