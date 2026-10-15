<template>
  <div>
    <q-page padding>
      <div class="text-h5 q-mb-md">Scheduler Control Panel</div>
      <q-banner class="bg-blue-1 text-blue-10 q-mb-md" rounded>
        Lo Scheduler gestisce esclusivamente Watchtower e manutenzioni dati. Le strategie che inviano ordini restano nei cron dedicati.
      </q-banner>
      <div class="q-mb-md">
        <q-btn color="red" @click="stopScheduler" v-if="schedulerStatus == 'running'" label="Stop Scheduler"
          :disable="schedulerStatus !== 'running'" />
        <q-btn color="green" @click="startScheduler" v-if="schedulerStatus != 'running'" label="Start Scheduler"
          :disable="schedulerStatus === 'running'" />
        <q-chip :color="schedulerStatus === 'running' ? 'green' : 'red'" text-color="white" icon="schedule">
          Scheduler {{ schedulerStatus === 'running' ? 'ATTIVO' : 'IN PAUSA' }}
        </q-chip>
      </div>
      <job-table :jobs="jobs" @pause-job="pauseJob" @resume-job="resumeJob" @run-job="runJob"
        @edit-job="openDialog"></job-table>
      <q-table class="q-mt-lg" title="Esecuzioni persistenti" :rows="calculations" :columns="calculationColumns"
        row-key="id" :pagination="{ rowsPerPage: 20 }" flat bordered dense>
        <template #body-cell-progress="props">
          <q-td :props="props">{{ props.row.progress_total ? `${props.row.progress_done}/${props.row.progress_total}` : (props.row.phase || '—') }}</q-td>
        </template>
        <template #body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat dense no-caps color="primary" label="Log" @click="openCalculationOutput(props.row, 'log')" />
            <q-btn flat dense no-caps color="secondary" label="Risultato" @click="openCalculationOutput(props.row, 'result')" />
          </q-td>
        </template>
      </q-table>
      <schedule-dialog ref="scheduleDialog" :jobs="jobs" @save="updateJob" />
      <q-dialog v-model="calculationDialog">
        <q-card style="min-width: 700px; max-width: 95vw">
          <q-card-section class="row items-center q-pb-none"><div class="text-h6">{{ calculationDialogTitle }}</div><q-space /><q-btn flat round dense icon="close" v-close-popup /></q-card-section>
          <q-card-section><pre class="calculation-output">{{ calculationDialogText }}</pre></q-card-section>
        </q-card>
      </q-dialog>
    </q-page>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'

export default defineComponent({
  name: 'SchedulerPage',
  components: {
    JobTable: defineAsyncComponent(() => import(`src/bt/components/JobTable`)),
    ScheduleDialog: defineAsyncComponent(() => import(`src/bt/components/ScheduleDialog`))
  },
  data() {
    return {
      jobs: [],
      calculations: [],
      calculationColumns: [
        { name: 'kind', label: 'Tipo', field: 'kind', align: 'left' },
        { name: 'profile', label: 'Profilo', field: 'profile', align: 'left' },
        { name: 'baseline_id', label: 'Baseline', field: row => row.baseline_id || '—', align: 'left' },
        { name: 'status', label: 'Stato', field: 'status', align: 'left' },
        { name: 'progress', label: 'Progresso', field: 'progress_done', align: 'left' },
        { name: 'created_at', label: 'Creata', field: 'created_at', align: 'left' },
        { name: 'finished_at', label: 'Conclusa', field: row => row.finished_at || '—', align: 'left' },
        { name: 'error', label: 'Errore', field: row => row.error || '—', align: 'left' },
        { name: 'actions', label: '', field: 'actions', align: 'right' },
      ],
      calculationDialog: false,
      calculationDialogTitle: '',
      calculationDialogText: '',
      schedulerStatus: 'stopped',  // Assumed default
      refreshTimer: null,
    };
  },
  methods: {
    fetchSchedulerStatus() {
      this.$axios.get(`${constants.API_BASE_URL}/dyn/sc/status`)
        .then(response => {
          this.schedulerStatus = response.data.status;
        })
        .catch(error => {
          console.error("Failed to fetch scheduler status:", error);
          this.$q.notify({
            color: 'red-5',
            textColor: 'white',
            icon: 'warning',
            message: 'Failed to load scheduler status'
          });
        });
    },

    fetchJobs() {
      this.$axios.get(`${constants.API_BASE_URL}/dyn/sc/jobs`).then(response => {
        this.jobs = response.data.map(job => ({ ...job })); // assuming all jobs are running initially
      });
    },
    fetchCalculations() {
      this.$axios.get(`${constants.API_BASE_URL}/dyn/sc/calculations`, { params: { limit: 100, _ts: Date.now() } })
        .then(response => { this.calculations = response.data || [] })
        .catch(error => { console.error('Failed to fetch calculation history:', error) })
    },
    async openCalculationOutput(job, kind) {
      this.calculationDialogTitle = `${kind === 'log' ? 'Log' : 'Risultato'} — ${job.id}`
      if (kind === 'result') {
        this.calculationDialogText = JSON.stringify(job.result || {}, null, 2)
      } else {
        try {
          const response = await this.$axios.get(`${constants.API_BASE_URL}/dyn/sc/calculations/${job.id}/log`)
          this.calculationDialogText = response.data.output || 'Nessun output disponibile.'
        } catch (error) {
          this.calculationDialogText = error.response?.data?.error || error.message || 'Log non disponibile.'
        }
      }
      this.calculationDialog = true
    },
    stopScheduler() {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/stop`).then(() => {
        this.schedulerStatus = 'stopped';
      });
    },
    startScheduler() {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/start`).then(() => {
        this.schedulerStatus = 'running';
      });
    },
    pauseJob(jobId) {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/pause_job/${jobId}`).then(() => {
        this.fetchJobs();
      });
    },
    resumeJob(jobId) {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/resume_job/${jobId}`).then(() => {
        this.fetchJobs();
      });
    },
    runJob(jobId) {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/run_job/${jobId}`).then(() => {
        this.fetchJobs();
      });
    },
    openDialog(job) {
      this.$refs.scheduleDialog.open(job);
    },
    updateJob(payload) {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/update_job`, payload).then(() => {
        this.fetchJobs();
        this.$q.notify({ color: 'positive', message: 'Schedulazione aggiornata' });
      }).catch(error => {
        this.$q.notify({ color: 'negative', message: error.response?.data?.message || 'Aggiornamento non riuscito' });
      });
    },

  },
  mounted() {
    this.fetchSchedulerStatus();
    this.fetchJobs();
    this.fetchCalculations();
    this.refreshTimer = window.setInterval(() => {
      this.fetchSchedulerStatus();
      this.fetchJobs();
      this.fetchCalculations();
    }, 3000);
  },
  beforeUnmount() {
    window.clearInterval(this.refreshTimer);
  }
})
</script>

<style scoped>
.calculation-output { max-height: 65vh; overflow: auto; white-space: pre-wrap; word-break: break-word; }
</style>
