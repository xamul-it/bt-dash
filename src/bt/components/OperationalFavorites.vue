<template>
  <section class="q-mb-lg" :aria-label="title">
    <div class="row items-center q-mb-sm"><div class="text-h6 col">{{ title }}</div><q-space /><q-btn flat round color="primary" icon="list" aria-label="Vedi tutti" :to="destination"><q-tooltip>Vedi tutti</q-tooltip></q-btn><q-btn flat round icon="refresh" aria-label="Aggiorna" :loading="loading" @click="load" /></div>
    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-sm">{{ error }}</q-banner>
    <div v-if="!visibleRows.length && !loading && !error" class="text-grey-7 q-pa-md bg-white rounded-borders">Nessun preferito. Usa la stella nel monitoraggio per aggiungerlo alla dashboard.</div>
    <div class="row q-col-gutter-md">
      <div v-for="row in visibleRows" :key="row.id" class="col-12">
        <q-card flat bordered class="full-height">
          <q-card-section class="row items-center bg-grey-1"><div class="col"><div class="text-h6">{{ row.label }}</div><div class="text-caption">{{ row.strategy }}</div></div><DashboardFavorite :kind="kind" :id="row.id" /></q-card-section>
          <q-card-section>
            <q-banner v-if="row.error" class="bg-red-1 text-negative">{{ row.error }}</q-banner>
            <CronPerformanceBoxes v-else-if="kind === 'cron'" :value="row.detail || {}" />
            <template v-else>
              <div class="text-caption text-grey-7">Finestra: {{ windowOpen || 'Nessuna finestra disponibile' }}</div>
              <div class="q-my-sm">{{ row.chain_run_count ?? '—' }} sequenze · {{ row.run_count ?? '—' }} run</div>
              <div v-if="!row.detail?.factsheet?.performance_rows?.length" class="text-grey-7">Performance non disponibile per questa finestra.</div>
              <div v-for="sample in (row.detail?.factsheet?.performance_rows || []).slice(0, 2)" :key="sample.group" class="q-mb-sm">
                <b>{{ sample.group }}</b> · Trade: {{ sample.sample_size ?? sample.count ?? '—' }}
                <div>Win rate: {{ percent(sample.win_rate) }} · Gain medio/trade: {{ percent(sample.mean) }}</div>
              </div>
            </template>
          </q-card-section>
          <q-separator /><q-card-actions><q-btn flat color="primary" label="Apri monitoraggio" icon="insights" :to="{ path: destination, query: kind === 'cron' ? { profile: row.id } : { portfolio: row.id } }" /></q-card-actions>
        </q-card>
      </div>
    </div>
  </section>
</template>
<script>
import { api } from 'boot/axios'
import CronPerformanceBoxes from './CronPerformanceBoxes.vue'
import DashboardFavorite from './DashboardFavorite.vue'
import { dashboardFavorites, loadDashboardFavorites, isDashboardFavorite } from '../utils/dashboardFavorites'
export default {
  components: { DashboardFavorite, CronPerformanceBoxes },
  props: { kind: { type: String, required: true }, title: { type: String, required: true } },
  data: () => ({ rows: [], error: '', loading: false, timer: null, windowOpen: null }),
  computed: {
    destination() { return this.kind === 'cron' ? '/Watchtower/CronMonitoring' : '/Watchtower' },
    visibleRows() { return this.rows.filter(row => isDashboardFavorite(this.kind, row.id)) },
  },
  mounted() { this.load(); this.timer = window.setInterval(() => this.load(), 30000) },
  beforeUnmount() { window.clearInterval(this.timer) },
  methods: {
    percent(value) { return value == null ? '—' : `${Number(value).toFixed(2)}%` },
    async load() {
      if (this.loading) return
      this.loading = true
      try {
        await loadDashboardFavorites(true)
        const ids = dashboardFavorites.values[this.kind] || []
        if (!ids.length) { this.rows = []; this.error = ''; return }
        let catalog
        if (this.kind === 'cron') catalog = (await api.get('/dyn/obs/watchtower/cron/profiles')).data
        else {
          const { data } = await api.get('/dyn/obs/watchtower/windows')
          this.windowOpen = data?.[0]?.window_open || null
          catalog = this.windowOpen ? (await api.get('/dyn/obs/watchtower/portfolio-contexts', { params: { window_open: this.windowOpen } })).data : []
        }
        this.rows = await Promise.all(ids.map(async id => {
          const item = catalog.find(row => (this.kind === 'cron' ? row.profile : row.portfolio_key_id) === id)
          const row = { ...item, id, label: item?.display_name || item?.profile || id }
          if (!item) return { ...row, error: 'Nessuna evidenza disponibile per questo preferito nella selezione corrente.' }
          try {
            row.detail = (await api.get(this.kind === 'cron'
              ? `/dyn/obs/watchtower/cron/${encodeURIComponent(id)}/performance`
              : '/dyn/obs/watchtower/coherence-summary',
            { params: this.kind === 'cron' ? {} : { window_open: this.windowOpen, portfolio_key_id: id } })).data
          } catch (e) { row.error = e.response?.data?.error || e.message }
          return row
        }))
        this.error = ''
      } catch (e) { this.error = `Aggiornamento non riuscito: ${e.response?.data?.error || e.message}. I dati già mostrati potrebbero non essere aggiornati.` }
      finally { this.loading = false }
    },
  },
}
</script>
