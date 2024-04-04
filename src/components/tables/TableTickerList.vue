<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Elenco Liste Tickers
        <q-btn label="Import" class="float-right text-capitalize text-indigo-8 shadow-3" icon="cloud_upload"
          @click="triggerFileInput" />
      </div>
      <input type="file" ref="fileInput" style="display: none" @change="handleFileImport" />
    </q-card-section>
    <q-card-section class="q-pa-none">
      <q-table :rows="data" :columns="columns">

        <template v-slot:body-cell-Name="props">
          <q-td :props="props">
            <q-item style="max-width: 420px">
              <q-item-section avatar>
                <q-avatar>
                  <img :src="props.row.avatar">
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <div v-if="editingRow && editingRow.name === props.row.name">
                  <q-input v-model="editingRow.avatar" @blur="stopEditing" />
                </div>
                <div v-else @click="startEditing(props.row)">
                  <q-item-label>{{ props.row.name }}</q-item-label>
                </div>
              </q-item-section>
            </q-item>
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


        <template v-slot:body-cell-Action="props">
          <q-td :props="props">
            <q-btn icon="edit" size="sm" flat dense @click="openDialog(props.row)" />
            <!--q-btn icon="delete" size="sm" class="q-ml-sm" flat dense/-->
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>


  <q-dialog v-model="isDialogOpen" style="width: 40vw; height: 80vh;" @hide="updateBlacklist">
    <q-card style="width: 100%; height: 100%;">
      <q-card-section>
        <div class="text-h6">Dettagli della lista {{ selectedName }}</div>
      </q-card-section>

      <q-card-section>
        <q-list>
          <q-item v-for="(item, index) in selectedRecord" :key="index" class="q-py-xs"
            :class="{ 'item-blacklisted': isBlacklisted(item), 'item-not-blacklisted': !isBlacklisted(item) }">
            <q-item-section>
              {{ item }}
            </q-item-section>
            <q-item-section side>
              <q-btn flat :icon="isBlacklisted(item) ? 'done' : 'clear'" @click="switchItem(item)" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Chiudi" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, ref } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'

const columns = [
  { name: 'Name', label: 'Name', field: 'name', sortable: true, align: 'left' },
  { name: 'Descrizione', label: 'Descrizione', field: 'des', sortable: true, align: 'left' },
  { name: 'Created Date', label: 'Created Date', field: 'created', sortable: true, align: 'left' },
  { name: 'Updated Date', label: 'Updated Date', field: 'updated', sortable: true, align: 'left' },
  { name: 'Num tickers', label: 'Num', field: 'num', sortable: true, align: 'left' },
  { name: 'Action', label: '', field: 'Action', sortable: false, align: 'center' }
];


export default defineComponent({
  name: "TableActions",
  setup() {
    const data = ref([]); // Inizializza data come un array reattivo vuoto
    const editingRow = ref(null); // Nuova ref per tenere traccia dell'elemento in modifica

    // Funzione per aggiornare la descrizione
    const updateDescription = async (row) => {
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/tk/update-tickerls/` + row.name, row);
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
    }

    const isBlacklisted = (item) => {
      return blacklist.value.includes(item);
    };

    const updateBlacklist = async (listName) => {
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/tk/update-tickers/bl`, blacklist.value);
        // Gestisci la risposta, se necessario
        console.log(response.data);
      } catch (error) {
        console.error('Errore durante l\'invio dei dati:', error);
      }

    };

    const switchItem = (item) => {
      const index = blacklist.value.indexOf(item);
      if (index !== -1) {
        blacklist.value.splice(index, 1);
      } else {
        blacklist.value.push(item);
      }
    };

    // Funzione per recuperare i dati
    const fetchData = async () => {
      try {
        const response = await axios.get(constants.API_BASE_URL+'/dyn/tk/get-tickerls');
        data.value = response.data; // Assegna i dati ricevuti alla variabile data
      } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
        // Gestisci l'errore come preferisci
      }
    }

    //dialog
    const isDialogOpen = ref(false);
    const selectedRecord = ref({}); // Qui memorizzerai i dettagli del record selezionato
    const blacklist = ref({});
    const selectedName = ref('');
    const openDialog = async (record) => {
      // Carica i dettagli del record qui (ad esempio, usando axios)

      const bl = await axios.get(`${constants.API_BASE_URL}/dyn/tk/tickerls/bl`);
      blacklist.value = bl.data;

      const response = await axios.get(`${constants.API_BASE_URL}/dyn/tk/tickerls/${record.name}`);
      selectedRecord.value = response.data;
      selectedName.value = record.name;
      isDialogOpen.value = true;
    };

    //Importazione
    const fileInput = ref(null);

    const triggerFileInput = () => {
      fileInput.value.click();
    };

    const handleFileImport = async (event) => {
      const file = event.target.files[0];
      if (file) {
        const listName = file.name.replace(/\.[^/.]+$/, ""); // Rimuove l'estensione

        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            //const formData = new FormData();
            //formData.append('file', file);
            const content = JSON.parse(e.target.result);
            const response = await axios.post(`${constants.API_BASE_URL}/dyn/tk/update-tickers/${listName}`, content, {
              headers: {
                'Content-Type': 'application/json'
              }
            });
            // Gestisci la risposta
            alert(response.data)
            console.log(response.data);
          }
        } catch (error) {
          console.error('Errore durante l\'invio del file:', error);
        }
      }
    };

    fetchData(); // Richiama fetchData all'inizializzazione del componente

    return {
      data,
      columns,
      editingRow,
      startEditing,
      stopEditing,
      updateDescription,
      openDialog,
      isDialogOpen,
      selectedRecord,
      selectedName,
      blacklist,
      isBlacklisted,
      switchItem,
      updateBlacklist,
      fileInput,
      triggerFileInput,
      handleFileImport,
    }
  }
})
</script>

<style scoped>
.item-blacklisted {
  color: red;
}

.item-not-blacklisted {
  color: black;
}
</style>
