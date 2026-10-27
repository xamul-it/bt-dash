<template>
  <q-page padding>
    <div class="row items-center q-mb-md"><div class="col"><div class="text-h5">Monitoraggio liquidità L1</div><div class="text-caption">Titoli selezionati · barre minute e bid/ask · osservazione anche a pagina chiusa</div></div><q-btn icon="refresh" label="Aggiorna" :loading="loading" @click="refresh" /></div>
    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>
    <q-banner class="bg-blue-1 q-mb-md">L1 mostra il miglior bid/ask, senza profondità del book. Prezzo e quantità esposti non garantiscono l'esecuzione. Le size sono nei valori nativi del feed, senza conversione in azioni.</q-banner>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="row q-col-gutter-md items-center">
          <div class="col-12 col-md-6"><q-select v-model="draft" label="Titoli da registrare" multiple use-chips use-input new-value-mode="add-unique" :options="portfolioSymbols" outlined hint="Scrivi un ticker e premi Invio, oppure scegli una posizione del conto" /></div>
          <div class="col-auto"><q-btn color="primary" label="Salva monitoraggio" :loading="saving" @click="save" /></div>
          <div class="col-12 col-md"><q-select v-model="context" :options="contexts" option-value="portfolio_key_id" :option-label="contextLabel" emit-value map-options label="Conto per consultare il portafoglio e lo storico" outlined @update:model-value="loadPositions" /></div>
          <div class="col-auto"><q-btn label="Aggiungi posizioni" :disable="!portfolioSymbols.length" @click="draft = [...new Set([...draft, ...portfolioSymbols])]" /></div>
        </div>
        <div class="text-caption q-mt-md">La lista è condivisa e resta attiva finché non rimuovi i simboli. Il conto serve per leggere posizioni e storico; il flusso live usa il feed configurato sul gateway.</div>
        <div class="row q-gutter-sm q-mt-sm">
          <q-chip :color="state.logger_alive ? 'green-2' : 'red-2'">Logger {{ state.logger_alive ? 'attivo' : 'non raggiungibile' }}</q-chip>
          <q-chip :color="state.logger_alive && state.proxy_connected ? 'green-2' : 'red-2'">Proxy {{ state.logger_alive && state.proxy_connected ? 'raggiungibile' : 'non confermato' }}</q-chip>
          <q-chip>Feed {{ state.feed || 'non verificato' }}</q-chip>
          <q-chip v-if="pending" color="amber-2">Applicazione lista in corso</q-chip>
        </div>
        <div v-if="state.error" class="text-negative">{{ state.error }}</div>
        <div v-if="state.feed === 'iex'" class="text-warning">IEX copre una sola sede: copertura insufficiente per descrivere tutta la liquidità AH.</div>
      </q-card-section>
    </q-card>
    <q-table title="Raccolta dei titoli selezionati" :rows="rows" :columns="columns" row-key="symbol" flat bordered :pagination="{ rowsPerPage: 25 }" no-data-label="Scegli e salva i titoli da monitorare" class="q-mb-md">
      <template #body-cell-actions="props"><q-td :props="props"><q-btn flat dense label="Dati registrati" @click="showRecording(props.row.symbol)" /></q-td></template>
    </q-table>
    <q-card flat bordered>
      <q-card-section><div class="text-h6">Storico bid/ask after-hours</div><div class="text-caption q-mb-md">SIP · 16:00–20:00 America/New_York · una pagina fino a 10.000 quote per richiesta. Lo storico L1 non ricostruisce il book L2. Le mezze giornate richiedono di interpretare separatamente questa finestra oraria.</div>
        <div class="row q-col-gutter-md items-center">
          <div class="col-12 col-sm-3"><q-input v-model="historySymbol" label="Ticker storico" outlined /></div>
          <div class="col-12 col-sm-3"><q-input v-model="historyDate" label="Data della sessione USA" type="date" outlined /></div>
          <div class="col-auto"><q-btn label="Scarica prima pagina" :disable="!context || !historySymbol || !historyDate" :loading="downloading" @click="downloadHistory(false)" /></div>
          <div class="col-auto"><q-btn v-if="historyToken" label="Scarica pagina successiva" :loading="downloading" @click="downloadHistory(true)" /></div>
        </div>
        <div class="q-mt-md" role="status">{{ historyMessage }}</div>
      </q-card-section>
    </q-card>
    <q-dialog v-model="recordingOpen"><q-card style="width: 1100px; max-width: 95vw"><q-card-section class="row items-center"><div class="text-h6 col">{{ recordingSymbol }} · eventi registrati</div><q-btn flat icon="close" v-close-popup /></q-card-section><q-card-section>
      <div class="q-mb-sm">{{ recordingScope }}. {{ recordingTruncated ? 'Estratto parziale dello storico.' : '' }} Orari visualizzati in Europe/Rome.</div>
      <q-table :rows="recordingRows" :columns="recordingColumns" row-key="_index" :pagination="{ rowsPerPage: 15 }" flat no-data-label="Nessun evento registrato" />
    </q-card-section></q-card></q-dialog>
  </q-page>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from 'boot/axios'

export default {
  name: 'QuoteMonitoring',
  setup () {
    const state = ref({}), draft = ref([]), desired = ref([]), contexts = ref([]), context = ref(null), portfolioSymbols = ref([])
    const loading = ref(false), saving = ref(false), error = ref('')
    const historySymbol = ref(''), historyDate = ref(''), historyToken = ref(null), historyMessage = ref(''), downloading = ref(false)
    const recordingOpen = ref(false), recordingSymbol = ref(''), recordingRows = ref([]), recordingTruncated = ref(false), recordingScope = ref('')
    let timer, historyQuery, historyPage = 0
    const message = e => e.response?.data?.error || e.message
    const contextLabel = item => `${item.display_name || item.portfolio_key_id} · ${item.paper ? 'Paper' : 'Real'}`
    const number = value => value == null ? '—' : Number(value).toLocaleString('it-IT', { maximumFractionDigits: 5 })
    const dateTime = value => value ? new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '—'
    const pending = computed(() => JSON.stringify(desired.value) !== JSON.stringify(state.value.symbols || []))
    const rows = computed(() => desired.value.map(symbol => {
      const latest = state.value.latest?.[symbol] || {}, q = latest.quote || {}, bar = latest.bar || {}
      const age = q.timestamp ? (Date.now() - Date.parse(q.timestamp)) / 1000 : null
      return { symbol, ...q, quoteTime: dateTime(q.timestamp), barTime: dateTime(bar.timestamp),
        health: !state.value.logger_alive ? 'Logger non raggiungibile' : !state.value.proxy_connected ? 'Proxy non confermato' : !q.timestamp ? 'In attesa di quote' : age > 60 ? 'Quote datate' : 'Quote recenti',
        fileBytes: state.value.recordings?.find(r => r.symbol === symbol)?.bytes }
    }))
    const columns = [
      { name: 'symbol', label: 'Titolo', field: 'symbol', align: 'left', sortable: true },
      { name: 'health', label: 'Stato raccolta', field: 'health', align: 'left' },
      ...[['bid_price', 'Bid'], ['ask_price', 'Ask'], ['bid_size', 'Size bid (feed)'], ['ask_size', 'Size ask (feed)'], ['spread_bps', 'Spread bps']].map(([name, label]) => ({ name, label, field: name, format: number, sortable: true })),
      { name: 'quoteTime', label: 'Ultima quote · Roma', field: 'quoteTime' },
      { name: 'barTime', label: 'Ultima barra · Roma', field: 'barTime' },
      { name: 'fileBytes', label: 'Archivio MB', field: 'fileBytes', format: v => v == null ? '—' : number(v / 1000000), sortable: true },
      { name: 'actions', label: '', field: 'symbol' }
    ]
    const recordingColumns = [{ name: 'timestamp', label: 'Ora · Roma', field: 'timestamp', format: dateTime },
      { name: 'event_type', label: 'Evento', field: r => r.event_type || r.timeframe },
      ...[['bid_price', 'Bid'], ['ask_price', 'Ask'], ['bid_size', 'Size bid'], ['ask_size', 'Size ask'], ['spread_bps', 'Spread bps'], ['close', 'Close minuto']].map(([name, label]) => ({ name, label, field: name, format: number, sortable: true }))]
    async function refresh () {
      if (loading.value) return
      loading.value = true
      try { state.value = (await api.get('/dyn/quote-monitor/status')).data; desired.value = state.value.desired_symbols || [] } catch (e) { error.value = message(e) } finally { loading.value = false }
    }
    async function save () {
      saving.value = true; error.value = ''
      try {
        const symbols = [...new Set(draft.value.map(s => s.trim().toUpperCase()))]
        const response = await api.put('/dyn/quote-monitor/config', { symbols })
        draft.value = response.data.symbols; await refresh()
      } catch (e) { error.value = message(e) } finally { saving.value = false }
    }
    async function loadPositions () {
      portfolioSymbols.value = []
      if (!context.value) return
      const selected = context.value
      try {
        const response = await api.get('/dyn/al/portfolio', { params: { portfolio_key_id: selected } })
        if (selected === context.value) portfolioSymbols.value = response.data.positions.map(p => p.symbol)
      } catch (e) { error.value = message(e) }
    }
    async function showRecording (symbol) {
      error.value = ''
      try {
        const { data } = await api.get(`/dyn/quote-monitor/recordings/${encodeURIComponent(symbol)}`)
        recordingSymbol.value = symbol; recordingRows.value = data.rows.slice().reverse().map((row, _index) => ({ ...row, _index }))
        recordingTruncated.value = data.truncated; recordingScope.value = data.scope || 'Archivio vuoto'; recordingOpen.value = true
      } catch (e) { error.value = message(e) }
    }
    async function downloadHistory (next) {
      downloading.value = true; error.value = ''
      try {
        if (!next) { historyToken.value = null; historyPage = 0; historyQuery = { symbol: historySymbol.value.trim().toUpperCase(), date: historyDate.value, portfolio_key_id: context.value } }
        const query = { ...historyQuery, page_token: next ? historyToken.value : undefined }
        const { data } = await api.get(`/dyn/quote-monitor/history/${encodeURIComponent(query.symbol)}`, { params: query, timeout: 40000 })
        historyPage++; historyToken.value = data.next_page_token
        const content = data.rows.map(row => JSON.stringify({ ...row, symbol: data.symbol, feed: data.feed })).join('\n')
        const url = URL.createObjectURL(new Blob([content ? `${content}\n` : ''], { type: 'application/x-ndjson' }))
        const link = document.createElement('a'); link.href = url; link.download = `${data.symbol}_${data.date}_AH_sip_${historyPage}.jsonl`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        historyMessage.value = `${data.symbol} · ${data.date} · Pagina ${historyPage}: ${data.rows.length} quote. ${historyToken.value ? 'Storico parziale: scarica la pagina successiva.' : 'Download della sessione completato.'}`
      } catch (e) { error.value = message(e); historyMessage.value = 'Download interrotto; le pagine già scaricate restano disponibili.' } finally { downloading.value = false }
    }
    onMounted(async () => {
      await refresh(); draft.value = (state.value.manual_symbols || desired.value).slice()
      timer = setInterval(refresh, 5000)
      try { contexts.value = (await api.get('/dyn/al/contexts')).data } catch (e) { error.value = message(e) }
    })
    onUnmounted(() => clearInterval(timer))
    return { state, draft, contexts, context, portfolioSymbols, loading, saving, error, contextLabel, pending, rows, columns, refresh, save, loadPositions,
      historySymbol, historyDate, historyToken, historyMessage, downloading, downloadHistory,
      recordingOpen, recordingSymbol, recordingRows, recordingTruncated, recordingScope, recordingColumns, showRecording }
  }
}
</script>
