<template>
  <q-table title="Scheduled Jobs" :rows="jobs" :columns="columns" row-key="id" v-model:pagination="pagination">
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td v-for="col in props.cols" :key="col.name" :props="props">
          <template v-if="col.name === 'job_status'">
            <q-btn color="amber" v-if="props.row.enabled" @click="pauseJob(props.row.id)"
              icon="pause_circle_filled" flat dense hint="Pause"><q-tooltip>Pause</q-tooltip></q-btn>
            <q-btn color="amber" v-else @click="resumeJob(props.row.id)" icon="not_started" flat
              dense><q-tooltip>Resume</q-tooltip></q-btn>
            <q-btn color="green" @click="confirmRun(props.row.id)" icon="play_circle_filled" flat
              dense><q-tooltip>Run</q-tooltip></q-btn>
            <q-btn v-if="props.row.editable" color="primary" @click="$emit('edit-job', props.row)" icon="edit"
              label="Modifica" flat dense><q-tooltip>Modifica frequenza e orario</q-tooltip></q-btn>
          </template>
          <template v-else-if="col.name === 'next_run_time'">
            {{ props.row.enabled ? props.row.next_run_time : 'Disabilitato' }}
          </template>
          <template v-else-if="col.name === 'enabled'">
            <q-badge :color="props.row.enabled ? 'positive' : 'grey'">{{ props.row.enabled ? 'Abilitato' : 'Disabilitato' }}</q-badge>
          </template>
          <template v-else-if="col.name === 'last_finished_at'">
            {{ props.row.last_finished_at || '—' }}
          </template>
          <template v-else-if="col.name === 'last_error'">
            <span :class="props.row.last_error ? 'text-negative' : 'text-grey-6'">{{ props.row.last_error || '—' }}</span>
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
</template>
<script>

import { defineComponent, ref } from 'vue'

const pagination = ref({ page: 1, rowsPerPage: 50 });

export default defineComponent({
  name: 'JobTable',
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
        { name: 'status', align: 'left', label: 'Ultimo esito', field: 'status' },
        { name: 'enabled', align: 'left', label: 'Stato', field: 'enabled' },
        { name: 'last_finished_at', align: 'left', label: 'Ultimo completamento', field: 'last_finished_at' },
        { name: 'last_error', align: 'left', label: 'Ultimo errore', field: 'last_error' },
        { name: 'job_status', label: 'Azioni', field: row => row.enabled ? 'Abilitato' : 'Disabilitato', sortable: false },
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
    confirmRun(jobId) {
      this.$q.dialog({
        title: 'Esegui job',
        message: 'Avvia ora questo job Watchtower/manutenzione? Non eseguirà strategie né invierà ordini.',
        ok: {
          label: 'Esegui',
          color: 'primary'
        },
        cancel: {
          label: 'No',
          color: 'primary'
        }
      }).onOk(() => {
        this.runJob(jobId);
      });
    },
  }
})

</script>
