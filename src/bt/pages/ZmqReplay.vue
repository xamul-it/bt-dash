<template>
  <q-page padding>
    <div class="text-h5 q-mb-xs">Replay ZMQ</div><div class="text-body2 text-grey-7 q-mb-lg">Riproduci una registrazione di mercato e rendila disponibile ai client su un proxy dedicato.</div>
    <q-banner v-if="error" class="bg-red-1 q-mb-md">{{ error }}</q-banner>
    <ReplayControl :symbols="symbols" :initial-symbol="initialSymbol" />
  </q-page>
</template>
<script>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from 'boot/axios'
import ReplayControl from '../components/ReplayControl.vue'
export default {
  components: { ReplayControl },
  setup () {
    const route = useRoute(), symbols = ref([]), error = ref(''), initialSymbol = String(route.query.symbol || '')
    onMounted(async () => { try { symbols.value = (await api.get('/dyn/quote-monitor/archives')).data.rows.map(row => row.symbol) } catch (e) { error.value = e.response?.data?.error || e.message } })
    return { symbols, error, initialSymbol }
  }
}
</script>
