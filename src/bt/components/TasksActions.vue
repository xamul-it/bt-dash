<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Inline Actions
        <q-btn label="Refresh" class="float-right text-capitalize text-blue-8 shadow-3 q-mr-md" icon="refresh"  dense @click="fetchData()"/>
        <q-btn label="Clear" class="float-right text-capitalize text-red-8 shadow-3 q-mr-md" icon="clear"   dense @click="clear()"/>
        <q-btn label="New" class="float-right text-capitalize text-green-8 shadow-3 q-mr-md" icon="addchart"  dense @click="newForm()"/>
        <!-- q-btn label="Code" class="float-right text-capitalize text-green-8 shadow-3 q-mr-md" icon="code" dense @click="showJson()"/ -->
      </div>
    </q-card-section>
    <q-card-section class="q-pa-none">
      <q-table :rows="rawData" :columns="columns" v-model:pagination="pagination">

        <template v-slot:body-cell-Name="props">
          <q-td :props="props">
            <q-item style="max-width: 420px">
              <q-item-section>
                <q-item-label>{{ props.row.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-td>
        </template>

        <template v-slot:body-cell-Strategia="props" >
          <q-td :props="props" v-if="props.row.args">
            <q-item-label v-if="props.row.args">{{ (props.row.args.strategia ? props.row.args.strategia.label : "" ) }}</q-item-label>
            <q-item-label v-if="props.row.args">{{ props.row.args.parametriStrategia }}</q-item-label>
          </q-td>
        </template>

        <template v-slot:body-cell-Run="props" >
          <q-td :props="props" v-if="props.row.args">
            <q-item-label>{{ formatTS(props.row.start) }}</q-item-label>
            <q-item-label>{{ formatTS(props.row.end) }}</q-item-label>
          </q-td>
        </template>

        <template v-slot:body-cell-Date="props">
          <q-td :props="props"  v-if="props.row.args">
            <q-item-label>{{ props.row.args.da }}</q-item-label>
            <q-item-label>{{ props.row.args.a }}</q-item-label>
          </q-td>
        </template>

        <template v-slot:body-cell-Importi="props">
          <q-td :props="props" v-if="props.row.args">
            <q-item-label>{{ formatEuro(props.row.args.cash) }}</q-item-label>
            <q-item-label>{{ formatEuro(props.row.args.importoOperazioni) }}</q-item-label>
          </q-td>
        </template>

        <template v-slot:body-cell-Stato="props">
          <q-td :props="props">
            <q-icon size="sm" flat dense :name="getStatusIcon(props.row.stato)" :color="getStatusColor(props.row.stato)"/>
            <div v-if="props.row.stato === 'Errore'" class="text-negative text-caption">{{ props.row.errorMessage }}</div>
          </q-td>
        </template>

        <template v-slot:body-cell-Action="props">
          <q-td :props="props">
            <q-btn icon="timer" size="sm" class="q-ml-sm" flat dense @click="schedule(props.row)" v-if="props.row.end"/>
            <q-btn :icon="props.row.pinned ? 'remove' : 'add '" size="sm" class="q-ml-sm" flat dense @click="pin_switch(props.row)" v-if="props.row.end"/>
            <q-btn icon="candlestick_chart" size="sm" class="q-ml-sm" flat dense @click="candle(props.row)" v-if="props.row.end"/>
            <q-btn icon="insights" size="sm" flat dense @click="openDialog(props.row)" v-if="props.row.end"/>
            <q-btn icon="delete" size="sm" class="q-ml-sm" flat dense @click="remove(props.row)" v-if="props.row.stato !== 'In esecuzione'"/>
            <q-btn icon="copy_all" size="sm" class="q-ml-sm" flat dense @click="copyform(props.row)"/>
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>

  <q-dialog v-model="dialogVisible" :fullscreen="false">
  <q-card class="dialog-card">
    <div class="text-h6">
      {{ title }}
    </div>
    
    <iframe v-bind:src="src" width="100%" height="400px" frameborder="0"></iframe>
    <q-card-actions>
      <q-btn @click="dialogVisible = false" flat dense>
        Chiudi
      </q-btn>
    </q-card-actions>
  </q-card>
</q-dialog>

<q-dialog v-model="isLightboxOpen">
    <q-card>
      <q-card-section>
        <strategy-form @form-submitted="handleFormSubmitted" ref="strategyFormRef"/>
      </q-card-section>
    </q-card>
</q-dialog>

<ScheduleDialog ref="scheduleDialog" @confirm-schedule="handleSchedule"/>


</template>

<style scoped>
 
  .q-dialog {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
  }

  .dialog-card {
    width: 100%;
    max-width: 1100px;
    box-sizing: border-box;
  }
</style>

<script>
import { nextTick, defineComponent, ref, onMounted, onBeforeUnmount  } from 'vue';
import useFormatEuro from '../../composables/useFormatEuro';
import useFormatTS from '../../composables/useFormatTS';
import StrategyForm from 'src/bt/components/StrategyForm';
import ScheduleDialog from 'src/bt/components/ScheduleDialog';

import axios from 'axios'
import { constants } from 'boot/constants'
import { Notify } from 'quasar'; // Importa Notify da Quasar


//Finestra non visibile
const dialogVisible = ref(false);
const title = ref('Titolo Dialog'); // Example title variable
const src = ref('example-url'); // Example URL variable


const { formatEuro } = useFormatEuro();
const { formatTS } = useFormatTS();

const rawData = ref([])

// Trasforma la struttura dei dati per l'UI
const transformedData = ref([]);

const isLightboxOpen = ref(false);
//Contenitore per i dati del form
const strategyFormRef  = ref(null);
const pagination = ref({ page: 1, rowsPerPage: 50 });


const columns = [
  {name: 'Strategia', label: 'Strategia', field: row => row.args.strategia ? row.args.strategia.label : "", sortable: true, align: 'left'},
  {name: 'Date', label: 'Date', field: row => row.args.da, sortable: true, align: 'left'},
  {name: 'Importi', label: 'Importi', field: row => formatEuro(row.args.cash), sortable: true, align: 'left'},
  {name: 'Run', label: 'Run', field: row => formatTS(row.start), sortable: true, align: 'left'},
  {name: 'Tickers', label: 'tickers', field: row => row.args && row.args.tickerList ? row.args.tickerList.label : "", sortable: true, align: 'left'},
  {name: 'Stato', label: 'Stato', field: 'stato', sortable: true, align: 'left'},
  {name: 'Action', label: '', field: 'Action', sortable: false, align: 'center'}
];


// Funzione per recuperare i dati
const fetchData = async () => {
  try {
    const response = await axios.get(constants.API_BASE_URL + '/dyn/mn/stato_chiamate');
    rawData.value = response.data; // Assegna i dati ricevuti alla variabile data
  } catch (error) {
    console.error('Errore durante il caricamento dei dati:', error);
  }
}

// Funzione per recuperare i dati
const clear = async () => {
  try {
    const response = await axios.get(constants.API_BASE_URL + '/dyn/mn/clear');
    response.data.forEach(item => {
        console.log(item);
      });
    rawData.value = response.data; // Assegna i dati ricevuti alla variabile data
  } catch (error) {
    console.error('Errore durante il caricamento dei dati:', error);
  }
}

fetchData()

const openDialog = (row) => {
  // Split the string based on the dot (.) character
  const lab = row.args.strategia.label
  const parts = lab.split('.');
  const str = parts.slice(-1)[0];
  title.value = "Factsheet " + str
  src.value = constants.API_BASE_URL + (row.pinned ? "/fs/data/stored/" : "/fs/out/") + str + "/" + row.id + "/stats.html"
  dialogVisible.value = true;

};


const candle = (row) => {
  // Split the string based on the dot (.) character
  const lab = row.args.strategia.label
  const parts = lab.split('.');
  const str = parts.slice(-1)[0];
  title.value = "Posizione " + str
  src.value = "/#/details/" + str + "/" + row.id
  if (row.pinned)
    src.value += "/pin"
  dialogVisible.value = true;

};


const pin_switch = async (row) => {
  // Split the string based on the dot (.) character
  const id = row.id
  try {
    const response = await axios.post(constants.API_BASE_URL + '/dyn/mn/pin-switch', {id});
  } catch (error) {
    console.error('Errore durante il caricamento dei dati:', error);
  }finally  {
    fetchData()
  }
};


const remove = async (row) => {
  // Split the string based on the dot (.) character
  const id = row.id
  try {
    const response = await axios.post(constants.API_BASE_URL + '/dyn/mn/delete', {id});
  } catch (error) {
    console.error('Errore durante il caricamento dei dati:', error);
  }finally  {
    fetchData()
  }
};

const newForm = () => {
  //Pulisco il form?
      //formData.value = {}; // Reset form data
      isLightboxOpen.value = true;
  };

const handleFormSubmitted = () => {
    isLightboxOpen.value = false;
    fetchData();
  };


const getStatusIcon = (status) => {
    switch (status) {
      case 'In esecuzione':
        return 'hourglass_empty';
      case 'Completato':
        return 'check_circle';
      case 'Errore':
        return 'error';
      default:
        return 'question_mark';
    }
  };

  const getStatusColor = (status) => {
      switch (status) {
        case 'In esecuzione':
          return 'yellow';
        case 'Completato':
          return 'green';
        case 'Errore':
          return 'red';
        default:
          return 'grey';
      }
    };

  const copyform = async (row) => {
    isLightboxOpen.value = true;
    await nextTick(); // Assicurati che il DOM sia aggiornato
    if (strategyFormRef.value) {
        strategyFormRef.value.form = { ...row.args };
      }
  };

  export default defineComponent({
  name: "TableActions",
  components: {
    StrategyForm,
    ScheduleDialog
  },
  methods: {
    schedule(row) {
      // Assicurati che `this` si riferisca all'istanza Vue
      this.$refs.scheduleDialog.scheduleDialog(row);
    },
    // Gestisci i dati emessi dall'evento del componente figlio
    async handleSchedule(scheduleData) {
      try {
        const response = await axios.post(constants.API_BASE_URL + '/dyn/mn/schedule', scheduleData);

        this.$q.notify({
          color: 'positive',
          position: 'top',
          message: 'Schedulazione inviata con successo!',
          icon: 'cloud_done'
        });
      } catch (error) {
        this.$q.notify({
          color: 'negative',
          position: 'top',
          message: 'Errore durante l\'invio della schedulazione.',
          icon: 'error'
        });
      }
    }
  },
  setup() {

    // Esegui fetchData ogni 10 secondi
    onMounted(() => {
      fetchData();
      const intervalId = setInterval(fetchData, 10000);

      // Pulisci l'intervallo quando il componente viene distrutto
      onBeforeUnmount(() => {
        clearInterval(intervalId);
      });
    });

    return {
      transformedData,
      rawData,
      columns,
      openDialog,
      remove,
      fetchData,
      clear,
      pin_switch,
      title,
      src,
      dialogVisible,
      newForm,
      fetchData,
      isLightboxOpen,
      handleFormSubmitted,
      getStatusIcon,
      getStatusColor,
      pagination,
      copyform,
      strategyFormRef,
      formatEuro,
      formatTS,
      candle
    }
  }
})
</script>

<style scoped>

</style>
