<template>
  <div>
    <div class="row items-center q-col-gutter-md q-mb-sm">
      <div class="col-12 col-md-5"><q-select v-model="account" :options="accountOptions" label="Conto delle posizioni aperte" emit-value map-options outlined dense :loading="loading" /></div>
      <div class="col-12 col-md-7 text-caption">{{ historical ? 'Riferimento: posizioni aperte adesso, non alla data dello storico o del replay.' : 'Posizioni attuali · aggiornamento ogni 30 secondi.' }} Linee viola: prezzo medio di carico.</div>
    </div>
    <div v-if="error" class="text-negative text-caption q-mb-sm" role="status">{{ error }}</div>
    <div v-if="!loading && !positions.length && !error" class="text-caption text-grey-7 q-mb-sm">Nessuna posizione aperta per {{ symbol || 'il simbolo selezionato' }} nei conti selezionati.</div>
    <slot :positions="positions" :fills="fills" :fillsNote="fillsNote"><MarketEventViewer v-bind="$attrs" :start="start" :end="end" :positions="positions" /></slot>
  </div>
</template>
<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api } from 'boot/axios'
import MarketEventViewer from './MarketEventViewer.vue'
export default {
  inheritAttrs: false,
  components: { MarketEventViewer },
  props: { symbol: String, historical: Boolean, start: Number, end: Number },
  setup (props) {
    const contexts = ref([]), account = ref(props.historical ? null : 'all'), holdings = ref([]), loading = ref(false), error = ref(''), fills = ref([]), fillsNote = ref('')
    let timer, disposed = false, request = 0, fillRequest = 0
    const label = row => `${row.display_name || row.portfolio_key_id} · ${row.paper ? 'Paper' : 'Reale'}`
    const accountOptions = computed(() => [{ value: 'all', label: 'Tutti i conti' }, ...contexts.value.map(row => ({ value: row.portfolio_key_id, label: label(row) }))])
    const positions = computed(() => holdings.value.filter(row => row.symbol === props.symbol && Number(row.avg_entry_price) > 0 && Number(row.qty) !== 0))
    async function refresh () {
      const current = ++request
      loading.value = true; error.value = ''
      const selected = contexts.value.filter(row => account.value === 'all' || row.portfolio_key_id === account.value)
      const results = await Promise.allSettled(selected.map(async row => {
        const { data } = await api.get('/dyn/al/portfolio', { params: { portfolio_key_id: row.portfolio_key_id } })
        return (data.positions || []).map(position => ({ ...position, account: label(row), accountId: row.portfolio_key_id }))
      }))
      if (disposed || current !== request) return
      holdings.value = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
      const failed = results.flatMap((result, i) => result.status === 'rejected' ? [label(selected[i])] : [])
      error.value = failed.length ? `Posizioni non disponibili per: ${failed.join(', ')}.` : ''
      loading.value = false
    }
    async function loadFills () {
      const token = ++fillRequest
      fills.value = []; fillsNote.value = ''
      if (!props.historical || !account.value || props.start == null || props.end == null) return
      const selected = contexts.value.filter(row => account.value === 'all' || row.portfolio_key_id === account.value)
      try {
        const results = await Promise.all(selected.map(async row => {
          const { data } = await api.get('/dyn/al/activities', { params: {
            portfolio_key_id: row.portfolio_key_id, symbol: props.symbol, activity_types: 'FILL',
            after: new Date(props.start * 1000).toISOString(), until: new Date(props.end * 1000).toISOString(),
            direction: 'asc', fetch_all: true, max_pages: 20, page_size: 100, prefer_cache: true,
          } })
          return { ...data, activities: (data.activities || []).filter(fill => fill.symbol === props.symbol).map(fill => ({ ...fill, account: label(row) })) }
        }))
        if (disposed || token !== fillRequest) return
        fills.value = results.flatMap(result => result.activities)
        fillsNote.value = results.some(result => result.truncated || result.cache?.mode !== 'remote+cached')
          ? 'Eseguiti disponibili: la cache o i limiti di caricamento possono non coprire tutto il periodo.' : ''
      } catch (e) { if (token === fillRequest && !disposed) fillsNote.value = 'Eseguiti non disponibili per il periodo selezionato.' }
    }
    watch(account, () => { holdings.value = []; refresh(); loadFills() })
    watch(() => [props.start, props.end, props.symbol], loadFills)
    onMounted(async () => {
      try { const { data } = await api.get('/dyn/al/contexts'); if (disposed) return; contexts.value = data; if (props.historical) account.value = data.find(row => row.paper === false)?.portfolio_key_id || null; else await refresh(); if (!disposed) timer = setInterval(refresh, 30000) }
      catch (e) { if (!disposed) { error.value = e.response?.data?.error || e.message; loading.value = false } }
    })
    onUnmounted(() => { disposed = true; request++; fillRequest++; clearInterval(timer) })
    return { account, accountOptions, positions, fills, fillsNote, loading, error }
  }
}
</script>
