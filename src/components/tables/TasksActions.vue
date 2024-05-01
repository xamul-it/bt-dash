<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Inline Actions
        <q-btn label="Refresh" class="float-right text-capitalize text-green-8 shadow-3 q-mr-md" icon="refresh" @click="fetchData()"/>
        <q-btn label="Clear" class="float-right text-capitalize text-red-8 shadow-3 q-mr-md" icon="clear" @click="clear()"/>
      </div>
    </q-card-section>
    <q-card-section class="q-pa-none">
      <q-table :rows="rawData" :columns="columns">
        <template v-slot:body-cell-Name="props">
          <q-td :props="props">
            <q-item style="max-width: 420px">
              <q-item-section>
                <q-item-label>{{ props.row.name }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-td>
        </template>
        <template v-slot:body-cell-Action="props">
          <q-td :props="props">
            <q-btn :icon="props.row.pinned ? 'bookmark_remove' : 'bookmark_add '" size="sm" class="q-ml-sm" flat dense @click="pin_switch(props.row)" v-if="props.row.end"/>
            <q-btn icon="insights" size="sm" flat dense @click="openDialog(props.row)" v-if="props.row.end"/>
            <q-btn icon="delete" size="sm" class="q-ml-sm" flat dense @click="remove(props.row)" v-if="props.row.end"/>
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>

  <q-dialog v-model="dialogVisible" :fullscreen="false">
  <q-card class="dialog-card">
    <q-card-title>
      {{ title }}
    </q-card-title>
    <q-card-text>
      <iframe v-bind:src="src" width="100%" height="400px" frameborder="0"></iframe>
    </q-card-text>
    <q-card-actions>
      <q-btn @click="dialogVisible = false" flat dense>
        Chiudi
      </q-btn>
    </q-card-actions>
  </q-card>
</q-dialog>

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
import { defineComponent, ref  } from 'vue';
import useFormatEuro from '../../composables/useFormatEuro';
import useFormatTS from '../../composables/useFormatTS';
import axios from 'axios'
import { constants } from 'boot/constants'

//Finestra non visibile
const dialogVisible = ref(false);
const title = ref('Titolo Dialog'); // Example title variable
const src = ref('example-url'); // Example URL variable

const { formatEuro } = useFormatEuro();
const { formatTS } = useFormatTS();

const rawData = ref([])

// Trasforma la struttura dei dati per l'UI
const transformedData = ref([]);

const columns = [
  {name: 'Strategia', label: 'Strategia', field: row => row.args.strategia.label, sortable: true, align: 'left'},
  {name: 'Args.Da', label: 'Da', field: row => row.args.da, sortable: true, align: 'left'},
  {name: 'A', label: 'A', field: row => row.args.da, sortable: true, align: 'left'},
  {name: 'Cash', label: 'Cash', field: row => formatEuro(row.args.cash), sortable: true, align: 'left'},
  {name: 'Importo Op', label: 'Importo Operazioni', field: row => formatEuro(row.args.importoOperazioni), sortable: true, align: 'left'},
  {name: 'Starta', label: 'Start Date', field: row => row.start ? formatTS(row.start) : null, sortable: true, align: 'left'},
  {name: 'End', label: 'End Date', field: row => row.end ? formatTS(row.end) : null, sortable: true, align: 'left'},
  {name: 'Stato', label: 'Stato', field: 'stato', sortable: true, align: 'left'},
  {name: 'Action', label: '', field: 'Action', sortable: false, align: 'center'}
];


// Funzione per recuperare i dati
const fetchData = async () => {
  try {
    const response = await axios.get(constants.API_BASE_URL + '/dyn/mn/stato_chiamate');
    response.data.forEach(item => {
        console.log(item);
      });
    rawData.value = response.data; // Assegna i dati ricevuti alla variabile data
    console.info(rawData.value)
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
    console.info(rawData.value)
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
  src.value = constants.API_BASE_URL + (row.pinned ? "/stored/" : "/out/") + str + "/" + row.id + "/stats.html"
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


export default defineComponent({
  name: "TableActions",
  setup() {
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
      dialogVisible
    }
  }
})
</script>

<style scoped>

</style>
