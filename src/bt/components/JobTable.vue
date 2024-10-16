<template>
  <q-table title="Scheduled Jobs" :rows="jobs" :columns="columns" row-key="id" v-model:pagination="pagination">
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td v-for="col in props.cols" :key="col.name" :props="props">
          <template v-if="col.name === 'status'">
            <q-btn color="blue" @click="editJob(props.row.id)" icon="edit" flat
              dense><q-tooltip>Edit</q-tooltip></q-btn>
            <q-btn color="amber" v-if="props.row.next_run_time != 'None'" @click="pauseJob(props.row.id)"
              icon="pause_circle_filled" flat dense hint="Pause"><q-tooltip>Pause</q-tooltip></q-btn>
            <q-btn color="amber" v-else @click="resumeJob(props.row.id)" icon="not_started" flat
              dense><q-tooltip>Resume</q-tooltip></q-btn>
            <q-btn color="green" @click="runJob(props.row.id)" icon="play_circle_filled" flat
              dense><q-tooltip>Run</q-tooltip></q-btn>
            <q-btn color="black" @click="deleteJob(props.row.id)" icon="delete_forever" flat
              dense><q-tooltip>Delete</q-tooltip></q-btn>
          </template>
          <template v-else-if="col.name === 'next_run_time'">
            {{ props.row["next_run_time"] ? props.row["next_run_time"] : 'Paused' }}
          </template>
          <template v-else>
            <q-tooltip>
              {{ props.row[col.field] }}
            </q-tooltip>
            {{ (props.row[col.field] && props.row[col.field].length > 40) ? props.row[col.field].slice(0, 40) + '...' :
              props.row[col.field] }}
          </template>
        </q-td>
      </q-tr>
    </template>
  </q-table>
  <schedule-dialog ref="scheduleDialog" @confirm-schedule="handleSchedule" />
</template>
<script>

import { defineComponent, ref } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'
import ScheduleDialog from 'src/bt/components/ScheduleDialog';

const pagination = ref({ page: 1, rowsPerPage: 50 });

export default defineComponent({
  name: 'JobTable',
  components: {
    ScheduleDialog
  },
  props: {
    jobs: Array
  },
  data() {
    return {
      columns: [
        { name: 'id', required: true, label: 'Job ID', align: 'left', field: 'id', sortable: true },
        { name: 'next_run_time', align: 'left', label: 'Next Run Time', field: 'next_run_time', sortable: true },
        { name: 'function', align: 'left', label: 'Function', field: 'function' },
        { name: 'args', align: 'left', label: 'Arguments', field: 'args' },
        { name: 'trigger', align: 'left', label: 'Trigger', field: 'trigger' },
        { name: 'status', label: 'Status', field: row => row.next_run_time == 'None' ? 'Paused' : 'Running', sortable: false },
      ]
    };
  },
  // Aggiungi la paginazione con 50 righe per pagina come default
  pagination: {
    page: 1,
    rowsPerPage: 50, // Imposta il default a 50 righe per pagina
    rowsNumber: 0 // Questo sarà impostato dinamicamente in base ai tuoi dati
  },
  setup() {
    const pagination = ref({
      page: 1,
      rowsPerPage: 50, // Imposta 50 righe per pagina come default
      rowsNumber: 0
    });

    return {
      pagination
    };
  },
  methods: {
    pauseJob(jobId) {
      this.$emit('pause-job', jobId);
    },
    resumeJob(jobId) {
      this.$emit('resume-job', jobId);
    },
    runJob(jobId) {
      this.$emit('run-job', jobId);
    },
    editJob(jobId) {
      this.$refs.scheduleDialog.scheduleDialog({ id: jobId, name: jobId, type: '' });
    },

    deleteJob(jobId) {
      this.$q.dialog({
        title: 'Conferma',
        message: 'Verrà cancellata definitivamente la schedulazione, vuoi procedere?',
        ok: {
          label: 'Sì',
          color: 'negative'
        },
        cancel: {
          label: 'No',
          color: 'primary'
        }
      }).onOk(() => {
        this.$emit('delete-job', jobId);
        // Esegui qui il codice per cancellare il job
        console.log('Job eliminato:', jobId);
      }).onCancel(() => {
        console.log('Cancellazione annullata');
      });
    },
    // Gestisci i dati emessi dall'evento del componente figlio
    async handleSchedule(scheduleData) {
      //try { 
        const data = JSON.stringify(scheduleData)
        const response = await axios.post(constants.API_BASE_URL + '/dyn/sc/update_job', data, {
          headers: {
            'Content-Type': 'application/json'}
          });
        this.$emit('reload');
        this.$q.notify({
          color: 'positive',
          position: 'top',
          message: 'Schedulazione inviata con successo!',
          icon: 'cloud_done'
        });
      /*} catch (error) {
        this.$q.notify({
          color: 'negative',
          position: 'top',
          message: 'Errore durante l\'invio della schedulazione.',
          icon: 'error'
        });
      }*/
    }


  }
})

</script>