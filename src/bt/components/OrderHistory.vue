<template>
    <div class="full-width q-pa-md container"> 
      <!-- Finestra modale -->
          <q-card-section>
            <div class="text-h6">Elenco Ordini</div>
            <!-- Checkbox per nascondere le righe in grigio -->
            <q-checkbox
                v-model="hideGreyRows"
                label="Nascondi righe non eseguite"
            />
          </q-card-section>
  
          <q-card-section>
            <!-- Tabella degli ordini -->
            <q-table
              :rows="filteredOrders"
              :columns="columns"
              row-key="id"
              class="q-table--full-width custom-table"
            >
              <!-- Espansione della riga -->
              <template v-slot:body="props">
                <q-tr :props="props" @click="onRowClick(props.row)"
                :class="getRowClass(props.row)">
                  <q-td v-for="col in props.cols" :key="col.name" :props="props">
                    {{ col.value }}
                  </q-td>
                </q-tr>
                <q-tr v-if="props.row.expand" :props="props">
                  <q-td colspan="100%">
                      <ul>
                        <li v-for="(event, index) in props.row.events" :key="index">
                            {{ event.status }} - {{ event.datetime }} (Bar: {{ event.bar }})
                        </li>
                      </ul>
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </q-card-section>
  
    </div>
  </template>
  
  <script>
  import axios from 'axios'

  export default {
    props: {
        url: {
            type: String,
            required: true,
        },
        value: {
            type: Boolean,
            //required: true,
            default: true
        },
    },
    computed: {
        storicoVisible: {
        get() {
            return this.value;
            },
        set(newValue) {
            this.$emit("input", newValue);
            },
        },
           // Filtra le righe in base allo stato della checkbox
        filteredOrders() {
            if (this.hideGreyRows) {
                return this.orders.filter(order => !['Rejected', 'Margin', 'Canceled'].includes(order.status));
            }
            return this.orders;
        },
    },
    data() {
      return {
        hideGreyRows: true, // Stato della checkbox
        orders: [], // Dati degli ordini (popolati dal JSON)
        columns: [
          { name: 'id', label: 'ID', field: 'id', align: 'left' },
          { name: 'asset', label: 'Asset', field: 'asset', align: 'left', sortable: true },
          { name: 'status', label: 'Stato', field: 'status', align: 'left', sortable: true },
          { name: 'datetime', label: 'Data', field: 'datetime', align: 'left', sortable: true, format: (val) => val.split(' ')[0], },
          { name: 'lastdatetime', label: 'Aggiornamento', field: 'lastdatetime', align: 'left', sortable: true, format: (val) => val.split(' ')[0], },
          { name: 'type', label: 'Tipo', field: 'type', align: 'left' }, // Nuova colonna
          { name: 'quantity', label: 'Quantità', field: 'quantity', align: 'left', sortable: true }, // Nuova colonna
        ],
      };
    },
    watch: {
        // Carica i dati quando l'URL cambia
        url: {
            immediate: true,
            handler(newUrl) {
                this.loadOrders(newUrl);
            },
        },
    },
    methods: {
      // Gestisce il click sulla riga
      onRowClick(row) {
        console.error("Eccomi sulla riga "+row)
        // Chiudi tutte le righe tranne quella cliccata
        this.orders.forEach(order => {
            if (order.id !== row.id) {
                order.expand = false;
            }
        });

        // Espandi/comprime la riga cliccata
        row.expand = !row.expand;
      },
      getRowClass(row) {
        if (row.status === 'Completed' && row.type === 'buy') {
            return 'text-bold text-green';
        } else if (row.status === 'Completed' && row.type === 'sell') {
            return 'text-bold text-red';
        } else if (row.status === 'Submitted') {
            return 'text-black';
        } else if (['Rejected', 'Margin', 'Canceled'].includes(row.status)) {
            return 'text-grey';
        }
        return ''; // Nessuna classe aggiuntiva
      },
      // Carica i dati degli ordini (simulazione)
      async loadOrders(url) {
        try {
            const response = await axios.get(url);
            this.orders = response.data.map(order => ({
                ...order,
                expand: false, // Aggiungi il campo `expand` e impostalo su `false`
            }));
            //this.orders = response.data; // Aggiorna i dati degli ordini
        } catch (error) {
            // Esempio di dati (sostituisci con il JSON reale)
            console.error("Errore nel caricamento degli ordini:", error);
        }
      },
    },
    mounted() {
        console.log("Valore della prop 'value':", this.value); // Debug
    },
  };
  </script>
  
  <style scoped>
  /* Stili personalizzati */
  .q-table {
    width: 100%;
  }
  .q-pa-md {
    padding: 16px;
  }

.container {
  width: 500px;
  max-width: 1200px;
  overflow-x: auto; /* Scrollbar orizzontale nel contenitore */
}

.custom-table {
  width: 100%;
  table-layout: auto; /* Impedisce alla tabella di superare la larghezza del contenitore */
}
</style>