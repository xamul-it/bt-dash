<template>
  <div>
    <div class="row q-col-gutter-sm items-start">
      <div class="col-12 col-md-4"><q-select v-model="list" :options="lists" option-value="ticker" option-label="label" emit-value map-options clearable outlined dense label="Lista ticker" @update:model-value="loadMembers" /></div>
      <div class="col-12 col-md"><q-select :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :options="options" :multiple="multiple" use-input :use-chips="multiple" input-debounce="200" @filter="filter" @new-value="addValue" new-value-mode="add-unique" option-value="symbol" :option-label="assetLabel" emit-value map-options outlined dense label="Cerca simbolo o nome Alpaca" :loading="loading" hint="Puoi anche scrivere un simbolo e premere Invio" /></div>
    </div>
    <div v-if="error" class="text-warning q-mt-sm">{{ error }}</div>
    <q-card v-if="list" flat bordered class="q-mt-md">
      <q-card-section class="q-pb-sm"><div class="row items-center"><div class="col"><div class="text-subtitle1">Titoli della lista {{ listLabel }}</div><div class="text-caption text-grey-7">{{ multiple ? 'Seleziona i titoli da aggiungere alla registrazione.' : 'Seleziona un titolo da osservare nei flussi live.' }}</div></div><q-btn v-if="multiple && members && members.length" flat dense color="primary" label="Seleziona tutti" @click="selectAll" /></div></q-card-section>
      <q-card-section v-if="membersLoading" class="text-grey-7">Caricamento titoli…</q-card-section>
      <q-card-section v-else-if="members && !members.length" class="text-grey-7">Nessun titolo attivo nella lista.</q-card-section>
      <q-list v-else-if="members" separator style="max-height: 300px; overflow-y: auto">
        <q-item v-for="asset in memberAssets" :key="asset.symbol" clickable @click="choose(asset.symbol)"><q-item-section side><q-checkbox v-if="multiple" :model-value="selectedSymbols.includes(asset.symbol)" :aria-label="'Seleziona ' + asset.symbol" @click.stop @update:model-value="v => choose(asset.symbol, v)" /><q-radio v-else :model-value="modelValue" :val="asset.symbol" :aria-label="'Seleziona ' + asset.symbol" @click.stop @update:model-value="choose(asset.symbol)" /></q-item-section><q-item-section><q-item-label>{{ asset.symbol }}<span v-if="asset.name"> · {{ asset.name }}</span></q-item-label><q-item-label caption>{{ asset.exchange || 'Dettagli Alpaca non disponibili' }}<span v-if="asset.status"> · {{ asset.status }}</span></q-item-label></q-item-section></q-item>
      </q-list>
    </q-card>
  </div>
</template>
<script>
import { api } from 'boot/axios'
import { listAssetOptions, toggleListSymbol } from '../utils/marketAssetSelection.mjs'
export default {
  props: { modelValue: { default: null }, multiple: Boolean },
  emits: ['update:modelValue'],
  data () { return { lists: [], list: null, members: null, membersLoading: false, assets: [], options: [], loading: false, error: '', memberRequest: 0 } },
  computed: {
    selectedSymbols () { return Array.isArray(this.modelValue) ? this.modelValue : [] },
    memberAssets () { return listAssetOptions(this.members || [], this.assets) },
    listLabel () { return this.lists.find(item => item.ticker === this.list)?.label || this.list }
  },
  async mounted () {
    this.loading = true
    const [assets, lists] = await Promise.allSettled([api.get('/dyn/quote-monitor/assets'), api.get('/dyn/simulations/ticker-lists')])
    if (assets.status === 'fulfilled') this.assets = assets.value.data.rows
    else this.error = 'Catalogo Alpaca non disponibile: puoi usare le liste o inserire un simbolo manualmente.'
    if (lists.status === 'fulfilled') this.lists = lists.value.data
    else this.error += ' Liste ticker non disponibili.'
    this.loading = false
  },
  methods: {
    assetLabel (a) { return typeof a === 'string' ? a : `${a.symbol} · ${a.name || '—'} · ${a.exchange || '—'} · ${a.status || '—'}` },
    async loadMembers () {
      const request = ++this.memberRequest
      this.members = null
      this.membersLoading = !!this.list
      if (!this.list) return
      try { const result = await api.get(`/dyn/simulations/ticker-lists/${encodeURIComponent(this.list)}/members`); if (request === this.memberRequest) this.members = result.data.active } catch (e) { if (request === this.memberRequest) { this.members = []; this.error = e.response?.data?.error || e.message } } finally { if (request === this.memberRequest) this.membersLoading = false }
    },
    filter (val, update) { update(() => { const q = val.trim().toUpperCase(); const assets = this.members ? this.memberAssets : this.assets; this.options = assets.filter(a => !q || `${a.symbol} ${a.name}`.toUpperCase().includes(q)).slice(0, 100) }) },
    choose (symbol, value) { if (this.multiple) this.$emit('update:modelValue', toggleListSymbol(this.selectedSymbols, symbol, value === undefined ? !this.selectedSymbols.includes(symbol) : value)); else this.$emit('update:modelValue', symbol) },
    selectAll () { this.$emit('update:modelValue', [...new Set([...this.selectedSymbols, ...this.members])]) },
    addValue (val, done) { const s = val.trim().toUpperCase(); if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(s)) done(s, this.multiple ? 'add-unique' : 'add'); else done() }
  }
}
</script>
