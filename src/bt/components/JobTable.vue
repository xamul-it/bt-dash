<template>
    <q-table
      title="Scheduled Jobs"
      :rows="jobs"
      :columns="columns"
      row-key="id"
    >
      <template v-slot:body="props">
        <q-tr :props="props">
          <q-td v-for="col in props.cols" :key="col.name" :props="props">
            {{ col.value }}
          </q-td>
          <q-td>
            <q-btn color="amber" v-if="props.row.next_run_time!='None'" @click="pauseJob(props.row.id)" icon="pause_circle_filled" >Pause</q-btn>
            <q-btn color="green" v-else @click="resumeJob(props.row.id)" icon="play_circle_filled" >Resume</q-btn>
          </q-td>
        </q-tr>
      </template>
    </q-table>
  </template>
  
  <script>

  import { defineComponent, ref } from 'vue'
  import axios from 'axios'
  import { constants } from 'boot/constants'

  export default defineComponent({
    name: 'JobTable',
    props: {
      jobs: Array
    },
    data() {
      return {
        columns: [
          { name: 'id', required: true, label: 'Job ID', align: 'left', field: 'id', sortable: true },
          { name: 'next_run_time', align: 'left', label: 'Next Run Time', field: row => row.next_run_time ? row.next_run_time : 'Paused', sortable: true },
          { name: 'function', align: 'left', label: 'Function', field: 'function'},
          { name: 'args', align: 'left', label: 'Arguments', field: 'args'},
          { name: 'trigger', align: 'left', label: 'Trigger', field: 'trigger'},
          { name: 'status', label: 'Status', field: row => row.next_run_time=='None' ? 'Paused' : 'Running', sortable: false },
        ]
      };
    },
    methods: {
      pauseJob(jobId) {
        this.$emit('pause-job', jobId);
      },
      resumeJob(jobId) {
        this.$emit('resume-job', jobId);
      }
    }
  })

  </script>
  