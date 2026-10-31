<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Replay tramite proxy ZMQ</div>
      <div class="text-caption q-mb-md">Il proxy usa le porte 5557 (comandi) e 5558 (flusso), separate dal live. Preparare la sessione carica i dati; il clock parte quando un client registra un simbolo e un canale disponibili. La dashboard può registrarsi come client.</div>
      <q-banner v-if="error || state.error" class="bg-red-1 q-mb-md">{{ error || state.error }}</q-banner>
      <div class="row q-col-gutter-md items-start">
        <div class="col-12 col-md-4"><q-select v-model="selection" :options="symbols" multiple use-chips label="Simboli per il replay" outlined :disable="running" /></div>
        <div class="col-12 col-sm-4 col-md-3"><q-input v-model="date" type="date" label="Data registrata · New York" outlined :disable="running" /></div>
        <div class="col-12 col-sm-4 col-md-2"><q-select v-model="session" :options="sessionOptions" emit-value map-options label="Sessione USA" outlined :disable="running" /></div>
        <div class="col-12 col-sm-4 col-md-3"><q-select v-model="speed" :options="speedOptions" emit-value map-options label="Velocità temporale" outlined :disable="running" /></div>
      </div>
      <q-checkbox v-model="remap" label="Trasla le date a oggi per compatibilità con il client" :disable="running" />
      <div class="text-caption q-mb-md">Di default conserva i timestamp registrati, anche in AH. 60× divide gli intervalli per 60; Massima elimina le attese. Il replay riguarda solo i dati: non avvia strategie né cambia il broker dei client.</div>
      <div class="row q-gutter-sm">
        <q-btn label="Prepara proxy replay" color="primary" :disable="running || !selection.length || !date" :loading="busy" @click="prepare" />
        <q-btn label="Registra dashboard e avvia replay" :disable="!ready || state.preview?.active || state.state === 'EOD_SIGNALED'" :loading="busy" @click="control('preview_start')" />
        <q-btn label="Scollega dashboard" :disable="!state.preview?.active || !running" :loading="busy" @click="control('preview_stop')" />
        <q-btn label="Reset clock" :disable="!ready" :loading="busy" @click="control('reset')" />
        <q-btn label="Arresta proxy replay" color="negative" outline :disable="!running" :loading="busy" @click="stop" />
      </div>
      <div class="row q-gutter-md q-my-md"><q-chip>{{ stateLabels[state.state] || state.state || 'Fermo' }}</q-chip><q-chip v-if="state.total_events != null">{{ state.total_events }} eventi caricati</q-chip><q-chip v-if="state.published != null">{{ state.published }} pubblicati</q-chip><q-chip v-if="state.preview?.active">{{ state.preview.received }} ricevuti dalla dashboard</q-chip></div>
      <div v-if="state.state === 'PREPARING'" class="text-caption"><q-spinner /> Lettura {{ state.loading_symbol || 'archivi' }} · {{ ((state.scanned_bytes || 0) / 1000000).toFixed(1) }} MB esaminati. Gli archivi grandi richiedono tempo; l'indice degli eventi è su disco.</div>
      <div v-if="state.invalid_lines" class="text-warning">{{ state.invalid_lines }} righe non valide o incomplete escluse.</div>
      <div v-if="state.req_addr" class="text-caption q-mt-sm">Client sulla stessa macchina: PROXY_ADDR={{ state.req_addr }} · proxy_pub_addr={{ state.pub_addr }}. Un simbolo o canale senza dati restituisce ERR. I client tardivi si aggiungono al clock corrente; il reset viene rifiutato se altri client sono collegati.</div>
      <q-table v-if="availableRows.length" :rows="availableRows" :columns="availableColumns" row-key="key" flat dense :pagination="{ rowsPerPage: 10 }" title="Canali disponibili nella sessione" class="q-mt-md" />
      <q-table v-if="state.clients?.length" :rows="state.clients" :columns="clientColumns" row-key="id" flat dense :pagination="{ rowsPerPage: 10 }" title="Client replay registrati" />
    </q-card-section>
    <q-separator />
    <q-card-section>
      <div class="row items-center q-col-gutter-md q-mb-sm"><div class="col-12 col-md"><div class="text-subtitle1">Flusso ricevuto dal proxy replay</div><div class="text-caption">Eventi ricevuti tramite una vera sottoscrizione PUB/SUB della dashboard, non riprodotti da un timer del browser. Grafico: campione di 500 eventi; tabella: ultimi 100. Ad alta velocità la visualizzazione non conserva ogni evento.</div></div><div class="col-12 col-md-3"><q-select v-model="viewSymbol" :options="Object.keys(state.available || {})" label="Simbolo visualizzato" outlined dense /></div></div>
      <OpenPositionChart :key="viewSymbol" :symbol="viewSymbol" :rows="visible" historical follow />
    </q-card-section>
  </q-card>
</template>
<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api } from 'boot/axios'
import OpenPositionChart from './OpenPositionChart.vue'
export default {
  components: { OpenPositionChart },
  props: { symbols: { type: Array, default: () => [] }, initialSymbol: { type: String, default: '' } },
  setup (props) {
    const state = ref({ state: 'STOPPED' }), selection = ref([]), date = ref(''), session = ref('ah'), speed = ref(60), remap = ref(false), busy = ref(false), error = ref(''), viewSymbol = ref('')
    let timer, polling = false, disposed = false
    const running = computed(() => !!state.value.running)
    const ready = computed(() => running.value && ['IDLE', 'REPLAYING', 'EOD_SIGNALED'].includes(state.value.state))
    const stateLabels = { STOPPED: 'Fermo', PREPARING: 'Preparazione archivi', IDLE: 'Pronto · in attesa di client', REPLAYING: 'Replay in corso', EOD_SIGNALED: 'Fine del flusso', ERROR: 'Errore replay' }
    const sessionOptions = [{ label: 'Intera giornata', value: 'all' }, { label: 'RTH · 09:30–16:00', value: 'rth' }, { label: 'AH · 16:00–20:00', value: 'ah' }]
    const speedOptions = [1, 10, 60, 600, 0].map(value => ({ value, label: value ? `${value}×` : 'Massima' }))
    const availableRows = computed(() => Object.entries(state.value.available || {}).flatMap(([symbol, channels]) => Object.entries(channels).map(([channel, count]) => ({ key: `${symbol}:${channel}`, symbol, channel, count }))))
    const availableColumns = [['symbol', 'Simbolo'], ['channel', 'Canale'], ['count', 'Eventi']].map(([name, label]) => ({ name, label, field: name, align: 'left' }))
    const clientColumns = [{ name: 'application', label: 'Applicazione', field: 'application', align: 'left' }, { name: 'id', label: 'Identità', field: 'id', align: 'left' }, { name: 'subscriptions', label: 'Canali registrati', field: row => row.subscriptions.map(s => `${s.symbol}:${s.channel}`).join(', '), align: 'left' }]
    const visible = computed(() => (state.value.preview?.rows || []).filter(row => row.symbol === viewSymbol.value))
    watch(() => props.initialSymbol, symbol => { if (symbol && !running.value) { selection.value = [symbol]; viewSymbol.value = symbol } }, { immediate: true })
    function apply (data) { state.value = data; if (!viewSymbol.value || !data.available?.[viewSymbol.value]) viewSymbol.value = Object.keys(data.available || {})[0] || ''; if (!selection.value.length && data.requested_symbols?.length) selection.value = data.requested_symbols }
    async function poll () {
      if (polling || disposed || busy.value) return
      polling = true
      try { const { data } = await api.get('/dyn/quote-monitor/replay'); if (!disposed) apply(data) } catch (e) { if (!disposed) error.value = e.response?.data?.error || e.message } finally { polling = false }
    }
    async function operation (fn) { busy.value = true; error.value = ''; try { await fn() } catch (e) { error.value = e.response?.data?.error || e.message } finally { busy.value = false; await poll() } }
    const prepare = () => operation(async () => { const { data } = await api.post('/dyn/quote-monitor/replay', { symbols: selection.value, date: date.value, session: session.value, speed: speed.value, remap_today: remap.value }); apply(data) })
    const control = action => operation(() => api.post('/dyn/quote-monitor/replay/control', { action }))
    const stop = () => operation(() => api.delete('/dyn/quote-monitor/replay'))
    onMounted(() => { poll(); timer = setInterval(poll, 1000) })
    onUnmounted(() => { disposed = true; clearInterval(timer) })
    return { state, selection, date, session, speed, remap, busy, error, viewSymbol, running, ready, stateLabels, sessionOptions, speedOptions, availableRows, availableColumns, clientColumns, visible, prepare, control, stop }
  }
}
</script>
