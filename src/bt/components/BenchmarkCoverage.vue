<template>
  <div v-if="benchmark" class="benchmark-coverage">
    <div>Periodo comune effettivo: {{ benchmark.first_date || '—' }} → {{ benchmark.last_date || '—' }}</div>
    <div class="text-caption">Il Buy&amp;Hold usa tutti i titoli della lista: l’inizio dipende dal titolo con lo storico più recente, la fine da quello con l’ultima quotazione più vecchia. La data di aggiornamento indica quando è stato calcolato il file.</div>
    <q-btn flat dense no-caps color="primary" label="Perché queste date?" icon="info_outline" :loading="loading" @click="inspect" />
    <q-dialog v-model="open">
      <q-card style="width: 720px; max-width: 95vw">
        <q-bar><div>Copertura benchmark</div><q-space /><q-btn flat icon="close" aria-label="Chiudi copertura" v-close-popup /></q-bar>
        <q-card-section>
          <div class="text-subtitle1">{{ benchmark.label }}</div>
          <div>Data iniziale richiesta: {{ definition?.fromdate || '—' }}</div>
          <div>Serie pubblicata: {{ benchmark.first_date }} → {{ benchmark.last_date }}</div>
          <div class="q-mt-sm">Il calcolo conserva tutti i titoli e utilizza il loro periodo comune. Impostare una data precedente non crea quotazioni prima dell’inizio dello storico disponibile.</div>
          <q-banner v-if="error" class="bg-red-1 text-red-9 q-mt-md">{{ error }}</q-banner>
          <template v-else>
            <div class="text-subtitle2 q-mt-md">Limiti riscontrati nei dati locali attuali</div>
            <div v-if="limits.start.length">Inizio limitato da: <strong>{{ limits.start.join(', ') }}</strong> · {{ benchmark.first_date }}</div>
            <div v-if="limits.end.length">Fine limitata da: <strong>{{ limits.end.join(', ') }}</strong> · {{ benchmark.last_date }}</div>
            <div v-if="!limits.start.length && !limits.end.length">I dati locali non mostrano più i limiti della serie pubblicata: ricalcolare per aggiornare il benchmark.</div>
            <div v-if="limits.missing.length" class="text-negative">Dati mancanti o non leggibili: {{ limits.missing.join(', ') }}</div>
            <div class="text-caption text-grey-7 q-mt-sm">Per estendere il periodo servono dati disponibili per tutti i titoli, oppure una modifica esplicita della lista. Ricalcolare con gli stessi dati conserva questi limiti.</div>
          </template>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { api } from 'boot/axios'
import { benchmarkLimits } from '../utils/benchmarkCoverage.mjs'
export default {
  name: 'BenchmarkCoverage',
  props: { benchmark: { type: Object, default: null }, definition: { type: Object, default: null } },
  data() { return { loading: false, open: false, error: '', inventory: [] } },
  computed: { limits() { return benchmarkLimits(this.inventory, this.benchmark) } },
  methods: {
    async inspect() {
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.get('/dyn/simulations/data', { params: {
          ticker: this.benchmark.symbols?.join(',') || this.definition?.ticker,
          provider: this.benchmark.provider || this.definition?.provider,
          feed: this.benchmark.alpaca_feed || this.definition?.alpaca_feed || 'sip',
          timeframe: 'daily',
        } })
        this.inventory = data
      } catch (error) { this.error = error.response?.data?.error || error.message }
      finally { this.loading = false; this.open = true }
    },
  },
}
</script>
<style scoped>
.benchmark-coverage { white-space: normal; overflow-wrap: anywhere; max-width: 660px; }
</style>
