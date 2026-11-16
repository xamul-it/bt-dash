<template>
  <q-page padding>
    <div class="row q-col-gutter-md items-center q-mb-md"><div class="col-12 col-md"><div class="text-h5">Flussi live</div><div class="text-caption">Flussi di mercato in arrivo, stato del collegamento e applicazioni collegate</div></div><div class="col-auto"><q-btn label="Gestione storico" to="/Zmq/History" icon="folder" /></div><div class="col-auto"><q-btn label="Registra simboli" to="/Zmq/Recording" icon="playlist_add" /></div></div>
    <q-banner v-if="error" class="bg-red-1 q-mb-md">{{ error }}</q-banner>
    <q-card flat bordered class="q-mb-lg"><q-card-section>
      <MarketAssetSelector v-model="selected" class="q-mb-md" /><div class="text-caption q-mb-md">Il titolo scelto viene osservato finché questa pagina è aperta. La registrazione si configura in Titoli monitorati.</div><div class="row items-center q-col-gutter-md q-mb-md"><div class="col"><div class="text-h6">Mercato in tempo reale</div><div class="text-caption">A sinistra le ultime tre barre minuto Alpaca e, in grigio, la candela provvisoria del minuto corrente calcolata dagli scambi ricevuti. Può essere incompleta se la pagina è stata aperta a minuto iniziato o in caso di perdita di eventi. A destra scorrono 60 secondi di bid, ask e scambi; i tick sono campionati ogni 100 ms.</div></div><div class="col-auto"><q-toggle v-model="paused" label="Pausa visualizzazione" /></div></div>
      <q-banner v-if="gap" class="bg-amber-1 q-mb-md">Campione incompleto: durante la pausa o tra due letture sono arrivati più eventi di quelli conservati nel buffer. Le registrazioni su disco sono consultabili nella pagina separata.</q-banner>
      <div class="text-caption q-mb-sm">Ricevuti dall'avvio del logger per {{ selected || '—' }}: {{ counts }}. La pausa ferma solo la visualizzazione.</div>
      <div class="text-caption q-mb-sm">Periodo nel campione per {{ selected || '—' }}: {{ sampleRange }}. Per periodi precedenti usa Gestione storico.</div>
      <OpenPositionChart :key="selected" :symbol="selected" v-slot="{ positions }"><LiveTickChart :rows="visible" :now="now" :positions="positions" :provisional="candles.find(c => c.symbol === selected)" :latest-quote="state.latest?.[selected]?.quote || null" /></OpenPositionChart>
    </q-card-section></q-card>
    <q-card flat bordered class="q-mb-md"><q-card-section>
      <div class="row q-gutter-md"><q-chip v-for="service in state.services || []" :key="service.name" :color="service.active_ok ? 'green-2' : 'red-2'">{{ service.name }} · {{ service.active }} / {{ service.sub }}</q-chip><q-chip :color="fresh && state.proxy_connected ? 'green-2' : 'amber-2'">Telemetria {{ fresh && state.proxy_connected ? 'aggiornata' : 'non confermata' }}</q-chip><q-chip>Feed {{ state.feed || 'non disponibile' }}</q-chip></div>
      <div class="text-caption q-mt-sm">Aggiornamento ogni secondo; elenco sottoscrizioni circa ogni 5 secondi. Un ACK non conferma il flusso dati upstream. Ultimo stato: {{ dateTime(state.updated_at * 1000) }}.</div>
      <div v-if="state.error" class="text-negative">{{ state.error }}</div>
    </q-card-section></q-card>
    <q-table title="Simboli e applicazioni richiedenti" :rows="subscriptions" :columns="symbolColumns" row-key="key" flat bordered :pagination="{ rowsPerPage: 15 }" no-data-label="Nessun simbolo sottoscritto" class="q-mb-md" />
    <q-table title="Client collegati" :rows="state.proxy?.clients || []" :columns="clientColumns" row-key="id" flat bordered :pagination="{ rowsPerPage: 10 }" no-data-label="Nessun client rilevato" class="q-mb-md" />

  </q-page>
</template>
<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from 'boot/axios'
import { useRoute } from 'vue-router'
import OpenPositionChart from '../components/OpenPositionChart.vue'
import LiveTickChart from '../components/LiveTickChart.vue'
import MarketAssetSelector from '../components/MarketAssetSelector.vue'
import { mergeLiveTicks, mergeTradeCandles } from '../utils/marketFlow.mjs'
export default {
  components: { OpenPositionChart, LiveTickChart, MarketAssetSelector },
  setup () {
    const route = useRoute()
    const state = ref({}), events = ref([]), candles = ref([]), selected = ref(route.query.symbol ? String(route.query.symbol) : null), error = ref(''), paused = ref(false), gap = ref(false), now = ref(Date.now())
    const sampleRange = computed(() => { const times = visible.value.map(row => Date.parse(row.timestamp || row.ts)).filter(Number.isFinite); return times.length ? `${dateTime(Math.min(...times))} → ${dateTime(Math.max(...times))}` : 'in attesa di eventi' })
    const liveId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
    let timer, busy = false, cursor = 0, session = null, disposed = false, lastLease = 0, leasedSymbol = null
    const dateTime = value => Number.isFinite(value) ? new Date(value).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '—'
    const fresh = computed(() => state.value.fresh && now.value - state.value.updated_at * 1000 < 20000)
    const subscriptions = computed(() => (state.value.proxy?.clients || []).flatMap(client => client.subscriptions.map(item => ({ ...item, key: `${client.id}:${item.channel}:${item.symbol}`, application: client.application, client: client.identity,
      owners: client.application?.startsWith('Registratore persistente') ? Object.entries(state.value.registrations || {}).filter(([, symbols]) => symbols.includes(item.symbol)).map(([name]) => name).join(', ') : '—' }))))
    const symbolOptions = computed(() => [...new Set([...subscriptions.value.map(r => r.symbol), ...events.value.map(r => r.symbol)])].sort())
    const visible = computed(() => events.value.filter(row => row.symbol === selected.value))
    const counts = computed(() => Object.entries(state.value.counters || {}).filter(([key]) => key.startsWith(`${selected.value}:`)).map(([key, value]) => `${key.split(':')[1]} ${value}`).join(' · ') || 'nessun evento')
    const symbolColumns = [['symbol', 'Simbolo'], ['channel', 'Canale'], ['application', 'Applicazione'], ['owners', 'Liste persistenti'], ['client', 'Identità client']].map(([name, label]) => ({ name, label, field: name, align: 'left', sortable: true }))
    const clientColumns = [{ name: 'application', label: 'Applicazione', field: 'application', align: 'left' }, { name: 'identity', label: 'Identità', field: 'identity', align: 'left' }, { name: 'heartbeat_age_seconds', label: 'Età heartbeat (s)', field: 'heartbeat_age_seconds', format: value => Number(value).toFixed(1) }, { name: 'subscriptions', label: 'Sottoscrizioni', field: row => row.subscriptions.length }]
    async function poll () {
      if (busy || disposed) return
      busy = true; if (!paused.value) now.value = Date.now()
      try {
        if (selected.value && (selected.value !== leasedSymbol || Date.now() - lastLease > 5000)) { await api.put(`/dyn/quote-monitor/live-selection/${liveId}`, { symbol: selected.value }); leasedSymbol = selected.value; lastLease = Date.now() }
        if (!selected.value && leasedSymbol) { await api.delete(`/dyn/quote-monitor/live-selection/${liveId}`); leasedSymbol = null }
        const response = await api.get('/dyn/quote-monitor/admin')
        if (disposed) return
        state.value = response.data; error.value = ''
        if (!paused.value) {
          const { data } = await api.get('/dyn/quote-monitor/live', { params: { after: cursor, session } })
          if (disposed) return
          now.value = Date.now()
          gap.value = gap.value || data.gap || data.reset
          candles.value = mergeTradeCandles(candles.value, data.rows, data.reset, now.value)
          events.value = mergeLiveTicks(events.value, data.rows, data.reset, now.value)
          cursor = data.sequence; session = data.session_id
        }

      } catch (e) { error.value = e.response?.data?.error || e.message } finally { busy = false }
    }
    onMounted(() => { poll(); timer = setInterval(poll, 1000) })
    onUnmounted(() => { disposed = true; clearInterval(timer); api.delete(`/dyn/quote-monitor/live-selection/${liveId}`).catch(() => {}) })
    return { now, candles, sampleRange, state, error, fresh, dateTime, subscriptions, symbolColumns, clientColumns, selected, symbolOptions, paused, gap, counts, visible }
  }
}
</script>
