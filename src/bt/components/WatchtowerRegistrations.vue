<template>
  <q-card flat bordered class="q-mb-md"><q-card-section>
    <div class="text-h6">Registrazione flussi Watchtower</div>
    <div class="text-caption q-mb-md">Scegli i simboli da raccogliere in continuo: barre minute, bid/ask e tick. La raccolta continua a pagina chiusa. La selezione Watchtower è indipendente dalla lista Liquidità L1.</div>
    <q-banner v-if="error" class="bg-red-1 q-mb-sm">{{ error }}</q-banner>
    <div class="row items-start q-col-gutter-md"><div class="col-12 col-md"><q-select v-model="symbols" :options="options" multiple use-input use-chips new-value-mode="add-unique" label="Simboli richiesti da Watchtower" outlined hint="Ticker manuali oppure simboli della copertura caricata" /></div><div class="col-auto"><q-btn label="Salva simboli Watchtower" color="primary" :loading="busy" @click="save" /></div><div class="col-auto"><q-btn flat label="Amministrazione proxy" to="/ProxyAdministration" /></div></div>
    <div role="status" class="text-positive q-mt-sm">{{ notice }}</div>
  </q-card-section></q-card>
</template>
<script>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
export default {
  props: { options: { type: Array, default: () => [] } },
  setup () {
    const symbols = ref([]), error = ref(''), busy = ref(false), notice = ref('')
    const failure = e => { error.value = e.response?.data?.error || e.message }
    onMounted(async () => { try { symbols.value = (await api.get('/dyn/quote-monitor/registrations/watchtower')).data.symbols } catch (e) { failure(e) } })
    async function save () {
      busy.value = true; error.value = ''; notice.value = ''
      try { const { data } = await api.put('/dyn/quote-monitor/registrations/watchtower', { symbols: [...new Set(symbols.value.map(s => s.trim().toUpperCase()))] }); symbols.value = data.symbols; notice.value = 'Lista salvata. Il registratore applica la selezione entro pochi secondi.' } catch (e) { failure(e) } finally { busy.value = false }
    }
    return { symbols, error, busy, notice, save }
  }
}
</script>
