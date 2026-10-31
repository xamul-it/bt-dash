<template>
  <div class="portfolio-dashboard q-pa-md">
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-12 col-md">
          <div class="text-h5">My portfolio</div>
          <div class="text-caption text-grey-7">Conto Alpaca · aggiornamento su richiesta</div>
        </div>
        <div class="col-12 col-sm-7 col-md-4">
          <q-select v-model="selectedContext" :options="contextOptions" label="Spazio Alpaca" outlined dense emit-value map-options :loading="contextsLoading" @update:model-value="changeContext" />
        </div>
        <div class="col-auto">
          <q-badge v-if="context" :color="context.paper ? 'blue-8' : 'red-8'" class="q-pa-sm">{{ context.paper ? 'PAPER' : 'REAL' }}</q-badge>
        </div>
        <div class="col-auto"><q-btn icon="refresh" label="Aggiorna" color="primary" :loading="loading" :disable="!selectedContext" @click="loadAll" /></div>
      </q-card-section>
      <q-card-section class="q-pt-none text-caption text-grey-7">
        {{ context?.display_name || 'Seleziona un conto' }}<span v-if="context" style="overflow-wrap: anywhere"> · {{ context.portfolio_key_id }}</span>
        <span v-if="updatedAt"> · Ultimo aggiornamento {{ dateTime(updatedAt) }}</span>
      </q-card-section>
    </q-card>
    <q-banner v-for="(message, index) in errors" :key="index" class="bg-red-1 text-red-10 q-mb-sm">{{ message }}</q-banner>
    <q-banner v-if="!contextsLoading && !contexts.length && !errors.length" class="bg-blue-1 q-mb-md">Nessun conto Alpaca attivo registrato.</q-banner>
    <template v-if="selectedContext">
      <div class="row q-col-gutter-sm q-mb-md">
        <div v-for="metric in metrics" :key="metric.label" class="col-6 col-md-3">
          <q-card flat bordered><q-card-section>
            <div class="text-caption text-grey-7">{{ metric.label }}</div>
            <div class="text-h6">{{ metric.value }}</div>
          </q-card-section></q-card>
        </div>
      </div>
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="row q-col-gutter-sm items-center">
          <div class="col-6 col-md-2"><q-select v-model="period" :options="periodOptions" label="Periodo" outlined dense emit-value map-options /></div>
          <div class="col-6 col-md-2"><q-select v-model="timeframe" :options="timeframeOptions" label="TF equity" outlined dense emit-value map-options /></div>
          <div class="col-12 col-md-3"><q-select v-model="session" :options="sessionOptions" label="Sessione" outlined dense emit-value map-options /></div>
          <div v-if="period === 'CUSTOM'" class="col-6 col-md-2"><q-input v-model="start" type="date" label="Dal (UTC)" outlined dense /></div>
          <div v-if="period === 'CUSTOM'" class="col-6 col-md-2"><q-input v-model="end" type="date" label="Al (UTC)" outlined dense /></div>
          <div class="col-auto"><q-btn label="Applica" color="primary" outline :loading="loading" :disable="!validRange" @click="loadAll" /></div>
          <div class="col-12 text-caption text-grey-7">{{ timeframeGuide }} Le selezioni valide aggiornano automaticamente il cruscotto.</div>
          <div v-if="filterMessage" class="col-12 text-caption text-orange-9">{{ filterMessage }}</div>
          <div v-if="!validRange" class="col-12 text-caption text-negative">Completa le date: la data finale deve essere successiva o uguale a quella iniziale.</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <div class="row q-col-gutter-sm q-mb-md">
            <div v-for="metric in periodMetrics" :key="metric.label" class="col-6 col-md-3">
              <q-card flat bordered><q-card-section>
                <div class="text-caption text-grey-7">{{ metric.label }} <q-icon name="info_outline" tabindex="0"><q-tooltip>{{ metric.help }}</q-tooltip></q-icon></div>
                <div class="text-h6">{{ metric.value }}</div>
              </q-card-section></q-card>
            </div>
          </div>
          <div class="row items-center"><div class="text-subtitle1 col">Andamento del conto</div><q-toggle v-model="logarithmic" label="Scala log" dense /></div>
          <div class="text-caption text-grey-7 q-mb-sm">{{ appliedLabel || 'Applica i filtri per caricare il periodo.' }}</div>
          <q-banner v-if="historyCache.mode && historyCache.mode !== 'remote+cached'" class="bg-amber-1 q-mb-sm">
            Storico da cache · {{ dateTime(historyCache.updated_at) }}. {{ historyCache.remote_error || '' }}
          </q-banner>
          <q-select v-model="selectedSymbols" :options="symbolOptions" label="Simboli sul grafico" multiple use-chips outlined dense class="q-my-md" />
          <div class="row items-center q-gutter-md text-caption q-mb-sm" aria-label="Legenda movimenti">
            <span>▲ Ingresso</span><span>▼ Uscita</span><span># = ciclo del simbolo · nuovo numero dopo il ritorno a posizione piatta</span>
          </div>
          <div class="row q-gutter-sm q-mb-sm"><q-chip v-for="item in symbolsLegend" :key="item.symbol" dense :style="{ color: item.color }">● {{ item.symbol }}</q-chip></div>
          <q-banner v-if="selectedSymbols.length && fillsTruncated" class="bg-amber-1 q-mb-sm">Marcatori parziali: limite eseguiti raggiunto.</q-banner>
          <div v-if="selectedSymbols.length && cycleStatus === 'loading'" class="text-caption text-grey-7 q-mb-sm"><q-spinner size="16px" /> Ricostruzione dei cicli di posizione…</div>
          <q-banner v-if="selectedSymbols.length && cycleError" class="bg-amber-1 q-mb-sm">{{ cycleError }}</q-banner>
          <PortfolioEquityChart :points="points" :logarithmic="logarithmic" :currency="currency" :fills="fills" :selected-symbols="selectedSymbols || []" :orders="orders" :timeframe="loadedTimeframe" :opening-quantities="openingQuantities" :cycles-ready="cycleStatus === 'ready'" />
          <q-expansion-item v-if="selectedSymbols?.length" label="Dettaglio ingressi e uscite" dense class="q-mt-md">
            <q-table :rows="selectedFills" :columns="cycleFillColumns" row-key="id" flat :pagination="{ rowsPerPage: 10 }" no-data-label="Nessun eseguito per i simboli selezionati nel periodo" />
          </q-expansion-item>
          <div class="text-caption text-grey-7 q-mt-md">Campioni equity del broker, non barre OHLC. Variazione e drawdown descrivono il valore del conto e possono risentire di versamenti e prelievi; non sono rendimenti depurati dai flussi.</div>
        </q-card-section>
      </q-card>
      <q-card flat bordered>
        <q-tabs v-model="tab" align="left" active-color="primary" inline-label outside-arrows mobile-arrows>
          <q-tab name="positions" label="Posizioni attuali" icon="account_balance_wallet" />
          <q-tab name="orders" label="Ordini" icon="receipt_long" />
          <q-tab name="fills" label="Eseguiti" icon="swap_horiz" />
          <q-tab name="analysis" label="Analisi" icon="analytics" />
        </q-tabs><q-separator />
        <q-card-section>
          <q-input v-if="tab !== 'analysis'" v-model="search" label="Cerca simbolo, stato o ID" dense outlined clearable class="q-mb-md" />
          <template v-if="tab === 'positions'">
            <div class="text-caption text-grey-7 q-mb-sm">Fotografia attuale del conto, indipendente dal periodo selezionato. Lo storico delle posizioni richiede la ricostruzione da eseguiti e movimenti.</div>
            <q-table :rows="positions" :columns="positionColumns" row-key="symbol" :filter="search" flat :loading="loading" :pagination="{ rowsPerPage: 15 }" no-data-label="Nessuna posizione disponibile" />
          </template>
          <template v-if="tab === 'orders'">
            <q-select v-model="orderStatus" :options="orderStatusOptions" label="Stato ordini" outlined dense emit-value map-options class="q-mb-md" style="max-width: 260px" />
            <div class="text-caption text-grey-7 q-mb-sm">Ordini aperti: tutti, anche precedenti al periodo. Storico: ordini inviati nel periodo applicato. Clicca una riga per il dettaglio.</div>
            <q-banner v-if="ordersTruncated" class="bg-amber-1 q-mb-sm">Sono presenti almeno 500 ordini: restringi il periodo per consultare lo storico completo.</q-banner>
            <q-table :rows="visibleOrders" :columns="orderColumns" row-key="id" :filter="search" flat :loading="loading" :pagination="{ rowsPerPage: 15, sortBy: 'submitted_at', descending: true }" no-data-label="Nessun ordine disponibile" @row-click="(_, row) => selectedOrder = row" />
          </template>
          <template v-if="tab === 'fills'">
            <q-banner v-if="activitiesCache.mode && activitiesCache.mode !== 'remote+cached'" class="bg-amber-1 q-mb-sm">Eseguiti da cache · {{ dateTime(activitiesCache.updated_at) }}</q-banner>
            <q-banner v-if="fillsTruncated" class="bg-amber-1 q-mb-sm">Elenco eseguiti incompleto: restringi il periodo. Anche le analisi usano questo sottoinsieme.</q-banner>
            <div class="text-caption text-grey-7 q-mb-sm">Ogni riga è un'esecuzione, anche parziale. Orari America/New_York.</div>
            <q-table :rows="fills" :columns="fillColumns" row-key="id" :filter="search" flat :loading="loading" :pagination="{ rowsPerPage: 15, sortBy: 'timestamp', descending: true }" no-data-label="Nessun eseguito disponibile" />
          </template>
          <template v-if="tab === 'analysis'">
            <div class="text-subtitle1">Attività per titolo nel periodo</div>
            <div class="text-caption text-grey-7 q-mb-md">Controvalori degli eseguiti caricati. Il saldo vendite − acquisti è un flusso di cassa, non un profitto realizzato.</div>
            <q-banner v-if="fillsTruncated" class="bg-amber-1 q-mb-sm">Analisi parziale: limite eseguiti raggiunto.</q-banner>
            <q-table :rows="analysisRows" :columns="analysisColumns" row-key="symbol" flat :pagination="{ rowsPerPage: 15 }" no-data-label="Nessun eseguito da analizzare" />
          </template>
        </q-card-section>
      </q-card>
    </template>
    <q-dialog :model-value="Boolean(selectedOrder)" @update:model-value="selectedOrder = null">
      <q-card v-if="selectedOrder" style="width: 760px; max-width: 95vw">
        <q-card-section class="row items-center"><div class="text-h6 col">{{ selectedOrder.symbol }} · {{ selectedOrder.side }} · {{ selectedOrder.status }}</div><q-btn icon="close" flat round dense v-close-popup /></q-card-section>
        <q-card-section class="q-pt-none">
          <div class="text-caption" style="overflow-wrap: anywhere">ID {{ selectedOrder.id }}<br />Client ID {{ selectedOrder.client_order_id }}</div>
          <div class="q-my-md">{{ selectedOrder.type }} · {{ selectedOrder.time_in_force }} · quantità {{ selectedOrder.qty }} · eseguita {{ selectedOrder.filled_qty }} · prezzo medio {{ money(selectedOrder.filled_avg_price) }}</div>
          <div v-if="selectedOrder.limit_price">Limite {{ money(selectedOrder.limit_price) }}</div>
          <div v-if="selectedOrder.stop_price">Stop {{ money(selectedOrder.stop_price) }}</div>
          <q-list dense bordered class="q-mt-md"><q-item v-for="event in orderEvents" :key="event.label"><q-item-section>{{ event.label }}</q-item-section><q-item-section side>{{ dateTime(event.time) }}</q-item-section></q-item></q-list>
          <div class="text-caption text-grey-7 q-mt-sm">Timestamp restituiti dal broker; non costituiscono un registro completo di tutte le transizioni.</div>
          <div v-if="selectedOrder.replaces || selectedOrder.replaced_by" class="q-mt-sm">Sostituisce {{ selectedOrder.replaces || '—' }} · sostituito da {{ selectedOrder.replaced_by || '—' }}</div>
          <div class="text-subtitle2 q-mt-md">Eseguiti associati nel periodo caricato</div>
          <div v-for="fill in orderFills" :key="fill.id">{{ dateTime(fill.timestamp) }} · {{ fill.qty }} @ {{ money(fill.price) }}</div>
          <div v-if="!orderFills.length" class="text-caption text-grey-7">Nessun eseguito caricato per questo ordine.</div>
          <div v-for="leg in selectedOrder.legs || []" :key="leg.id" class="q-mt-sm">Ordine collegato: {{ leg.symbol }} · {{ leg.side }} · {{ leg.status }} · {{ leg.id }}</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { api } from 'boot/axios'
import PortfolioEquityChart from './PortfolioEquityChart.vue'
import { periodIndicators, periodBounds, historyWindows, loadHistoryWindows, horizonDays, validTimeframes, validPeriods, TIMEFRAME_LIMITS, symbolLegend, positionCycles, openingPositions } from '../utils/portfolioDashboard.mjs'

export default {
  components: { PortfolioEquityChart },
  setup() {
    const contexts = ref([]), selectedContext = ref(''), contextsLoading = ref(true), loading = ref(false)
    const account = ref({}), positions = ref([]), points = ref([]), orders = ref([]), fills = ref([])
    const errors = ref([]), updatedAt = ref(''), appliedLabel = ref(''), historyCache = ref({}), activitiesCache = ref({})
    const ordersTruncated = ref(false), fillsTruncated = ref(false), selectedOrder = ref(null)
    const period = ref('1W'), timeframe = ref('5Min'), session = ref('extended_hours'), logarithmic = ref(true)
    const start = ref(''), end = ref(''), tab = ref('positions'), search = ref(''), orderStatus = ref('all')
    let requestVersion = 0, controller
    const context = computed(() => contexts.value.find(row => row.portfolio_key_id === selectedContext.value))
    const contextOptions = computed(() => contexts.value.map(row => ({ value: row.portfolio_key_id,
      label: `${row.profile && row.profile.toLowerCase() !== row.display_name.toLowerCase() ? `${row.profile} · ` : ''}${row.display_name} · ${row.paper ? 'Paper' : 'Real'}` })))
    const currency = computed(() => account.value.currency || 'USD')
    const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
    const money = value => number(value) == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: currency.value }).format(Number(value))
    const dateTime = value => !value || !Number.isFinite(Date.parse(value)) ? '—' : new Intl.DateTimeFormat('it-IT', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
    const loadedTimeframe = ref('5Min')
    const stats = computed(() => periodIndicators(points.value, loadedTimeframe.value))
    const periodOptions = computed(() => validPeriods(timeframe.value))
    const timeframeOptions = computed(() => validTimeframes(horizonDays(period.value, start.value, end.value)))
    const filterMessage = ref('')
    const validRange = computed(() => horizonDays(period.value, start.value, end.value) != null)
    const timeframeGuide = computed(() => Number.isFinite(TIMEFRAME_LIMITS[timeframe.value]) ? `${timeframe.value}: fino a ${TIMEFRAME_LIMITS[timeframe.value]} giorni. Per orizzonti più lunghi scegli prima 1D. I 30 giorni sono caricati a segmenti.` : '1D: storico giornaliero. I TF intraday compaiono per orizzonti fino a 30 giorni.')
    const selectedSymbols = ref([])
    const symbolOptions = computed(() => [...new Set([...positions.value.map(row => row.symbol), ...fills.value.map(row => row.symbol)])].sort())
    const symbolsLegend = computed(() => symbolLegend([...fills.value.map(row => row.symbol), ...selectedSymbols.value]).filter(row => selectedSymbols.value.includes(row.symbol)))
    const openingQuantities = ref({}), cycleStatus = ref('idle'), cycleError = ref('')
    let cycleController, cycleVersion = 0, loadedBounds = null
    const cycleLedger = new Map()
    const cycleFills = computed(() => cycleStatus.value === 'ready' ? positionCycles(fills.value, openingQuantities.value) : [])
    const selectedFills = computed(() => cycleFills.value.filter(row => selectedSymbols.value.includes(row.symbol)))
    const loadCycleBasis = async () => {
      if (!loadedBounds || !selectedSymbols.value.length || cycleStatus.value === 'loading') return
      if (fillsTruncated.value || activitiesCache.value.mode !== 'remote+cached') { cycleStatus.value = 'error'; cycleError.value = 'Eseguiti del periodo incompleti: restringi il periodo per numerare i cicli.'; return }
      const before = loadedBounds.after, contextKey = selectedContext.value
      const mergeLedger = (activities, through) => {
        const unique = new Map(activities.map(fill => [fill.id || `${fill.symbol}:${fill.timestamp}:${fill.side}:${fill.qty}`, fill]))
        cycleLedger.set(contextKey, { activities: [...unique.values()], through })
      }
      const cached = cycleLedger.get(contextKey)
      if (cached && Date.parse(before) <= Date.parse(cached.through)) {
        openingQuantities.value = openingPositions(cached.activities, before)
        mergeLedger([...cached.activities, ...fills.value], Date.parse(loadedBounds.until) > Date.parse(cached.through) ? loadedBounds.until : cached.through)
        cycleStatus.value = 'ready'; return
      }
      const version = ++cycleVersion
      cycleController?.abort(); cycleController = new AbortController()
      cycleStatus.value = 'loading'; cycleError.value = ''
      try {
        const response = await api.get('/dyn/al/activities', { params: { portfolio_key_id: contextKey,
          until: new Date(Date.parse(before) - 1).toISOString(), activity_types: 'FILL', direction: 'asc',
          page_size: 100, fetch_all: true, max_pages: 100, prefer_cache: false }, signal: cycleController.signal })
        if (version !== cycleVersion) return
        if (response.data.truncated || response.data.cache?.mode !== 'remote+cached') throw new Error('Storico precedente incompleto: numerazione dei cicli non disponibile.')
        openingQuantities.value = openingPositions(response.data.activities || [], before)
        mergeLedger([...(response.data.activities || []), ...fills.value], loadedBounds.until)
        cycleStatus.value = 'ready'
      } catch (error) {
        if (version !== cycleVersion) return
        cycleStatus.value = 'error'; cycleError.value = error?.response?.data?.error || error.message
      }
    }
    const percent = value => value == null ? '—' : `${value.toFixed(2)}%`
    const duration = value => value == null ? '—' : `${value.toFixed(2)} gg`
    const exposure = computed(() => positions.value.length ? positions.value.reduce((sum, row) => sum + Math.abs(Number(row.market_value) || 0), 0) : Object.keys(account.value).length ? 0 : null)
    const metrics = computed(() => [
      { label: 'Equity attuale', value: money(account.value.equity) },
      { label: 'Liquidità', value: money(account.value.cash) },
      { label: 'Buying power', value: money(account.value.buying_power) },
      { label: 'Esposizione lorda', value: money(exposure.value) },
      { label: 'P&L aperto', value: money(Object.keys(account.value).length ? positions.value.reduce((sum, row) => sum + (Number(row.unrealized_pl) || 0), 0) : null) },

      { label: 'Posizioni aperte', value: Object.keys(account.value).length ? positions.value.length : '—' }
    ])
    const periodMetrics = computed(() => [
      { label: 'P&L equity nel periodo', value: money(stats.value.pnl), help: 'Ultima equity meno prima equity del periodo. Include gli effetti di versamenti e prelievi; non è il P&L realizzato dei trade.' },
      { label: 'Variazione equity %', value: percent(stats.value.returnPct), help: 'Variazione rispetto alla prima equity caricata, senza correzione per flussi esterni.' },
      { label: 'DD massimo %', value: percent(stats.value.maxDrawdown), help: 'Peggiore discesa rispetto al massimo progressivo nel periodo; usa i campioni del TF caricato.' },
      { label: 'DD massimo in valuta', value: money(stats.value.maxDrawdownCash), help: 'Massima perdita di equity dal picco progressivo, in valuta del conto.' },
      { label: 'DD days · massimo', value: duration(stats.value.ddDays), help: 'Durata massima dal picco al recupero o all’ultimo campione per un episodio aperto. Giorni di calendario, weekend compresi; picco cercato nel periodo.' },
      { label: 'DD days · attuale', value: duration(stats.value.currentDdDays), help: 'Tempo dall’ultimo massimo raggiunto nel periodo all’ultimo campione, se ancora in drawdown. Giorni di calendario.' },
      { label: 'Media per giorno', value: money(stats.value.averageDay), help: `Media delle variazioni giornaliere sui ${stats.value.sessions} intervalli osservati (America/New_York). Intraday: primo giorno dal primo campione, ultimo giorno anche parziale; 1D: primo campione usato come base.` },
      { label: 'Media giornaliera %', value: percent(stats.value.averageDayPct), help: 'Media aritmetica delle variazioni percentuali giornaliere osservate; non annualizzata e non corretta per flussi esterni.' }
    ])
    const numericColumn = (name, label, monetary = false) => ({ name, label, field: row => number(row[name]), align: 'right', sortable: true, format: monetary ? money : value => value ?? '—' })
    const column = (name, label, format) => ({ name, label, field: name, align: 'left', sortable: true, ...(format ? { format } : {}) })
    const positionColumns = [column('symbol', 'Titolo'), column('side', 'Lato'), numericColumn('qty', 'Quantità'), numericColumn('avg_entry_price', 'Prezzo medio', true), numericColumn('current_price', 'Prezzo attuale', true), numericColumn('market_value', 'Valore', true), numericColumn('unrealized_pl', 'P&L aperto', true)]
    const orderColumns = [column('submitted_at', 'Inviato (New York)', dateTime), column('symbol', 'Titolo'), column('side', 'Lato'), column('type', 'Tipo'), column('status', 'Stato'), numericColumn('qty', 'Quantità'), numericColumn('filled_qty', 'Eseguita'), numericColumn('filled_avg_price', 'Prezzo medio', true), column('id', 'ID ordine')]
    const cycleFillColumns = [numericColumn('cycle', 'Ciclo'), column('action', 'Movimento'), numericColumn('position_after', 'Posizione dopo'), column('timestamp', 'Ora (New York)', dateTime), column('symbol', 'Titolo'), numericColumn('qty', 'Quantità'), numericColumn('price', 'Prezzo', true), column('order_id', 'ID ordine')]
    const fillColumns = [column('timestamp', 'Ora (New York)', dateTime), column('symbol', 'Titolo'), column('side', 'Lato'), numericColumn('qty', 'Quantità'), numericColumn('price', 'Prezzo', true), column('order_id', 'ID ordine')]
    const analysisColumns = [column('symbol', 'Titolo'), numericColumn('count', 'Eseguiti'), numericColumn('buy', 'Acquisti', true), numericColumn('sell', 'Vendite', true), numericColumn('net', 'Saldo di cassa', true)]
    const visibleOrders = computed(() => orders.value.filter(row => orderStatus.value === 'all' || (orderStatus.value === 'open' ? row._open : !row._open)))
    const analysisRows = computed(() => {
      const rows = new Map()
      fills.value.forEach(fill => {
        const row = rows.get(fill.symbol) || { symbol: fill.symbol, count: 0, buy: 0, sell: 0, net: 0 }
        const amount = Math.abs((Number(fill.qty) || 0) * (Number(fill.price) || 0))
        if (fill.side === 'buy') row.buy += amount
        else if (fill.side === 'sell' || fill.side === 'sell_short') row.sell += amount
        row.count++; row.net = row.sell - row.buy; rows.set(fill.symbol, row)
      })
      return [...rows.values()]
    })
    const orderFills = computed(() => fills.value.filter(fill => fill.order_id === selectedOrder.value?.id))
    const orderEvents = computed(() => Object.entries({ created_at: 'Creato', submitted_at: 'Inviato', updated_at: 'Aggiornato', filled_at: 'Eseguito', canceled_at: 'Cancellato', expired_at: 'Scaduto', failed_at: 'Fallito', replaced_at: 'Sostituito' })
      .filter(([key]) => selectedOrder.value?.[key]).map(([key, label]) => ({ label, time: selectedOrder.value[key] })).sort((a, b) => Date.parse(a.time) - Date.parse(b.time)))
    const reset = () => {
      cycleVersion++; cycleController?.abort(); cycleStatus.value = 'idle'; cycleError.value = ''; openingQuantities.value = {}; loadedBounds = null
      account.value = {}; positions.value = []; points.value = []; orders.value = []; fills.value = []
      errors.value = []; updatedAt.value = ''; appliedLabel.value = ''; historyCache.value = {}; activitiesCache.value = {}
      ordersTruncated.value = false; fillsTruncated.value = false; selectedOrder.value = null
    }
    const loadAll = async () => {
      const version = ++requestVersion
      controller?.abort(); controller = new AbortController()
      const signal = controller.signal
      reset()
      if (!selectedContext.value) return
      loading.value = true
      let bounds, tf
      try {
        bounds = periodBounds(period.value, start.value, end.value)
        if (!timeframeOptions.value.some(option => option.value === timeframe.value)) throw new Error('Seleziona un TF compatibile con il periodo')
        tf = timeframe.value
      } catch (error) { errors.value = [error.message]; loading.value = false; return }
      const params = { portfolio_key_id: selectedContext.value }
      const request = (path, extra = {}) => api.get(`/dyn/al/${path}`, { params: { ...params, ...extra }, signal })
      const labels = ['Conto / posizioni', 'Equity', 'Ordini nel periodo', 'Ordini aperti', 'Eseguiti']
      const results = await Promise.allSettled([
        request('portfolio'),
        loadHistoryWindows(historyWindows(bounds.after, bounds.until, tf), window => request('portfolio-history', { ...window, timeframe: tf, intraday_reporting: session.value, pnl_reset: 'no_reset', prefer_cache: false }).then(response => response.data)).then(data => ({ data })),
        request('orders', { ...bounds, status: 'all' }), request('orders', { status: 'open' }),
        request('activities', { ...bounds, activity_types: 'FILL', direction: 'asc', page_size: 100, fetch_all: true, max_pages: 50, prefer_cache: false })
      ])
      if (version !== requestVersion) return
      results.forEach((result, index) => {
        if (result.status === 'rejected') errors.value.push(`${labels[index]}: ${result.reason?.response?.data?.error || result.reason.message || 'Dati non disponibili'}`)
      })
      const data = index => results[index].status === 'fulfilled' ? results[index].value.data : null
      const portfolio = data(0), history = data(1), historical = data(2), open = data(3), executions = data(4)
      if (portfolio) { account.value = portfolio.account || {}; positions.value = portfolio.positions || [] }
      if (history) { points.value = history.points || []; historyCache.value = history.cache || {} }
      const merged = new Map((historical?.orders || []).map(row => [row.id, { ...row, _open: !['filled', 'canceled', 'expired', 'rejected', 'replaced', 'stopped'].includes(row.status) }]))
      for (const row of open?.orders || []) merged.set(row.id, { ...row, _open: true })
      orders.value = [...merged.values()]
      ordersTruncated.value = Boolean(historical?.truncated || open?.truncated)
      if (executions) { fills.value = executions.activities || []; activitiesCache.value = executions.cache || {}; fillsTruncated.value = Boolean(executions.truncated) }
      const actualTf = history?.timeframe || tf
      loadedTimeframe.value = actualTf
      appliedLabel.value = `${dateTime(bounds.after)} → ${dateTime(bounds.until)} · TF effettivo ${actualTf} · ${sessionOptions.find(row => row.value === session.value)?.label}${actualTf === '1D' ? ' (campioni a fine giornata)' : ''}`
      if (results.some(result => result.status === 'fulfilled')) updatedAt.value = new Date().toISOString()
      loadedBounds = bounds
      loading.value = false
      if (selectedSymbols.value.length) await loadCycleBasis()
    }
    watch(selectedSymbols, () => { if (!loading.value) loadCycleBasis() }, { deep: true })
    const changeContext = () => {
      try { localStorage.setItem('alpaca-account-context', selectedContext.value) } catch (_) { /* Storage may be disabled. */ }
      search.value = ''; selectedSymbols.value = []; loadAll()
    }
    onMounted(async () => {
      try {
        const response = await api.get('/dyn/al/contexts')
        contexts.value = response.data
        let saved
        try { saved = localStorage.getItem('alpaca-account-context') } catch (_) { /* Use first registered account. */ }
        selectedContext.value = contexts.value.find(row => row.portfolio_key_id === saved)?.portfolio_key_id || contexts.value[0]?.portfolio_key_id || ''
        await loadAll()
      } catch (error) { errors.value = [error?.response?.data?.error || error.message] }
      finally { contextsLoading.value = false }
    })
    onBeforeUnmount(() => { requestVersion++; controller?.abort(); cycleVersion++; cycleController?.abort() })
    let filterTimer
    watch([period, timeframe, session, start, end], () => {
      clearTimeout(filterTimer)
      if (!timeframeOptions.value.some(option => option.value === timeframe.value)) {
        timeframe.value = '1D'
        filterMessage.value = 'Intervallo oltre 30 giorni: selezionato 1D, unico TF compatibile.'
        return
      }
      filterMessage.value = ''
      if (selectedContext.value && validRange.value) filterTimer = setTimeout(loadAll, 250)
    })
    onBeforeUnmount(() => clearTimeout(filterTimer))
    const sessionOptions = [{ label: 'Regolare', value: 'market_hours' }, { label: 'Premarket + after-hours', value: 'extended_hours' }, { label: 'Continua', value: 'continuous' }]
    const orderStatusOptions = [{ label: 'Tutti', value: 'all' }, { label: 'Aperti', value: 'open' }, { label: 'Chiusi', value: 'closed' }]
    return { contexts, selectedContext, contextsLoading, loading, errors, updatedAt, context, contextOptions, currency, money, dateTime, metrics, periodMetrics, loadedTimeframe, selectedSymbols, symbolOptions, symbolsLegend, selectedFills, orders, openingQuantities, cycleStatus, cycleError, cycleFillColumns, validRange, timeframeGuide, filterMessage,
      period, timeframe, session, start, end, periodOptions, timeframeOptions, sessionOptions, logarithmic, points, historyCache, activitiesCache, appliedLabel,
      positions, positionColumns, tab, search, visibleOrders, orderColumns, orderStatus, orderStatusOptions, ordersTruncated, fills, fillColumns, fillsTruncated,
      analysisRows, analysisColumns, selectedOrder, orderEvents, orderFills, loadAll, changeContext }
  }
}
</script>
<style scoped>
.portfolio-dashboard { max-width: 1800px; margin: auto; }
</style>
