<template>
    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Schedulazione</div>
        </q-card-section>
  
        <q-card-section>
          <q-form ref="scheduleForm" @submit="onSubmit">
            <q-input
              v-model="scheduleData.name"
              label="Nome"
              filled
              required
              :rules="[val => !!val || 'Nome obbligatorio']"
            />
  
            <q-input v-model="scheduleData.id" type="hidden" />
  
            <q-select
              v-model="scheduleData.type"
              label="Tipo Schedulazione"
              :options="scheduleOptions"
              filled
              required
              :rules="[val => !!val || 'Tipo di schedulazione obbligatorio']"
            />
  
            <q-btn type="submit" label="Conferma" color="primary" />
          </q-form>
        </q-card-section>
  
        <q-card-actions align="right">
          <q-btn flat label="Chiudi" color="negative" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </template>
  
  <script>
  
  export default {
    data() {
      return {
        dialog: false,
        scheduleData: {
          id: '',
          name: '',
          type: ''
        },
        scheduleOptions: [
        { label: 'Orario', value: 'H' },
        { label: 'Giornaliero', value: 'D' },
        { label: 'Settimanale', value: 'W' }],
      };
    },
    methods: {
      // Funzione per aprire il dialog con i dati della riga
      scheduleDialog(row) {
        this.scheduleData.id = row.id || '';
        this.scheduleData.name = row.name || '';
        this.scheduleData.type = row.type || '';
        this.dialog = true;
      },
      async onSubmit() {
        if (this.$refs.scheduleForm.validate()) {
          // Emette un evento verso il componente padre con i dati del form
          this.$emit('confirm-schedule', { ...this.scheduleData });
          try {
          //  const response = await axios.post(constants.API_BASE_URL + '/dyn/mn/schedule', {
          //    id: this.scheduleData.id,
          //    name: this.scheduleData.name,
          //    type: this.scheduleData.type
          //  });
  
          //  this.$q.notify({
          //    color: 'positive',
          //    position: 'top',
          //    message: 'Schedulazione inviata con successo!',
          //    icon: 'cloud_done'
          //  });
  
            this.dialog = false;
          } catch (error) {
            this.$q.notify({
              color: 'negative',
              position: 'top',
              message: 'Errore durante l\'invio della schedulazione.',
              icon: 'error'
            });
          }
        } else {
          this.$q.notify({
            color: 'warning',
            position: 'top',
            message: 'Per favore, completa tutti i campi obbligatori.',
            icon: 'warning'
          });
        }
      }
    }
  };
  </script>
  