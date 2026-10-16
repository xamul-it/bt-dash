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
            @update:model-value="onProfileChange"
            @clear="onProfileClear"
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
            <q-input v-model="form.label" label="Nome (label)" outlined dense
                     :error="duplicateLabel" error-message="Esiste già una baseline con questa label." />
          </div>
          <div class="col-6 col-md-2">
            <q-input v-model="form.window_start" label="Data inizio" mask="####-##-##" outlined dense hint="YYYY-MM-DD" />
          </div>
          <div class="col-6 col-md-2">
            <q-input v-model="form.window_end" label="Data fine" mask="####-##-##" outlined dense hint="YYYY-MM-DD" />
          </div>
          <div class="col-auto">
            <q-btn color="primary" label="Calcola" icon="play_arrow" :loading="jobRunning"
                   :disable="!canSubmit" @click="startJob" />
          </div>
          <div class="col-12">
            <div class="text-caption text-grey-6">
              La baseline acquisisce codice e configurazione correnti. Il checkout deve essere pulito e identificabile.
            </div>
            <div v-if="jobState" class="text-body2 q-mt-xs" :class="jobStateClass">{{ jobStateText }}</div>
            <div v-if="jobState" class="text-caption text-grey-7">
              Fase {{ jobState.phase || jobState.status }} · heartbeat {{ formatTimestamp(jobState.heartbeat_at || jobState.updated_at) }}
              · <q-btn flat dense no-caps color="primary" label="Log" @click="openJobLog" />
            </div>
            <div v-if="pollError" class="text-caption text-negative">Errore di monitoraggio: {{ pollError }}</div>
          </div>
        </q-card-section>
      </q-card>

      <q-card flat bordered>
        <q-card-section class="text-subtitle2 text-grey-8">Baseline esistenti</q-card-section>
        <q-separator />
        <q-table :rows="baselines" :columns="columns" row-key="id" dense flat
                 :pagination="{ rowsPerPage: 10 }" :loading="loading">
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge :color="compatibilityColor(props.row.compatibility)" :label="compatibilityLabel(props.row.compatibility)" />
            </q-td>
          </template>
          <template #body-cell-run="props">
            <q-td :props="props">
              <div>Leva: {{ runValue(props.row, 'margin_leverage') }}× · Esposizione: {{ exposureValue(props.row) }}×</div>
              <div class="text-caption text-grey-7">Cooldown: {{ cooldownValue(props.row) }}</div>
            </q-td>
          </template>
          <template #body-cell-actions="props">
            <q-td :props="props">
              <q-btn flat dense no-caps icon="description" label="stats.html" color="primary"
                     :href="statsUrl(props.row) || undefined" target="_blank" rel="noopener noreferrer"
                     :disable="!statsUrl(props.row)">
                <q-tooltip>Apri il report del run salvato</q-tooltip>
              </q-btn>
              <q-btn flat dense no-caps icon="info" label="Parametri run" color="primary" @click="showDetail(props.row)">
                <q-tooltip>Configurazione e parametri effettivamente salvati nel run</q-tooltip>
              </q-btn>
              <q-btn flat dense round icon="delete" color="negative" @click="removeBaseline(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card>

      <q-dialog v-model="detailDialog" maximized>
        <q-card v-if="selectedBaselineDetail">
          <q-bar>
            <div>Ricevuta baseline — {{ selectedBaselineDetail.label }}</div>
            <q-space />
            <q-btn dense flat icon="close" v-close-popup />
          </q-bar>
          <q-card-section class="q-gutter-md">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6"><b>Commit applicazione:</b> <code>{{ selectedBaselineDetail.code_commit || 'legacy/non disponibile' }}</code></div>
              <div class="col-12 col-md-6"><b>Commit bt-core:</b> <code>{{ selectedBaselineDetail.core_commit || 'legacy/non disponibile' }}</code></div>
              <div class="col-12"><b>Hash configurazione:</b> <code>{{ selectedBaselineDetail.configuration_hash || 'legacy/non disponibile' }}</code></div>
              <div class="col-12"><b>Run ID:</b> <code>{{ selectedBaselineDetail.run_id || 'non disponibile' }}</code></div>
              <div class="col-12">
                <b>Leva broker:</b> {{ runValue(selectedBaselineDetail, 'margin_leverage') }}× ·
                <b>Esposizione massima:</b> {{ exposureValue(selectedBaselineDetail) }}× ·
                <b>Cooldown:</b> {{ cooldownValue(selectedBaselineDetail) }}
              </div>
              <div class="col-12">
                <q-btn v-if="statsUrl(selectedBaselineDetail)" outline no-caps color="primary" icon="open_in_new"
                       label="Apri stats.html" :href="statsUrl(selectedBaselineDetail)"
                       target="_blank" rel="noopener noreferrer" />
              </div>
              <div class="col-12" v-if="selectedBaselineDetail.result_snapshot?.param_outpath"><b>Output run:</b> <code>{{ selectedBaselineDetail.result_snapshot.param_outpath }}</code></div>
            </div>
            <q-separator />
            <div><b>Stato:</b> {{ compatibilityLabel(selectedBaselineDetail.compatibility) }}</div>
            <div v-if="selectedBaselineDetail.compatibility?.differences?.length" class="text-orange-10">
              Differenze: {{ selectedBaselineDetail.compatibility.differences.join(', ') }}
            </div>
            <div class="text-caption text-grey-7">Valori salvati da questa esecuzione, indipendenti dalla configurazione corrente del profilo. Per le baseline legacy alcuni valori possono non essere disponibili.</div>
            <div class="text-subtitle2">Parametri strategia richiesti</div>
            <pre class="baseline-json">{{ formatJson(selectedBaselineDetail.params) }}</pre>
            <div class="text-subtitle2">Parametri strategia effettivi (inclusi i default)</div>
            <pre class="baseline-json">{{ formatJson(selectedBaselineDetail.effective_params) }}</pre>
            <div class="text-subtitle2">Configurazione del run</div>
            <pre class="baseline-json">{{ formatJson(selectedBaselineDetail.run_config) }}</pre>
            <div class="text-subtitle2">Universo effettivo</div>
            <pre class="baseline-json">{{ formatJson(selectedBaselineDetail.result_snapshot?.tickers || []) }}</pre>
            <div class="text-subtitle2">Artefatti e hash</div>
            <pre class="baseline-json">{{ formatJson(selectedBaselineDetail.artifact_manifest || []) }}</pre>
          </q-card-section>
        </q-card>
      </q-dialog>

      <q-dialog v-model="logDialog">
        <q-card style="min-width: 700px; max-width: 95vw">
          <q-card-section class="row items-center q-pb-none"><div class="text-h6">Log creazione baseline</div><q-space /><q-btn dense flat icon="close" v-close-popup /></q-card-section>
          <q-card-section><pre class="baseline-json">{{ logText || 'Nessun output disponibile.' }}</pre></q-card-section>
        </q-card>
      </q-dialog>
    </template>

    <div v-else class="text-grey-6 q-pa-lg text-center">Digita un profilo per gestirne le baseline.</div>
  </q-page>
</template>

<script>
import { api } from 'boot/axios'
import { Notify } from 'quasar'
import { constants } from 'boot/constants'

export default {
  name: 'ProfileBaselineManager',
  data() {
    return {
      knownProfiles: [], filteredOptions: [], selectedProfile: null, profileText: '',
      baselines: [], loading: false, loadError: '',
      form: { label: '', window_start: '2000-01-01', window_end: `${new Date().getFullYear()}-01-01` },
      jobId: null, jobState: null, jobTimer: null, pollError: '', requestVersion: 0,
      logDialog: false, logText: '',
      detailDialog: false, selectedBaselineDetail: null,
    }
  },
  computed: {
    profile() { return (this.profileText || '').trim() },
    columns() {
      return [
        { name: 'label', label: 'Nome', field: 'label', align: 'left' },
        { name: 'window', label: 'Finestra', field: (r) => `${r.window_start} → ${r.window_end}`, align: 'left' },
        { name: 'status', label: 'Stato', field: (r) => r.compatibility?.status || 'unknown', align: 'left' },
        { name: 'run', label: 'Parametri run', field: 'run_config', align: 'left' },
        { name: 'commits', label: 'Codice', field: (r) => this.shortHash(r.core_commit || r.code_commit), align: 'left' },
        { name: 'sample_size', label: 'Trade', field: 'sample_size', align: 'right' },
        { name: 'created_at', label: 'Calcolata', field: (r) => String(r.created_at || '').slice(0, 16).replace('T', ' '), align: 'left' },
        { name: 'actions', label: '', field: 'actions', align: 'right' },
      ]
    },
    canSubmit() {
      return !this.jobRunning && !this.duplicateLabel && this.profile && this.form.label.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(this.form.window_start) && /^\d{4}-\d{2}-\d{2}$/.test(this.form.window_end)
    },
    duplicateLabel() {
      const label = this.form.label.trim()
      return Boolean(label && this.baselines.some((row) => String(row.label || '') === label))
    },
    jobRunning() { return ['queued', 'running'].includes(this.jobState?.status) },
    jobStateText() {
      if (!this.jobState) return ''
      const s = this.jobState
      if (s.status === 'completed') return `Baseline creata (id ${s.baseline_id || s.result?.baseline_id || '—'}).`
      if (s.status === 'failed') return `Job fallito: ${s.error || 'errore sconosciuto'}`
      if (s.status === 'interrupted') return `Job interrotto: ${s.error || 'worker non più attivo'}`
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
    statsUrl(row) {
      const strategy = String(row?.strategy || '').split('.')
      const runId = String(row?.run_id || '')
      if (strategy.length !== 2 || !strategy.every(part => /^[A-Za-z0-9_]+$/.test(part)) ||
          !/^[A-Za-z0-9_-]+$/.test(runId)) return ''
      if (!row?.id || !row?.profile) return ''
      return `${constants.API_BASE_URL.replace(/\/$/, '')}/dyn/obs/watchtower/cron/${encodeURIComponent(row.profile)}/baselines/${encodeURIComponent(row.id)}/stats.html`
    },
    runValue(row, key) {
      return row?.run_config?.[key] ?? row?.result_snapshot?.[`input_${key}`] ?? 'n/d'
    },
    exposureValue(row) {
      return row?.effective_params?.max_exposure ?? row?.params?.max_exposure ?? 'n/d'
    },
    cooldownValue(row) {
      const params = { ...row?.params, ...row?.effective_params }
      const threshold = params.post_up_cooldown_threshold
      const days = params.post_up_cooldown_days
      if (threshold == null || days == null) return 'n/d'
      return Number(threshold) <= 0 || Number(days) <= 0 ? 'disattivato' : `${threshold} / ${days} sedute`
    },
    formatTimestamp(value) { return value ? new Date(value).toLocaleString('it-IT') : '—' },
    onProfileChange(value) {
      this.profileText = value || ''
      this.loadBaselines()
      this.recoverJob()
    },
    onProfileClear() {
      this.profileText = ''; this.baselines = []; this.jobState = null; this.jobId = null
      this.requestVersion += 1
      if (this.jobTimer) clearInterval(this.jobTimer)
      this.jobTimer = null
    },
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
    shortHash(value) { return value ? String(value).slice(0, 12) : 'legacy' },
    compatibilityLabel(compatibility) {
      const status = compatibility?.status || 'unknown'
      return { compatible: 'Allineata', different: 'Diversa', unknown: 'Legacy' }[status] || status
    },
    compatibilityColor(compatibility) {
      return { compatible: 'positive', different: 'orange-9', unknown: 'grey-6' }[compatibility?.status || 'unknown']
    },
    formatJson(value) { return JSON.stringify(value || {}, null, 2) },
    showDetail(row) {
      this.selectedBaselineDetail = row
      this.detailDialog = true
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
    async recoverJob() {
      const profile = this.profile
      const version = ++this.requestVersion
      if (this.jobTimer) clearInterval(this.jobTimer)
      this.jobTimer = null; this.pollError = ''
      if (!profile) return
      try {
        const { data } = await api.get('/dyn/sc/calculations', { params: { profile, limit: 20, _ts: Date.now() } })
        if (version !== this.requestVersion || profile !== this.profile) return
        this.jobState = (data || []).find(job => job.kind === 'baseline_build') || null
        this.jobId = this.jobState?.id || null
        if (this.jobRunning) this.pollJob(profile)
      } catch (e) {
        if (version === this.requestVersion) this.pollError = e?.message || String(e)
      }
    },
    async startJob() {
      try {
        const { data } = await api.post(`/dyn/obs/watchtower/cron/${encodeURIComponent(this.profile)}/baselines`, {
          label: this.form.label.trim(),
          window_start: this.form.window_start,
          window_end: this.form.window_end,
        })
        this.jobId = data.id || data.job_id
        this.jobState = data
        this.pollJob(this.profile)
      } catch (e) {
        Notify.create({ type: 'negative', message: e?.response?.data?.error || e?.message || 'Errore avvio job' })
      }
    },
    pollJob(profile = this.profile) {
      if (this.jobTimer) clearInterval(this.jobTimer)
      this.jobTimer = setInterval(async () => {
        try {
          const jobId = this.jobId
          const { data } = await api.get(`/dyn/sc/calculations/${jobId}`)
          if (profile !== this.profile || jobId !== this.jobId) return
          this.jobState = data
          this.pollError = ''
          if (data.done) {
            clearInterval(this.jobTimer); this.jobTimer = null
            if (data.status === 'completed') { this.form.label = ''; this.loadBaselines() }
          }
        } catch (e) { if (profile === this.profile) this.pollError = e?.message || String(e) }
      }, 3000)
    },
    async openJobLog() {
      if (!this.jobId) return
      try {
        const { data } = await api.get(`/dyn/sc/calculations/${this.jobId}/log`)
        this.logText = data.output || ''; this.logDialog = true
      } catch (e) { Notify.create({ type: 'negative', message: e?.message || 'Log non disponibile' }) }
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

<style scoped>
.baseline-json {
  max-height: 280px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>
