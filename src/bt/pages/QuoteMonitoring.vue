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
    <q-card flat bordered class="q-mb-lg"><q-card-section>
      <div class="text-h6 q-mb-sm">Aggiungi titoli da registrare</div>
      <MarketAssetSelector v-model="draft" multiple />
      <div class="row q-col-gutter-sm items-center q-mt-sm"><div class="col-12 col-sm-5"><q-select v-model="context" :options="contexts" option-value="portfolio_key_id" :option-label="contextLabel" emit-value map-options label="Conto Alpaca" outlined dense :loading="positionsLoading" @update:model-value="loadPositions" /></div><div class="col-auto"><q-btn flat icon="playlist_add" label="Aggiungi titoli del portafoglio" :disable="!portfolioSymbols.length" @click="draft = [...new Set([...draft, ...portfolioSymbols])]" /></div></div>
      <div class="q-mt-md">Flussi per i nuovi titoli:</div>
      <q-checkbox v-for="channel in channelOptions" :key="channel.value" v-model="newChannels" :val="channel.value" :label="channel.label" />
      <q-btn color="primary" icon="add" label="Aggiungi e registra" :disable="!draft.length || !newChannels.length" :loading="saving" @click="addSymbols" class="q-ml-md" />
      <div v-if="notice" role="status" class="text-positive q-mt-sm">{{ notice }}</div>
    </q-card-section></q-card>
    <q-card flat bordered class="q-mb-lg"><q-card-section><div class="text-h6">Registrazioni manuali</div><div class="text-caption">I flussi selezionati vengono conservati anche a pagina chiusa. Le richieste di altre applicazioni restano indipendenti.</div></q-card-section>
      <q-markup-table flat><thead><tr><th class="text-left">Titolo</th><th v-for="channel in channelOptions" :key="channel.value">{{ channel.label }}</th><th>Azioni</th></tr></thead><tbody>
      <tr v-for="symbol in state.manual_symbols || []" :key="symbol"><td>{{ symbol }}<div v-for="(symbols, name) in state.sources || {}" :key="name" class="text-caption text-grey-7"><span v-if="symbols.includes(symbol)">{{ name }} richiede anche bid/ask, scambi e barre</span></div></td><td v-for="channel in channelOptions" :key="channel.value" class="text-center"><q-checkbox :model-value="(state.manual_channels?.[symbol] || []).includes(channel.value)" :disable="saving" :aria-label="channel.label + ' ' + symbol" @update:model-value="v => updateChannel(symbol, channel.value, v)" /></td><td class="text-center"><q-btn flat round icon="delete_outline" :aria-label="'Rimuovi ' + symbol" :disable="saving" @click="removeSymbol(symbol)" /></td></tr>
      </tbody></q-markup-table><q-card-section v-if="!(state.manual_symbols || []).length" class="text-grey-7">Nessuna registrazione manuale.</q-card-section></q-card>
    <div class="row q-col-gutter-md q-mb-lg"><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Titoli richiesti complessivamente</div><div class="text-h5">{{ rows.length }}</div><div class="text-caption">Lista manuale e Watchtower</div></q-card-section></q-card></div><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Registratore</div><div class="text-h6" :class="state.logger_alive && state.proxy_connected ? 'text-positive' : 'text-warning'">{{ state.logger_alive && state.proxy_connected ? 'Collegato al mercato' : 'Collegamento non confermato' }}</div><div class="text-caption">{{ state.feed ? `Feed ${state.feed.toUpperCase()}` : 'Feed da verificare' }}</div></q-card-section></q-card></div><div class="col-12 col-sm-4"><q-card flat bordered><q-card-section><div class="text-caption text-grey-7">Dopo la registrazione</div><div class="row q-gutter-sm q-mt-sm"><q-btn flat color="primary" icon="monitoring" label="Guarda i flussi" to="/Zmq/Monitoring" /><q-btn flat color="primary" icon="history" label="Apri lo storico" to="/Zmq/History" /></div></q-card-section></q-card></div></div>
    <q-card flat bordered><q-card-section><div class="text-h6">Titoli richiesti e stato della raccolta</div><div class="text-caption text-grey-7">Togliere un titolo dalla lista manuale non interrompe una richiesta ancora presente in Watchtower.</div></q-card-section><q-table :rows="rows" :columns="columns" row-key="symbol" flat :pagination="{ rowsPerPage: 15 }" no-data-label="La raccolta non include ancora titoli: scegli i simboli e salva la lista."><template #body-cell-state="props"><q-td :props="props"><q-badge :color="props.row.recent ? 'green-1' : 'amber-1'" :text-color="props.row.recent ? 'green-9' : 'amber-10'">{{ props.row.state }}</q-badge></q-td></template></q-table></q-card>
    <q-expansion-item icon="info_outline" label="Che cosa viene registrato?" class="q-mt-md"><q-card flat><q-card-section class="text-body2 text-grey-7">Sono dati del mercato del titolo, non la liquidità o il saldo del tuo conto. Bid e ask sono le migliori proposte di acquisto e vendita disponibili nel feed; gli scambi sono esecuzioni avvenute sul mercato. Il dato L1 non contiene tutti i livelli del book e non garantisce l’esecuzione di una tua uscita.</q-card-section></q-card></q-expansion-item>
  </q-page>
</template>
<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from 'boot/axios'
import MarketAssetSelector from '../components/MarketAssetSelector.vue'
import { isOutOfSequenceTrade } from '../utils/marketFlow.mjs'
export default {
  components: { MarketAssetSelector },
  setup () {
    const state = ref({}), draft = ref([]), contexts = ref([]), context = ref(null), portfolioSymbols = ref([]), positionsLoading = ref(false), saving = ref(false), error = ref(''), notice = ref(''), configOpen = ref(true)
    const channelOptions = [{ value: 'QUOTE', label: 'Bid/ask' }, { value: 'TRADE', label: 'Scambi' }, { value: 'MIN', label: 'Barre 1 minuto' }]
    const newChannels = ref(['QUOTE', 'TRADE', 'MIN'])
    let timer, polling = false, disposed = false
    const price = value => Number(value) > 0 ? Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'
    const contextLabel = item => `${item.display_name || item.portfolio_key_id} · ${item.paper ? 'Paper' : 'Real'}`
    const rows = computed(() => (state.value.desired_symbols || []).map(symbol => {
      const latest = state.value.latest?.[symbol] || {}, events = Object.values(latest).filter(event => event.timestamp).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), last = events[0]
      const recent = state.value.logger_alive && state.value.proxy_connected && last && Date.now() - Date.parse(last.timestamp) < 60000
      const owners = [...((state.value.manual_symbols || []).includes(symbol) ? ['Manuale'] : []), ...Object.entries(state.value.sources || {}).filter(([, symbols]) => symbols.includes(symbol)).map(([name]) => name === 'watchtower' ? 'Watchtower' : name)]
      const quote = latest.quote || {}, bid = Number(quote.bid_price), ask = Number(quote.ask_price)
      return { symbol, bidSize: quote.bid_size == null ? '—' : Number(quote.bid_size).toLocaleString('it-IT'), askSize: quote.ask_size == null ? '—' : Number(quote.ask_size).toLocaleString('it-IT'), bid: price(bid), ask: price(ask), trade: price(isOutOfSequenceTrade(latest.trade || {}) ? null : latest.trade?.price), spread: bid > 0 && ask >= bid ? `${((ask - bid) / ((ask + bid) / 2) * 10000).toFixed(1)} bps` : '—', quoteTime: quote.timestamp ? new Date(quote.timestamp).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : 'non ancora ricevuti', owners: owners.join(' · '), recent, state: !state.value.logger_alive || !state.value.proxy_connected ? 'Registratore non raggiungibile' : !last ? 'In attesa del primo dato' : recent ? 'Dati in arrivo' : 'Ultimo dato non recente', time: last ? new Date(last.timestamp).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '—' }
    }))
    const columns = [{ name: 'symbol', label: 'Titolo', field: 'symbol', align: 'left', sortable: true }, { name: 'owners', label: 'Richiesto da', field: 'owners', align: 'left' }, { name: 'state', label: 'Raccolta', field: 'state', align: 'left' }, { name: 'time', label: 'Ultimo dato · Roma', field: 'time', align: 'left' }]
    async function refresh () { if (polling || disposed) return; polling = true; try { const { data } = await api.get('/dyn/quote-monitor/status'); if (!disposed) state.value = data } catch (e) { error.value = e.response?.data?.error || e.message } finally { polling = false } }
    async function saveConfig (symbols, channels) { saving.value = true; error.value = ''; notice.value = ''; try { await api.put('/dyn/quote-monitor/config', { symbols, channels }); notice.value = 'Configurazione salvata. Le richieste vengono applicate entro pochi secondi.'; await refresh() } catch (e) { error.value = e.response?.data?.error || e.message } finally { saving.value = false } }
    async function addSymbols () { const symbols = [...new Set([...(state.value.manual_symbols || []), ...draft.value])]; const channels = { ...(state.value.manual_channels || {}) }; for (const s of draft.value) if (!channels[s]) channels[s] = [...newChannels.value]; await saveConfig(symbols, channels); if (!error.value) draft.value = [] }
    async function updateChannel (symbol, channel, enabled) { const channels = { ...(state.value.manual_channels || {}) }; const values = new Set(channels[symbol]); enabled ? values.add(channel) : values.delete(channel); if (!values.size) { error.value = 'Seleziona almeno un flusso oppure rimuovi il titolo.'; return } channels[symbol] = [...values]; await saveConfig(state.value.manual_symbols, channels) }
    async function removeSymbol (symbol) { const symbols = state.value.manual_symbols.filter(s => s !== symbol); const channels = { ...(state.value.manual_channels || {}) }; delete channels[symbol]; await saveConfig(symbols, channels) }
    async function loadPositions () { portfolioSymbols.value = []; if (!context.value) return; positionsLoading.value = true; const selected = context.value; try { const { data } = await api.get('/dyn/al/portfolio', { params: { portfolio_key_id: selected } }); if (selected === context.value) portfolioSymbols.value = data.positions.map(p => p.symbol) } catch (e) { error.value = e.response?.data?.error || e.message } finally { positionsLoading.value = false } }
    onMounted(async () => { await refresh(); configOpen.value = !(state.value.desired_symbols || []).length; timer = setInterval(refresh, 5000); try { contexts.value = (await api.get('/dyn/al/contexts')).data } catch (e) { error.value = e.response?.data?.error || e.message } })
    onUnmounted(() => { disposed = true; clearInterval(timer) })
    return { state, draft, configOpen, contexts, context, portfolioSymbols, positionsLoading, saving, error, notice, contextLabel, rows, columns, channelOptions, newChannels, addSymbols, updateChannel, removeSymbol, loadPositions }
  }
}
</script>

<style scoped>
.flow-link :deep(.q-btn__content) { display: inline-flex; flex-direction: row; align-items: center; flex-wrap: nowrap; justify-content: center; gap: 6px; }
.flow-link :deep(.q-icon) { margin: 0; }
</style>
