<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Elenco benchmark disponibili
        <q-btn label="Rigenera" class="float-right text-capitalize text-indigo-8 shadow-3 q-mr-md" icon="monitor_heart" dense
          @click="benchmarks" >
          <q-tooltip>Genera il benchmark per tutte le liste</q-tooltip>
        </q-btn>

      </div>
      <input type="file" ref="fileInput" style="display: none" @change="handleFileImport" />
    </q-card-section>

    <q-card-section class="q-pa-none">
      <q-table :rows="data" :columns="columns">

        <template v-slot:body-cell-Action="props">
          <q-td :props="props">
            <q-btn icon="show_chart" size="sm" flat dense @click="onRowSelect(props.row)" />
          </q-td>
        </template>

        <!-- descrizione-->
        <template v-slot:body-cell-Descrizione="props">
          <q-td :props="props">
            <div v-if="editingRow && editingRow.name === props.row.name">
              <q-input v-model="editingRow.des" @blur="stopEditing" />
            </div>
            <div v-else @click="startEditing(props.row)">
              {{ props.row.des }}
            </div>
          </q-td>
        </template>

      </q-table>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, ref } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'
import { Notify } from 'quasar'; // Importa Notify da Quasar

const columns = [
  { name: 'Action', label: '', field: 'Action', sortable: false, align: 'center' },
  { name: 'Name', label: 'Name', field: 'name', sortable: true, align: 'left' },
  { name: 'Descrizione', label: 'Descrizione', field: 'des', sortable: true, align: 'left' },
  { name: 'Start', label: 'Da', field: 'start', sortable: true, align: 'left' },
  { name: 'End', label: 'A', field: 'end', sortable: true, align: 'left' },
];


export default defineComponent({
  name: "TableActions",
  setup(props, { emit }) {
    const data = ref([]); // Inizializza data come un array reattivo vuoto
    const editingRow = ref(null); // Nuova ref per tenere traccia dell'elemento in modifica

    // Funzione per recuperare i dati
    const fetchData = async () => {
      try {
        const response = await axios.get(constants.API_BASE_URL + '/dyn/bm/get-benchmarks');
        data.value = response.data; // Assegna i dati ricevuti alla variabile data
      } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
      }
    }

    const benchmarks = async () => {
      try {
        const response = await axios.get(constants.API_BASE_URL+'/dyn/bm/update');
        Notify.create({ type: 'positive', message: 'Dati inviati con successo!' });
      } catch (error) {
        Notify.create({ type: 'negative', message: 'Errore durante il caricamento dei dati:', error });
        // Gestisci l'errore come preferisci
      }
    };



    // Funzione per aggiornare la descrizione
    const updateDescription = async (row) => {
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/bm/update-benchmark/` + row.name, row);
        if (response.status === 200) {
          // Aggiorna i dati solo se il codice di stato è 200
          const index = data.value.findIndex(item => item.name === row.name);
          if (index !== -1) {
            data.value[index] = { ...data.value[index], ...row };
          }
        }
        // Aggiorna la UI o fai qualcos'altro qui se necessario
      } catch (error) {
        console.error("Errore durante l'aggiornamento dei dati: ", error);
      }
    };

    // Chiamata quando l'utente inizia a modificare una descrizione
    const startEditing = (row) => {
      editingRow.value = { ...row }; // Clona l'oggetto per evitare modifiche dirette
    };

    // Chiamata quando l'utente finisce la modifica
    const stopEditing = () => {
      updateDescription(editingRow.value);
      editingRow.value = null;
    };

    const onRowSelect = (row) => {
      emit('row-selected', row.name); // Usa 'emit' per emettere l'evento
    };

    fetchData(); // Richiama fetchData all'inizializzazione del componente

    return {
      data,
      columns,
      startEditing,
      stopEditing,
      editingRow,
      onRowSelect,
      benchmarks
    }
  }
})
</script>
