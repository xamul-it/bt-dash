<template>
  <q-page padding>
    <div class="row items-center q-col-gutter-md q-mb-md"><div class="col-12 col-md"><div class="text-h5">Registrazioni dei flussi</div><div class="text-caption">Archivio salvato · consultazione, replay su proxy dedicato e cancellazione</div></div><div class="col-auto"><q-btn label="Proxy in tempo reale" to="/ProxyAdministration" /></div><div class="col-auto"><q-btn label="Aggiorna archivio" icon="refresh" :loading="loading" @click="load" /></div></div>
    <q-banner v-if="error" class="bg-red-1 q-mb-md">{{ error }}</q-banner>
    <q-input v-model="search" label="Cerca simbolo registrato" outlined dense clearable class="q-mb-md" />
    <q-table :rows="archives" :columns="columns" :filter="search" row-key="symbol" :pagination="{ rowsPerPage: 15 }" flat bordered no-data-label="Nessuna registrazione disponibile" class="q-mb-md">
      <template #body-cell-actions="props"><q-td :props="props" class="q-gutter-xs"><q-btn flat dense label="Consulta" @click="open(props.row.symbol)" /><q-btn flat dense label="Replay ZMQ" @click="replaySymbol = props.row.symbol" /><q-btn flat dense color="negative" label="Cancella" @click="askDelete(props.row)" /></q-td></template>
    </q-table>
    <ReplayControl :symbols="archives.map(row => row.symbol)" :initial-symbol="replaySymbol" class="q-mb-md" />
    <q-card v-if="symbol" flat bordered><q-card-section>
      <div class="text-h6">{{ symbol }} · estratto finale</div>
      <div class="text-caption q-mb-md">Ultimi 500 eventi nel segmento finale di 2 MB. {{ partial ? 'Sono presenti altri dati nel file.' : '' }} Grafico fino a 500 eventi, tabella ultimi 100.</div>
      <MarketEventViewer :rows="displayed" />
    </q-card-section></q-card>
    <q-dialog v-model="deleteOpen" persistent><q-card style="width:500px; max-width:95vw"><q-card-section><div class="text-h6">Cancella registrazione {{ deleting?.symbol }}</div><p>Il file verrà eliminato definitivamente. Prima rimuovi il simbolo dalle applicazioni che lo hanno sottoscritto e arresta gli eventuali replay. La cancellazione non arresta i client.</p><q-input v-model="confirmation" label="Digita il simbolo per confermare" outlined /><div v-if="deleteError" class="text-negative q-mt-sm">{{ deleteError }}</div></q-card-section><q-card-actions align="right"><q-btn label="Annulla" flat v-close-popup :disable="deletingBusy" /><q-btn label="Elimina definitivamente" color="negative" :disable="confirmation !== deleting?.symbol" :loading="deletingBusy" @click="remove" /></q-card-actions></q-card></q-dialog>
  </q-page>
</template>
<script>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
import MarketEventViewer from '../components/MarketEventViewer.vue'
import ReplayControl from '../components/ReplayControl.vue'
export default {
  components: { MarketEventViewer, ReplayControl },
  setup () {
    const archives = ref([]), search = ref(''), error = ref(''), loading = ref(false), replaySymbol = ref('')
    const symbol = ref(''), displayed = ref([]), partial = ref(false)
    const deleteOpen = ref(false), deleting = ref(null), confirmation = ref(''), deleteError = ref(''), deletingBusy = ref(false)
    let generation = 0
    const columns = [{ name: 'symbol', label: 'Titolo', field: 'symbol', align: 'left', sortable: true }, { name: 'bytes', label: 'Dimensione MB', field: 'bytes', format: value => (value / 1000000).toLocaleString('it-IT', { maximumFractionDigits: 2 }), sortable: true }, { name: 'modified_at', label: 'Ultima scrittura · Roma', field: 'modified_at', format: value => new Date(value * 1000).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }), sortable: true }, { name: 'actions', label: 'Azioni', field: 'symbol' }]
    const failure = e => { error.value = e.response?.data?.error || e.message }
    async function load () { loading.value = true; error.value = ''; try { archives.value = (await api.get('/dyn/quote-monitor/archives')).data.rows } catch (e) { failure(e) } finally { loading.value = false } }
    async function open (value) {
      const token = ++generation
      error.value = ''
      try { const { data } = await api.get(`/dyn/quote-monitor/recordings/${encodeURIComponent(value)}`); if (token === generation) { symbol.value = value; displayed.value = data.rows; partial.value = data.truncated } } catch (e) { failure(e) }
    }
    function askDelete (row) { deleting.value = row; confirmation.value = ''; deleteError.value = ''; deleteOpen.value = true }
    async function remove () {
      deletingBusy.value = true; deleteError.value = ''
      try {
        await api.delete(`/dyn/quote-monitor/archives/${encodeURIComponent(deleting.value.symbol)}`, { data: { confirm_symbol: confirmation.value, version: deleting.value.version } })
        if (symbol.value === deleting.value.symbol) { generation++; symbol.value = '' }
        deleteOpen.value = false; await load()
      } catch (e) { deleteError.value = e.response?.data?.error || e.message } finally { deletingBusy.value = false }
    }
    onMounted(load)
    return { archives, search, error, loading, columns, load, open, symbol, displayed, partial, replaySymbol,
      deleteOpen, deleting, confirmation, deleteError, deletingBusy, askDelete, remove }
  }
}
</script>
