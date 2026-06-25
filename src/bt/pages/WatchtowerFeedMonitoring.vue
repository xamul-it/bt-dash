<template>
  <q-page class="q-pa-md">
    <div class="row items-start q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="text-h5">Watchtower Feed Monitoring</div>
        <div class="text-caption text-grey-7">
          Confronto tra dump live in `out/dump` e storico Alpaca locale.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          color="primary"
          icon="refresh"
          label="Aggiorna"
          :loading="isPageBusy"
          @click="refreshPage"
        />
      </div>
    </div>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-md-3">
          <q-input
            v-model="startDate"
            label="Data inizio"
            type="date"
            dense
            outlined
          />
        </div>
        <div class="col-12 col-md-3">
          <q-input
            v-model="endDate"
            label="Data fine"
            type="date"
            dense
            outlined
          />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="selectedSymbol"
            :options="symbolOptions"
            label="Filtro simbolo"
            dense
            outlined
            clearable
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-md-3">
          <q-select
            v-model="selectedDiscrepancyType"
            :options="discrepancyTypeOptions"
            label="Tipo discrepanza"
            dense
            outlined
            clearable
            emit-value
            map-options
          />
        </div>
      </q-card-section>
      <q-card-section class="q-pt-none row q-col-gutter-sm">
        <div class="col-auto">
          <q-btn color="primary" label="Carica copertura" @click="loadCoverage" :loading="loading.coverage" />
        </div>
        <div class="col-auto">
          <q-btn
            color="secondary"
            label="Ricalcola match"
            @click="recomputeMatch"
            :disable="!canOperate"
            :loading="jobLoading.match"
          />
        </div>
        <div class="col-auto">
          <q-btn
            color="accent"
            icon="download"
            label="Esporta discrepanze"
            :disable="!discrepancies.total"
            @click="exportDiscrepanciesCsv"
          />
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section class="text-caption text-grey-7">
        Live dir: {{ meta.live_dir || 'n/d' }}<br>
        Historical dir: {{ meta.historical_dir || 'n/d' }}<br>
        Date disponibili: {{ availableDateLabel }}
      </q-card-section>
    </q-card>

    <div v-if="syncJob" class="q-mb-md">
      <q-card flat bordered>
        <q-card-section class="row items-center q-col-gutter-md">
          <div class="col">
            <div class="text-subtitle2">Download storico Alpaca</div>
            <div class="text-caption text-grey-7">
              {{ jobStatusLabel(syncJob) }}
              <span v-if="syncJob.current_symbol"> | simbolo corrente: {{ syncJob.current_symbol }}</span>
            </div>
          </div>
          <div class="col-auto text-caption text-grey-7">
            {{ syncJob.completed_symbols || 0 }} / {{ syncJob.total_symbols || 0 }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress
            size="12px"
            rounded
            color="accent"
            track-color="grey-3"
            :value="jobProgress(syncJob)"
            :indeterminate="isJobIndeterminate(syncJob)"
          />
        </q-card-section>
      </q-card>
    </div>

    <div v-if="matchJob" class="q-mb-md">
      <q-card flat bordered>
        <q-card-section class="row items-center q-col-gutter-md">
          <div class="col">
            <div class="text-subtitle2">Calcolo match live vs storico</div>
            <div class="text-caption text-grey-7">
              {{ jobStatusLabel(matchJob) }}
              <span v-if="matchJob.current_symbol"> | simbolo corrente: {{ matchJob.current_symbol }}</span>
            </div>
          </div>
          <div class="col-auto text-caption text-grey-7">
            {{ matchJob.completed_symbols || 0 }} / {{ matchJob.total_symbols || 0 }}
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress
            size="12px"
            rounded
            color="secondary"
            track-color="grey-3"
            :value="jobProgress(matchJob)"
            :indeterminate="isJobIndeterminate(matchJob)"
          />
        </q-card-section>
      </q-card>
    </div>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Copertura simboli</div>
          <div class="text-caption text-grey-7">
            Simboli con dump live nel range selezionato e stato della cache storica.
          </div>
        </div>
        <div class="col-auto text-caption text-grey-7">
          {{ coverage.symbols.length }} simboli
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <q-table
          flat
          dense
          row-key="symbol"
          :rows="coverage.symbols"
          :columns="coverageColumns"
          :loading="loading.coverage"
          :pagination="{ rowsPerPage: 15 }"
        >
          <template #body-cell-historical_status="props">
            <q-td :props="props">
              <q-badge :color="historicalStatusColor(props.value)">
                {{ props.value }}
              </q-badge>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Discrepanze</div>
          <div class="text-caption text-grey-7">
            Barre mancanti o divergenti nel range selezionato.
          </div>
        </div>
        <div class="col-auto text-caption text-grey-7">
          {{ discrepancies.total || 0 }} record
          <span v-if="discrepancies.page_count && discrepancies.total > discrepancies.page_count">
            | mostrati {{ discrepancies.page_count }}
          </span>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="row q-col-gutter-md q-mb-md">
          <div class="col-12 col-md-3">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-caption text-grey-7">Totale</div>
                <div class="text-h6">{{ discrepancies.total || 0 }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-md-3">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-caption text-grey-7">Missing live</div>
                <div class="text-h6">{{ discrepancyTypeCounts.missing_live }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-md-3">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-caption text-grey-7">Missing historical</div>
                <div class="text-h6">{{ discrepancyTypeCounts.missing_historical }}</div>
              </q-card-section>
            </q-card>
          </div>
          <div class="col-12 col-md-3">
            <q-card flat bordered>
              <q-card-section>
                <div class="text-caption text-grey-7">Field mismatch</div>
                <div class="text-h6">{{ discrepancyTypeCounts.field_mismatch }}</div>
              </q-card-section>
            </q-card>
          </div>
        </div>
        <q-table
          flat
          dense
          row-key="discrepancy_key"
          :rows="discrepancyRows"
          :columns="discrepancyColumns"
          :loading="loading.discrepancies"
          :pagination="{ rowsPerPage: 25 }"
        >
          <template #body-cell-discrepancy_type="props">
            <q-td :props="props">
              <q-badge :color="discrepancyColor(props.value)">
                {{ props.value }}
              </q-badge>
            </q-td>
          </template>
          <template #body-cell-live_payload="props">
            <q-td :props="props" class="text-caption">
              <pre class="payload-preview">{{ stringifyPayload(props.value) }}</pre>
            </q-td>
          </template>
          <template #body-cell-historical_payload="props">
            <q-td :props="props" class="text-caption">
              <pre class="payload-preview">{{ stringifyPayload(props.value) }}</pre>
            </q-td>
          </template>
          <template #body-cell-diff_payload="props">
            <q-td :props="props" class="text-caption">
              <pre class="payload-preview">{{ stringifyPayload(props.value) }}</pre>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Sintesi match</div>
          <div class="text-caption text-grey-7">
            Una riga per `symbol x day`.
          </div>
        </div>
        <div class="col-auto text-caption text-grey-7">
          {{ summaries.length }} righe
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <q-table
          flat
          dense
          row-key="summary_key"
          :rows="summaryRows"
          :columns="summaryColumns"
          :loading="loading.summary"
          :pagination="{ rowsPerPage: 20 }"
        >
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge :color="summaryStatusColor(props.value)">
                {{ props.value }}
              </q-badge>
            </q-td>
          </template>
        </q-table>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="row items-center q-col-gutter-md q-mb-sm">
          <div class="col">
            <div class="text-subtitle2">Pivot mismatch per campo</div>
            <div class="text-caption text-grey-7">
              Conteggio dei `field_mismatch` aggregati per campo nel range selezionato.
            </div>
          </div>
          <div class="col-auto text-caption text-grey-7">
            {{ fieldPivot.length }} campi
          </div>
        </div>
        <q-table
          flat
          dense
          row-key="field_name"
          :rows="fieldPivot"
          :columns="fieldPivotColumns"
          :loading="loading.summary"
          :pagination="{ rowsPerPage: 10 }"
          hide-bottom
        />
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script>
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import axios from 'axios'
import { constants } from 'boot/constants'

export default defineComponent({
  name: 'WatchtowerFeedMonitoring',

  setup () {
    const $q = useQuasar()

    const meta = ref({})
    const startDate = ref('')
    const endDate = ref('')
    const selectedSymbol = ref(null)
    const selectedDiscrepancyType = ref(null)

    const coverage = ref({
      symbols: [],
      symbol_days: [],
      missing_historical_symbols: []
    })
    const summaries = ref([])
    const fieldPivot = ref([])
    const discrepancies = ref({
      total: 0,
      page_count: 0,
      counts_by_type: {
        missing_live: 0,
        missing_historical: 0,
        field_mismatch: 0
      },
      rows: []
    })

    const syncJob = ref(null)
    const matchJob = ref(null)
    const loading = ref({
      coverage: false,
      summary: false,
      discrepancies: false
    })
    const jobLoading = ref({
      sync: false,
      match: false
    })

    let syncPollHandle = null
    let matchPollHandle = null

    const coverageColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left', sortable: true },
      { name: 'days_with_live', label: 'Live days', field: 'days_with_live', align: 'right', sortable: true },
      { name: 'historical_status', label: 'Historical', field: 'historical_status', align: 'left', sortable: true },
      { name: 'historical_first_date', label: 'Hist from', field: 'historical_first_date', align: 'left', sortable: true },
      { name: 'historical_last_date', label: 'Hist to', field: 'historical_last_date', align: 'left', sortable: true }
    ]

    const summaryColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left', sortable: true },
      { name: 'feed_date', label: 'Date', field: 'feed_date', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
      { name: 'live_rows', label: 'Live rows', field: 'live_rows', align: 'right', sortable: true },
      { name: 'historical_rows', label: 'Hist rows', field: 'historical_rows', align: 'right', sortable: true },
      { name: 'common_timestamps', label: 'Common', field: 'common_timestamps', align: 'right', sortable: true },
      { name: 'missing_live_count', label: 'Missing live', field: 'missing_live_count', align: 'right', sortable: true },
      { name: 'missing_historical_count', label: 'Missing hist', field: 'missing_historical_count', align: 'right', sortable: true },
      { name: 'mismatched_bars_count', label: 'Mismatches', field: 'mismatched_bars_count', align: 'right', sortable: true }
    ]
    const fieldPivotColumns = [
      { name: 'field_name', label: 'Campo', field: 'field_name', align: 'left', sortable: true },
      { name: 'mismatch_count', label: 'Mismatch', field: 'mismatch_count', align: 'right', sortable: true }
    ]

    const discrepancyColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left', sortable: true },
      { name: 'feed_date', label: 'Date', field: 'feed_date', align: 'left', sortable: true },
      { name: 'minute_key', label: 'Minute', field: 'minute_key', align: 'left', sortable: true },
      { name: 'discrepancy_type', label: 'Type', field: 'discrepancy_type', align: 'left', sortable: true },
      { name: 'live_payload', label: 'Live payload', field: 'live_payload', align: 'left' },
      { name: 'historical_payload', label: 'Historical payload', field: 'historical_payload', align: 'left' },
      { name: 'diff_payload', label: 'Diff', field: 'diff_payload', align: 'left' }
    ]

    const discrepancyTypeOptions = [
      { label: 'missing_live', value: 'missing_live' },
      { label: 'missing_historical', value: 'missing_historical' },
      { label: 'field_mismatch', value: 'field_mismatch' }
    ]

    const canOperate = computed(() => Boolean(startDate.value && endDate.value))
    const isPageBusy = computed(() => (
      loading.value.coverage ||
      loading.value.summary ||
      loading.value.discrepancies ||
      jobLoading.value.sync ||
      jobLoading.value.match
    ))
    const symbolOptions = computed(() => coverage.value.symbols.map(row => ({ label: row.symbol, value: row.symbol })))
    const availableDateLabel = computed(() => {
      const dates = meta.value.available_dates || []
      if (!dates.length) {
        return 'nessuna data disponibile'
      }
      return `${dates[dates.length - 1]} .. ${dates[0]}`
    })
    const summaryRows = computed(() => summaries.value.map(row => ({
      ...row,
      summary_key: `${row.symbol}-${row.feed_date}`
    })))
    const discrepancyRows = computed(() => discrepancies.value.rows.map(row => ({
      ...row,
      discrepancy_key: `${row.symbol}-${row.feed_date}-${row.minute_key}-${row.discrepancy_type}`
    })))
    const discrepancyTypeCounts = computed(() => discrepancies.value.counts_by_type || {
      missing_live: 0,
      missing_historical: 0,
      field_mismatch: 0
    })

    function stopPolling () {
      if (syncPollHandle) {
        clearTimeout(syncPollHandle)
        syncPollHandle = null
      }
      if (matchPollHandle) {
        clearTimeout(matchPollHandle)
        matchPollHandle = null
      }
    }

    function emptyDiscrepancies () {
      return {
        total: 0,
        page_count: 0,
        counts_by_type: {
          missing_live: 0,
          missing_historical: 0,
          field_mismatch: 0
        },
        rows: []
      }
    }

    function resetResults () {
      coverage.value = {
        symbols: [],
        symbol_days: [],
        missing_historical_symbols: []
      }
      summaries.value = []
      fieldPivot.value = []
      discrepancies.value = emptyDiscrepancies()
      syncJob.value = null
      matchJob.value = null
      jobLoading.value.sync = false
      jobLoading.value.match = false
    }

    function queryParams () {
      const params = {
        start_date: startDate.value,
        end_date: endDate.value
      }
      if (selectedSymbol.value) {
        params.symbol = selectedSymbol.value
      }
      if (selectedDiscrepancyType.value) {
        params.discrepancy_type = selectedDiscrepancyType.value
      }
      return params
    }

    async function fetchMeta () {
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/meta`)
      meta.value = response.data || {}
      if (!startDate.value && meta.value.latest_date) {
        startDate.value = meta.value.latest_date
      }
      if (!endDate.value && meta.value.latest_date) {
        endDate.value = meta.value.latest_date
      }
    }

    async function fetchSummaries () {
      if (!canOperate.value) {
        return
      }
      loading.value.summary = true
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/summary`, {
          params: {
            start_date: startDate.value,
            end_date: endDate.value,
            symbol: selectedSymbol.value || undefined
          }
        })
        summaries.value = response.data || []
      } finally {
        loading.value.summary = false
      }
    }

    async function fetchFieldPivot () {
      if (!canOperate.value) {
        return
      }
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/field-pivot`, {
        params: {
          start_date: startDate.value,
          end_date: endDate.value,
          symbol: selectedSymbol.value || undefined
        }
      })
      fieldPivot.value = response.data || []
    }

    async function fetchDiscrepancies () {
      if (!canOperate.value) {
        return
      }
      loading.value.discrepancies = true
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/discrepancies`, {
          params: {
            ...queryParams(),
            limit: 500,
            offset: 0
          }
        })
        discrepancies.value = response.data || emptyDiscrepancies()
      } finally {
        loading.value.discrepancies = false
      }
    }

    async function fetchResults () {
      await fetchSummaries()
      await fetchFieldPivot()
      await fetchDiscrepancies()
    }

    async function pollSyncJob (jobId) {
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/sync/${jobId}`)
        syncJob.value = response.data
        if (syncJob.value.done) {
          jobLoading.value.sync = false
          if (syncJob.value.status === 'failed') {
            notifyError({ message: syncJob.value.error }, 'Download storico fallito')
            return
          }
          await loadCoverage({ preserveJobs: true, autoChain: false })
          await startMatch(false)
          return
        }
        syncPollHandle = setTimeout(() => {
          pollSyncJob(jobId)
        }, 2000)
      } catch (error) {
        jobLoading.value.sync = false
        notifyError(error, 'Errore nel polling del download storico')
      }
    }

    async function pollMatchJob (jobId) {
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/match/${jobId}`)
        matchJob.value = response.data
        if (matchJob.value.done) {
          jobLoading.value.match = false
          if (matchJob.value.status === 'failed') {
            notifyError({ message: matchJob.value.error }, 'Calcolo match fallito')
            return
          }
          await fetchResults()
          return
        }
        matchPollHandle = setTimeout(() => {
          pollMatchJob(jobId)
        }, 2000)
      } catch (error) {
        jobLoading.value.match = false
        notifyError(error, 'Errore nel polling del match')
      }
    }

    async function startSync (symbols) {
      if (!canOperate.value) {
        return
      }
      stopPolling()
      jobLoading.value.sync = true
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/sync`, {
          start_date: startDate.value,
          end_date: endDate.value,
          symbols
        })
        syncJob.value = response.data
        await pollSyncJob(syncJob.value.job_id)
      } catch (error) {
        jobLoading.value.sync = false
        notifyError(error, 'Errore avvio download storico')
      }
    }

    async function startMatch (force = false) {
      if (!canOperate.value || jobLoading.value.match) {
        return
      }
      const symbols = selectedSymbol.value ? [selectedSymbol.value] : coverage.value.symbols.map(row => row.symbol)
      if (!symbols.length) {
        summaries.value = []
        discrepancies.value = emptyDiscrepancies()
        jobLoading.value.match = false
        return
      }
      stopPolling()
      jobLoading.value.match = true
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/match`, {
          start_date: startDate.value,
          end_date: endDate.value,
          symbols,
          force
        })
        matchJob.value = response.data
        await pollMatchJob(matchJob.value.job_id)
      } catch (error) {
        jobLoading.value.match = false
        notifyError(error, 'Errore avvio calcolo match')
      }
    }

    async function loadCoverage (options = {}) {
      if (!canOperate.value) {
        return
      }
      const { preserveJobs = false, autoChain = true } = options
      stopPolling()
      if (!preserveJobs) {
        syncJob.value = null
        matchJob.value = null
        jobLoading.value.sync = false
        jobLoading.value.match = false
      }
      loading.value.coverage = true
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/coverage`, {
          params: {
            start_date: startDate.value,
            end_date: endDate.value,
            symbols: selectedSymbol.value || undefined
          }
        })
        coverage.value = response.data || {
          symbols: [],
          symbol_days: [],
          missing_historical_symbols: []
        }
        if (selectedSymbol.value && !coverage.value.symbols.some(row => row.symbol === selectedSymbol.value)) {
          selectedSymbol.value = null
        }
      } finally {
        loading.value.coverage = false
      }

      if (!autoChain) {
        return
      }

      if (coverage.value.missing_historical_symbols?.length) {
        await startSync(coverage.value.missing_historical_symbols)
        return
      }

      await fetchSummaries()
      await fetchFieldPivot()
      if (!summaries.value.length && coverage.value.symbols.length) {
        await startMatch(false)
        return
      }
      await fetchDiscrepancies()
    }

    async function refreshPage () {
      try {
        stopPolling()
        await fetchMeta()
        await loadCoverage()
      } catch (error) {
        notifyError(error, 'Errore durante il refresh del feed monitoring')
      }
    }

    async function recomputeMatch () {
      await loadCoverage({ preserveJobs: false, autoChain: false })
      await startMatch(true)
    }

    async function exportDiscrepanciesCsv () {
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/feed-monitoring/export`, {
        params: queryParams(),
        responseType: 'blob'
      })
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      const symbolPart = selectedSymbol.value ? `-${selectedSymbol.value}` : ''
      link.href = url
      link.download = `feed-monitor-discrepancies-${startDate.value}-${endDate.value}${symbolPart}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    }

    function notifyError (error, message) {
      const detail = error?.response?.data?.error || error?.message || 'unknown_error'
      $q.notify({
        color: 'negative',
        message: `${message}: ${detail}`,
        position: 'top'
      })
    }

    function historicalStatusColor (value) {
      if (value === 'available') {
        return 'positive'
      }
      if (value === 'partial') {
        return 'warning'
      }
      return 'negative'
    }

    function summaryStatusColor (value) {
      return value === 'exact_match' ? 'positive' : 'warning'
    }

    function discrepancyColor (value) {
      if (value === 'field_mismatch') {
        return 'warning'
      }
      return 'negative'
    }

    function isJobIndeterminate (job) {
      return job?.status === 'running' && jobProgress(job) === 0
    }

    function stringifyPayload (value) {
      return JSON.stringify(value || {}, null, 2)
    }

    function jobProgress (job) {
      const progress = Number(job?.progress || 0)
      if (Number.isFinite(progress) && progress > 0) {
        return Math.min(1, Math.max(0, progress))
      }
      const total = Number(job?.total_symbols || 0)
      const completed = Number(job?.completed_symbols || 0)
      return total > 0 ? Math.min(1, completed / total) : 0
    }

    function jobStatusLabel (job) {
      const parts = [job?.status || 'queued']
      if (job?.error) {
        parts.push(job.error)
      }
      return parts.join(' | ')
    }

    watch([startDate, endDate], () => {
      stopPolling()
      resetResults()
    })

    watch([selectedSymbol, selectedDiscrepancyType], async () => {
      if (!canOperate.value) {
        return
      }
      try {
        await loadCoverage({ preserveJobs: true, autoChain: false })
        await fetchSummaries()
        await fetchFieldPivot()
        await fetchDiscrepancies()
      } catch (error) {
        notifyError(error, 'Errore durante l’aggiornamento dei filtri')
      }
    })

    onMounted(async () => {
      try {
        await refreshPage()
      } catch (error) {
        notifyError(error, 'Errore in inizializzazione feed monitoring')
      }
    })

    onBeforeUnmount(() => {
      stopPolling()
    })

    return {
      meta,
      startDate,
      endDate,
      selectedSymbol,
      selectedDiscrepancyType,
      coverage,
      summaries,
      fieldPivot,
      discrepancies,
      syncJob,
      matchJob,
      loading,
      jobLoading,
      coverageColumns,
      summaryColumns,
      fieldPivotColumns,
      discrepancyColumns,
      discrepancyTypeOptions,
      canOperate,
      isPageBusy,
      symbolOptions,
      availableDateLabel,
      summaryRows,
      discrepancyRows,
      discrepancyTypeCounts,
      loadCoverage,
      startMatch,
      recomputeMatch,
      refreshPage,
      exportDiscrepanciesCsv,
      historicalStatusColor,
      summaryStatusColor,
      discrepancyColor,
      jobProgress,
      jobStatusLabel,
      isJobIndeterminate,
      stringifyPayload
    }
  }
})
</script>

<style scoped>
.payload-preview {
  margin: 0;
  max-width: 360px;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  line-height: 1.3;
}
</style>
