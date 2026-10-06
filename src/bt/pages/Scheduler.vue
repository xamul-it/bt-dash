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
      <schedule-dialog ref="scheduleDialog" @save="updateJob" />
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
    this.refreshTimer = window.setInterval(() => {
      this.fetchSchedulerStatus();
      this.fetchJobs();
    }, 3000);
  },
  beforeUnmount() {
    window.clearInterval(this.refreshTimer);
  }
})
</script>
