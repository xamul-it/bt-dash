<template>
  <q-expansion-item icon="cloud_download" label="Scarica quote storiche da Alpaca" class="q-mt-lg" group="archive-tools"><q-card flat bordered><q-card-section>
    <div class="text-caption text-grey-7 q-mb-md">Quote SIP della sessione AH 16:00–20:00 America/New_York. Il download è in pagine JSONL da massimo 10.000 quote; i file vengono salvati sul tuo dispositivo.</div>
    <q-banner v-if="error" class="bg-red-1 q-mb-md">{{ error }}</q-banner>
    <div class="row items-start q-col-gutter-md"><div class="col-12 col-md-4"><q-select v-model="context" :options="contexts" option-value="portfolio_key_id" :option-label="item => item.display_name || item.portfolio_key_id" emit-value map-options label="Conto Alpaca per lo storico" outlined dense /></div><div class="col-6 col-md-2"><q-input v-model="symbol" label="Ticker storico" outlined dense /></div><div class="col-6 col-md-3"><q-input v-model="date" type="date" label="Data della sessione USA" outlined dense /></div><div class="col-auto"><q-btn label="Scarica prima pagina" :disable="!context || !symbol || !date" :loading="busy" @click="download(false)" /></div><div class="col-auto"><q-btn v-if="token" label="Pagina successiva" :loading="busy" @click="download(true)" /></div></div><div role="status" class="text-caption q-mt-md">{{ message }}</div>
  </q-card-section></q-card></q-expansion-item>
</template>
<script>
import { onMounted, ref } from 'vue'
import { api } from 'boot/axios'
export default {
  setup () {
    const contexts = ref([]), context = ref(null), symbol = ref(''), date = ref(''), token = ref(null), busy = ref(false), error = ref(''), message = ref('')
    let query, page = 0
    onMounted(async () => { try { contexts.value = (await api.get('/dyn/al/contexts')).data } catch (e) { error.value = e.response?.data?.error || e.message } })
    async function download (next) {
      busy.value = true; error.value = ''
      try {
        if (!next) { query = { symbol: symbol.value.trim().toUpperCase(), date: date.value, portfolio_key_id: context.value }; token.value = null; page = 0 }
        const { data } = await api.get(`/dyn/quote-monitor/history/${encodeURIComponent(query.symbol)}`, { params: { ...query, page_token: next ? token.value : undefined }, timeout: 40000 })
        page++; token.value = data.next_page_token
        const url = URL.createObjectURL(new Blob([data.rows.map(row => JSON.stringify({ ...row, symbol: data.symbol, feed: data.feed })).join('\n') + '\n'], { type: 'application/x-ndjson' }))
        const link = document.createElement('a'); link.href = url; link.download = `${data.symbol}_${data.date}_AH_sip_${page}.jsonl`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        message.value = `${data.symbol} · ${data.date} · Pagina ${page}: ${data.rows.length} quote. ${token.value ? 'Sono disponibili altre pagine.' : 'Sessione scaricata.'}`
      } catch (e) { error.value = e.response?.data?.error || e.message } finally { busy.value = false }
    }
    return { contexts, context, symbol, date, token, busy, error, message, download }
  }
}
</script>
