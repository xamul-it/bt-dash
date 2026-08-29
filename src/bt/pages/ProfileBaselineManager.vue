<template>
  <q-page class="q-pa-md">
    <div class="text-h5">Strategie Schedulate — Gestione baseline</div>
    <div class="text-caption text-grey-7 q-mb-md">
      Baseline statistiche on-demand (run di backtest su finestra lunga). Servono come
      riferimento per il confronto di stabilità nella pagina Configurazione.
    </div>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-md-4">
          <q-select
            v-model="selectedProfile" use-input fill-input hide-selected hide-dropdown-icon
            clearable input-debounce="0" new-value-mode="add-unique" :options="filteredOptions"
            label="Profilo" outlined dense
            @filter="filterProfiles" @input-value="v => profileText = v || ''"
            @update:model-value="v => { profileText = v || ''; loadBaselines() }"
            @clear="() => { profileText = ''; baselines = [] }"
          />
        </div>
        <div class="col-auto">
          <q-btn flat round icon="refresh" :loading="loading" :disable="!profile" @click="loadBaselines" />
        </div>
      </q-card-section>
    </q-card>

    <template v-if="profile">
      <q-banner v-if="loadError" class="bg-red-1 text-red-9 q-mb-md" rounded>{{ loadError }}</q-banner>

      <q-card flat bordered class="q-mb-md">
        <q-card-section class="text-subtitle2 text-grey-8">Nuova baseline per <code>{{ profile }}</code></q-card-section>
        <q-separator />
        <q-card-section class="row q-col-gutter-md items-end">
          <div class="col-12 col-md-3">
            <q-input v-model="form.label" label="Nome (label)" outlined dense />
          </div>
          <div class="col-6 col-md-2">
            <q-input v-model="form.window_start" label="Data inizio" mask="####-##-##" outlined dense hint="YYYY-MM-DD" />
          </div>
          <div class="col-6 col-md-2">
            <q-input v-model="form.window_end" label="Data fine" mask="####-##-##" outlined dense hint="YYYY-MM-DD" />
          </div>
          <div class="col-6 col-md-2">
            <q-input v-model="form.as_of_date" label="Versione (as-of)" mask="####-##-##" outlined dense
                     hint="opz. — STRATARGS a questa data" />
          </div>
          <div class="col-auto">
            <q-btn color="primary" label="Calcola" icon="play_arrow" :loading="jobRunning"
                   :disable="!canSubmit" @click="startJob" />
          </div>
          <div class="col-12">
            <div class="text-caption text-grey-6">
              Il backtest gira sul codice corrente del checkout (solo i parametri sono storicizzati alla data as-of).
            </div>
            <div v-if="jobState" class="text-body2 q-mt-xs" :class="jobStateClass">{{ jobStateText }}</div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section class="text-subtitle2 text-grey-8">Baseline esistenti</q-card-section>
        <q-separator />
        <q-table :rows="baselines" :columns="columns" row-key="id" dense flat
                 :pagination="{ rowsPerPage: 10 }" :loading="loading">
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn flat dense round icon="delete" color="negative" @click="removeBaseline(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card>
    </template>

    <div v-else class="text-grey-6 q-pa-lg text-center">Digita un profilo per gestirne le baseline.</div>
  </q-page>
</template>

<script>
import { api } from 'boot/axios'
import { Notify } from 'quasar'

export default {
  name: 'ProfileBaselineManager',
  data() {
    return {
      knownProfiles: [], filteredOptions: [], selectedProfile: null, profileText: '',
      baselines: [], loading: false, loadError: '',
      form: { label: '', window_start: '2000-01-01', window_end: `${new Date().getFullYear()}-01-01`, as_of_date: '' },
      jobId: null, jobState: null, jobTimer: null,
    }
  },
  computed: {
    profile() { return (this.profileText || '').trim() },
    columns() {
      return [
        { name: 'label', label: 'Nome', field: 'label', align: 'left' },
        { name: 'window', label: 'Finestra', field: (r) => `${r.window_start} → ${r.window_end}`, align: 'left' },
        { name: 'as_of_date', label: 'Versione as-of', field: 'as_of_date', align: 'left' },
        { name: 'sample_size', label: 'Trade', field: 'sample_size', align: 'right' },
        { name: 'created_at', label: 'Calcolata', field: (r) => String(r.created_at || '').slice(0, 16).replace('T', ' '), align: 'left' },
        { name: 'actions', label: '', field: 'actions', align: 'right' },
      ]
    },
    canSubmit() {
      return this.profile && this.form.label.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(this.form.window_start) && /^\d{4}-\d{2}-\d{2}$/.test(this.form.window_end)
    },
    jobRunning() { return this.jobState && !this.jobState.done },
    jobStateText() {
      if (!this.jobState) return ''
      const s = this.jobState
      if (s.status === 'completed') return `Baseline creata (id ${s.baseline_id}).`
      if (s.status === 'failed') return `Job fallito: ${s.error || 'errore sconosciuto'}`
      return 'Backtest in corso… (può richiedere minuti)'
    },
    jobStateClass() {
      if (!this.jobState) return ''
      return { completed: 'text-positive', failed: 'text-negative' }[this.jobState.status] || 'text-grey-8'
    },
  },
  mounted() { this.loadProfiles() },
  beforeUnmount() { if (this.jobTimer) clearInterval(this.jobTimer) },
  methods: {
    async loadProfiles() {
      try {
        const { data } = await api.get('/dyn/obs/watchtower/cron/profiles')
        this.knownProfiles = (data || []).map((p) => p.profile).filter(Boolean)
      } catch (e) { this.knownProfiles = [] }
    },
    filterProfiles(val, update) {
      update(() => {
        const n = (val || '').toLowerCase()
        this.filteredOptions = n ? this.knownProfiles.filter((p) => p.toLowerCase().includes(n)) : this.knownProfiles.slice()
      })
    },
    async loadBaselines() {
      if (!this.profile) return
      this.loading = true; this.loadError = ''
      try {
        const { data } = await api.get(`/dyn/obs/watchtower/cron/${encodeURIComponent(this.profile)}/baselines`)
        this.baselines = data || []
      } catch (e) {
        this.loadError = `Impossibile caricare le baseline: ${e?.message || e}`; this.baselines = []
      } finally { this.loading = false }
    },
    async startJob() {
      try {
        const { data } = await api.post(`/dyn/obs/watchtower/cron/${encodeURIComponent(this.profile)}/baselines`, {
          label: this.form.label.trim(),
          window_start: this.form.window_start,
          window_end: this.form.window_end,
          as_of_date: this.form.as_of_date || undefined,
        })
        this.jobId = data.job_id
        this.jobState = data
        this.pollJob()
      } catch (e) {
        Notify.create({ type: 'negative', message: e?.response?.data?.error || e?.message || 'Errore avvio job' })
      }
    },
    pollJob() {
      if (this.jobTimer) clearInterval(this.jobTimer)
      this.jobTimer = setInterval(async () => {
        try {
          const { data } = await api.get(`/dyn/obs/watchtower/cron/baselines/jobs/${this.jobId}`)
          this.jobState = data
          if (data.done) {
            clearInterval(this.jobTimer); this.jobTimer = null
            if (data.status === 'completed') { this.form.label = ''; this.loadBaselines() }
          }
        } catch (e) { clearInterval(this.jobTimer); this.jobTimer = null }
      }, 3000)
    },
    async removeBaseline(row) {
      try {
        await api.delete(`/dyn/obs/watchtower/cron/${encodeURIComponent(this.profile)}/baselines/${row.id}`)
        Notify.create({ type: 'positive', message: `Baseline "${row.label}" eliminata`, timeout: 1200 })
        this.loadBaselines()
      } catch (e) {
        Notify.create({ type: 'negative', message: `Eliminazione non riuscita: ${e?.message || e}` })
      }
    },
  },
}
</script>
