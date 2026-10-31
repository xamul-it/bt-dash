<template>
  <q-page padding>
    <div class="text-h5 q-mb-xs">Titoli monitorati</div>
    <div class="text-body2 text-grey-7 q-mb-lg">Bid, ask e scambi dei titoli che scegli di osservare. Qui vedi le condizioni del mercato, non il saldo o la liquidità del tuo conto.</div>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>
    <div v-if="rows.length" class="row q-col-gutter-md q-mb-lg">
      <div v-for="row in rows" :key="row.symbol" class="col-12 col-md-6 col-lg-4"><q-card flat bordered><q-card-section>
        <div class="row items-center q-mb-md"><div class="text-h6">{{ row.symbol }}</div><q-space /><q-badge :color="row.recent ? 'green-1' : 'amber-1'" :text-color="row.recent ? 'green-9' : 'amber-10'">{{ row.state }}</q-badge></div>
        <div class="row q-col-gutter-md"><div class="col"><div class="text-caption text-grey-7">Bid · proposte di acquisto</div><div class="text-h5 text-green-9">{{ row.bid }}</div></div><div class="col"><div class="text-caption text-grey-7">Ask · proposte di vendita</div><div class="text-h5 text-blue-8">{{ row.ask }}</div></div></div>
        <div class="text-caption text-grey-7 q-mt-sm">Quantità esposta · Bid {{ row.bidSize }} / Ask {{ row.askSize }} <q-icon name="info_outline"><q-tooltip>Valori nativi del feed: non sono quantità del tuo portafoglio.</q-tooltip></q-icon></div>
        <q-separator class="q-my-md" /><div class="row"><div class="col"><div class="text-caption text-grey-7">Spread</div><div class="text-subtitle1">{{ row.spread }}</div></div><div class="col"><div class="text-caption text-grey-7">Ultimo scambio</div><div class="text-subtitle1">{{ row.trade }}</div></div></div>
        <div class="text-caption text-grey-7 q-mt-sm">Bid/ask: {{ row.quoteTime }} · Richiesto da {{ row.owners }}</div>
      </q-card-section><q-separator /><q-card-actions><q-btn flat dense color="primary" class="flow-link" icon="monitoring" label="Flusso live" :to="{ path: '/Zmq/Monitoring', query: { symbol: row.symbol } }" /><q-btn flat dense color="primary" icon="history" label="Storico" :to="{ path: '/Zmq/History', query: { symbol: row.symbol } }" /></q-card-actions></q-card></div>
    </div>
    <q-expansion-item v-model="configOpen" icon="playlist_add" label="Scegli o modifica i titoli da registrare" class="q-mb-lg">
    <q-card flat bordered class="q-mb-lg"><q-card-section>
      <div class="row items-center q-col-gutter-lg"><div class="col-12 col-md-8"><div class="text-h6 q-mb-md">1. Scegli i titoli da registrare</div><q-select v-model="draft" :options="portfolioSymbols" multiple use-input use-chips new-value-mode="add-unique" outlined label="Simboli, per esempio AAPL o MSFT" hint="Scrivi un simbolo e premi Invio. Puoi registrare anche titoli che non possiedi." /></div><div class="col-12 col-md-4"><div class="text-subtitle2 q-mb-sm">Oppure parti dal tuo portafoglio</div><q-select v-model="context" :options="contexts" option-value="portfolio_key_id" :option-label="contextLabel" emit-value map-options label="Conto Alpaca" outlined dense :loading="positionsLoading" @update:model-value="loadPositions" /><q-btn flat icon="playlist_add" label="Aggiungi i titoli in portafoglio" :disable="!portfolioSymbols.length" class="q-mt-sm" @click="draft = [...new Set([...draft, ...portfolioSymbols])]" /></div></div>
      <q-separator class="q-my-lg" />
      <div class="row items-center q-col-gutter-md"><div class="col-12 col-md"><div class="text-h6">2. Attiva la raccolta</div><div class="text-body2 text-grey-7">La lista è condivisa nella piattaforma. Dopo il salvataggio la raccolta continua anche chiudendo questa pagina.</div></div><div class="col-auto"><q-btn color="primary" icon="save" label="Salva lista di registrazione" :loading="saving" @click="save" /></div></div>
      <div v-if="notice" role="status" class="text-positive q-mt-md">{{ notice }}</div>
    </q-card-section></q-card>
    </q-expansion-item>
    <div class="row q-col-gutter-md q-mb-lg"><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Titoli richiesti complessivamente</div><div class="text-h5">{{ rows.length }}</div><div class="text-caption">Lista manuale e Watchtower</div></q-card-section></q-card></div><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Registratore</div><div class="text-h6" :class="state.logger_alive && state.proxy_connected ? 'text-positive' : 'text-warning'">{{ state.logger_alive && state.proxy_connected ? 'Collegato al mercato' : 'Collegamento non confermato' }}</div><div class="text-caption">{{ state.feed ? `Feed ${state.feed.toUpperCase()}` : 'Feed da verificare' }}</div></q-card-section></q-card></div><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Dopo la registrazione</div><div class="row q-gutter-sm q-mt-sm"><q-btn flat color="primary" icon="monitoring" label="Guarda i flussi" to="/Zmq/Monitoring" /><q-btn flat color="primary" icon="history" label="Apri lo storico" to="/Zmq/History" /></div></q-card-section></q-card></div></div>
    <q-card flat bordered><q-card-section><div class="text-h6">Titoli richiesti e stato della raccolta</div><div class="text-caption text-grey-7">Togliere un titolo dalla lista manuale non interrompe una richiesta ancora presente in Watchtower.</div></q-card-section><q-table :rows="rows" :columns="columns" row-key="symbol" flat :pagination="{ rowsPerPage: 15 }" no-data-label="La raccolta non include ancora titoli: scegli i simboli e salva la lista."><template #body-cell-state="props"><q-td :props="props"><q-badge :color="props.row.recent ? 'green-1' : 'amber-1'" :text-color="props.row.recent ? 'green-9' : 'amber-10'">{{ props.row.state }}</q-badge></q-td></template></q-table></q-card>
    <q-expansion-item icon="info_outline" label="Che cosa viene registrato?" class="q-mt-md"><q-card flat><q-card-section class="text-body2 text-grey-7">Sono dati del mercato del titolo, non la liquidità o il saldo del tuo conto. Bid e ask sono le migliori proposte di acquisto e vendita disponibili nel feed; gli scambi sono esecuzioni avvenute sul mercato. Il dato L1 non contiene tutti i livelli del book e non garantisce l’esecuzione di una tua uscita.</q-card-section></q-card></q-expansion-item>
  </q-page>
</template>
<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from 'boot/axios'
export default {
  setup () {
    const state = ref({}), draft = ref([]), contexts = ref([]), context = ref(null), portfolioSymbols = ref([]), positionsLoading = ref(false), saving = ref(false), error = ref(''), notice = ref(''), configOpen = ref(true)
    let timer, polling = false, disposed = false
    const price = value => Number(value) > 0 ? Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'
    const contextLabel = item => `${item.display_name || item.portfolio_key_id} · ${item.paper ? 'Paper' : 'Real'}`
    const rows = computed(() => (state.value.desired_symbols || []).map(symbol => {
      const latest = state.value.latest?.[symbol] || {}, events = Object.values(latest).filter(event => event.timestamp).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), last = events[0]
      const recent = state.value.logger_alive && state.value.proxy_connected && last && Date.now() - Date.parse(last.timestamp) < 60000
      const owners = [...((state.value.manual_symbols || []).includes(symbol) ? ['Manuale'] : []), ...Object.entries(state.value.sources || {}).filter(([, symbols]) => symbols.includes(symbol)).map(([name]) => name === 'watchtower' ? 'Watchtower' : name)]
      const quote = latest.quote || {}, bid = Number(quote.bid_price), ask = Number(quote.ask_price)
      return { symbol, bidSize: quote.bid_size == null ? '—' : Number(quote.bid_size).toLocaleString('it-IT'), askSize: quote.ask_size == null ? '—' : Number(quote.ask_size).toLocaleString('it-IT'), bid: price(bid), ask: price(ask), trade: price(latest.trade?.price), spread: bid > 0 && ask >= bid ? `${((ask - bid) / ((ask + bid) / 2) * 10000).toFixed(1)} bps` : '—', quoteTime: quote.timestamp ? new Date(quote.timestamp).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'non ancora ricevuti', owners: owners.join(' · '), recent, state: !state.value.logger_alive || !state.value.proxy_connected ? 'Registratore non raggiungibile' : !last ? 'In attesa del primo dato' : recent ? 'Dati in arrivo' : 'Ultimo dato non recente', time: last ? new Date(last.timestamp).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '—' }
    }))
    const columns = [{ name: 'symbol', label: 'Titolo', field: 'symbol', align: 'left', sortable: true }, { name: 'owners', label: 'Richiesto da', field: 'owners', align: 'left' }, { name: 'state', label: 'Raccolta', field: 'state', align: 'left' }, { name: 'time', label: 'Ultimo dato · Roma', field: 'time', align: 'left' }]
    async function refresh () { if (polling || disposed) return; polling = true; try { const { data } = await api.get('/dyn/quote-monitor/status'); if (!disposed) state.value = data } catch (e) { error.value = e.response?.data?.error || e.message } finally { polling = false } }
    async function save () { saving.value = true; error.value = ''; notice.value = ''; try { const { data } = await api.put('/dyn/quote-monitor/config', { symbols: [...new Set(draft.value.map(s => s.trim().toUpperCase()))] }); draft.value = data.symbols; notice.value = 'Lista salvata. Le richieste vengono applicate entro pochi secondi.'; await refresh() } catch (e) { error.value = e.response?.data?.error || e.message } finally { saving.value = false } }
    async function loadPositions () { portfolioSymbols.value = []; if (!context.value) return; positionsLoading.value = true; const selected = context.value; try { const { data } = await api.get('/dyn/al/portfolio', { params: { portfolio_key_id: selected } }); if (selected === context.value) portfolioSymbols.value = data.positions.map(p => p.symbol) } catch (e) { error.value = e.response?.data?.error || e.message } finally { positionsLoading.value = false } }
    onMounted(async () => { await refresh(); draft.value = (state.value.manual_symbols || []).slice(); configOpen.value = !(state.value.desired_symbols || []).length; timer = setInterval(refresh, 5000); try { contexts.value = (await api.get('/dyn/al/contexts')).data } catch (e) { error.value = e.response?.data?.error || e.message } })
    onUnmounted(() => { disposed = true; clearInterval(timer) })
    return { state, draft, configOpen, contexts, context, portfolioSymbols, positionsLoading, saving, error, notice, contextLabel, rows, columns, save, loadPositions }
  }
}
</script>

<style scoped>
.flow-link :deep(.q-btn__content) { flex-wrap: nowrap; justify-content: flex-start; gap: 6px; }
.flow-link :deep(.q-icon) { margin: 0; }
</style>
