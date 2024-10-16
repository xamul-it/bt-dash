<template>
  <div>
    <q-page padding>
      <div class="text-h5 q-mb-md">Scheduler Control Panel</div>
      <div class="q-mb-md">
        <q-btn color="red" @click="stopScheduler" v-if="schedulerStatus == 'running'" label="Stop Scheduler"
          :disable="schedulerStatus !== 'running'" />
        <q-btn color="green" @click="startScheduler" v-if="schedulerStatus != 'running'" label="Start Scheduler"
          :disable="schedulerStatus === 'running'" />
        <q-chip :color="schedulerStatus === 'running' ? 'green' : 'red'" text-color="white">
          {{ schedulerStatus.toUpperCase() }}
        </q-chip>
      </div>
      <job-table :jobs="jobs" @pause-job="pauseJob" @resume-job="resumeJob" @run-job="runJob" @delete-job="deleteJob"
        @edit-job="openDialog" @reload="fetchJobs"></job-table>
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
    JobTable: defineAsyncComponent(() => import(`src/bt/components/JobTable`))
  },
  data() {
    return {
      jobs: [],
      schedulerStatus: 'stopped'  // Assumed default
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
        this.jobs = response.data.map(job => ({ ...job, status: 'running' })); // assuming all jobs are running initially
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
    deleteJob(jobId) {
      this.$axios.post(`${constants.API_BASE_URL}/dyn/sc/delete_job/${jobId}`).then(() => {
        this.fetchJobs();
      });
    },

  },
  mounted() {
    this.fetchSchedulerStatus();
    this.fetchJobs();
  }
})
</script>