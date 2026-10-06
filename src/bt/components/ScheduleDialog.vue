<template>
  <q-dialog v-model="dialog" persistent>
    <q-card style="min-width: 420px; max-width: 95vw">
      <q-card-section>
        <div class="text-h6">Modifica schedulazione</div>
        <div class="text-caption text-grey-7">{{ jobId }} — solo manutenzione Watchtower, nessuna strategia o ordine.</div>
      </q-card-section>
      <q-card-section>
        <q-form ref="scheduleForm" @submit="submit">
          <q-select v-model="schedule.frequency" :options="frequencies" emit-value map-options filled label="Frequenza"
            :rules="[value => !!value || 'Frequenza obbligatoria']" />
          <div class="row q-col-gutter-sm q-mt-xs">
            <div class="col-6"><q-input v-model.number="schedule.hour" filled type="number" min="0" max="23" label="Ora (0–23)"
              :rules="[value => Number.isInteger(value) && value >= 0 && value <= 23 || 'Inserire 0–23']" /></div>
            <div class="col-6"><q-input v-model.number="schedule.minute" filled type="number" min="0" max="59" label="Minuti (0–59)"
              :rules="[value => Number.isInteger(value) && value >= 0 && value <= 59 || 'Inserire 0–59']" /></div>
          </div>
          <q-select v-if="schedule.frequency === 'weekly'" v-model="schedule.day_of_week" :options="weekdays" emit-value map-options filled
            class="q-mt-sm" label="Giorno" :rules="[value => !!value || 'Giorno obbligatorio']" />
          <q-card-actions align="right" class="q-px-none q-pt-md">
            <q-btn flat label="Annulla" v-close-popup />
            <q-btn type="submit" color="primary" label="Salva" />
          </q-card-actions>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  emits: ['save'],
  data () {
    return {
      dialog: false,
      jobId: '',
      schedule: { frequency: 'daily', hour: 0, minute: 0, day_of_week: 'mon' },
      frequencies: [
        { label: 'Ogni ora', value: 'hourly' },
        { label: 'Ogni giorno', value: 'daily' },
        { label: 'Ogni settimana', value: 'weekly' }
      ],
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(value => ({ value, label: value }))
    }
  },
  methods: {
    open (job) {
      const current = job.schedule || {}
      this.jobId = job.id
      this.schedule = {
        frequency: current.frequency || (job.id === 'Controllo drift baseline profili' ? 'hourly' : 'daily'),
        hour: Number.isInteger(current.hour) ? current.hour : 0,
        minute: Number.isInteger(current.minute) ? current.minute : 0,
        day_of_week: current.day_of_week || 'mon'
      }
      this.dialog = true
    },
    submit () {
      this.$refs.scheduleForm.validate().then(valid => {
        if (!valid) return
        const schedule = { ...this.schedule }
        if (schedule.frequency !== 'weekly') delete schedule.day_of_week
        this.$emit('save', { id: this.jobId, schedule })
        this.dialog = false
      })
    }
  }
}
</script>
