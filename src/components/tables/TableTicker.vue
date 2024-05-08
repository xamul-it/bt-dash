<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Elenco Liste Tickers
        <q-btn label="Update" class="float-right text-capitalize text-indigo-8 shadow-3" icon="update"
          @click="triggerFileInput" />
      </div>
      <input type="file" ref="fileInput" style="display: none" @change="handleFileImport" />
    </q-card-section>
    <q-card-section class="q-pa-none">
      <q-table :rows="data" :columns="columns" :pagination.sync="pagination">

      </q-table>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, ref } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'

/*
Aggiungere gestione blacklist
*/
const columns = [
  { name: 'Name', label: 'Name', field: 'filename', sortable: true, align: 'left' },
  { name: 'First Date', label: 'First Date', field: 'first', sortable: true, align: 'left' },
  { name: 'Last Date', label: 'Last Date', field: 'last', sortable: true, align: 'left' },
  { name: 'Updated', label: 'Updated', field: 'updated', sortable: true, align: 'left' },
];

const pagination = {
        rowsPerPage: 0 // Imposta su 0 per 'All'
      }

export default defineComponent({
  name: "TableActions",
  setup() {
    const data = ref([]); // Inizializza data come un array reattivo vuoto

    // Funzione per recuperare i dati
    const fetchData = async () => {
      try {
        const response = await axios.get(constants.API_BASE_URL+'/dyn/tk/list');
        data.value = response.data; // Assegna i dati ricevuti alla variabile data
      } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
        // Gestisci l'errore come preferisci
      }
    }

    fetchData(); // Richiama fetchData all'inizializzazione del componente

    return {
      data,
      columns,
      pagination
    }
  }
})
</script>