<template>
  <q-card>
    <q-card-section>
      <div class="text-h6 text-grey-8">
        Elenco Liste Tickers
        <q-btn label="Update" class="float-right text-capitalize text-indigo-8 shadow-3" icon="update"
          @click="update" />
      </div>
      <input type="file" ref="fileInput" style="display: none" @change="handleFileImport" />
    </q-card-section>
    <q-card-section class="q-pa-none">
      <q-table :rows="data" :columns="columns" :pagination.sync="pagination">
        <template v-slot:body-cell-Name="props">
          <q-td :props="props">
            <q-btn flat @click="handleNameClick(props.row)" :label="props.row.filename" />
          </q-td>
        </template>
      </q-table>
    </q-card-section>

    <!-- Lightbox per il grafico e la tabella -->
    <q-dialog v-model="lightbox">
      <q-card style="width: 90vw; height: 90vh;">
        <q-card-section>
          <div class="text-h6">{{ selectedRow.filename }}</div>
        </q-card-section>
        <q-card-section style="height: 60%;">
          <line-chart :chart-data="chartData" :chart-options="chartOptions" />
        </q-card-section>
        <q-card-section style="height: 30%;">
          <q-table :rows="tableData" :columns="tableColumns" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Dialog per lo stato ko -->
    <q-dialog v-model="logDialog">
      <q-card>
        <q-card-section>
          <div class="text-h6">Log</div>
        </q-card-section>
        <q-card-section>
          <pre>{{ selectedRow.log }}</pre>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script>
import { defineComponent, ref, onMounted  } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale } from 'chart.js'
import { fasAmericanSignLanguageInterpreting } from '@quasar/extras/fontawesome-v5'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale)

const columns = [
  { name: 'Name', label: 'Name', field: 'filename', sortable: true, align: 'left' },
  { name: 'First Date', label: 'First Date', field: 'first', sortable: true, align: 'left' },
  { name: 'Last Date', label: 'Last Date', field: 'last', sortable: true, align: 'left' },
  { name: 'Updated', label: 'Updated', field: 'updated', sortable: true, align: 'left' },
  { name: 'Status', label: 'Stato', field: 'status', sortable: true, align: 'left' },
];

const pagination = {
  rowsPerPage: 0 // Imposta su 0 per 'All'
}

export default defineComponent({
  name: "TableActions",
  props: {
    dataUrl: {
      type: String,
      required: true
    },
  },
  components: {
    LineChart: {
      extends: Line,
      props: {
        chartData: {
          type: Object,
          required: true
        },
        chartOptions: {
          type: Object,
          required: true
        }
      },
      watch: {
        chartData() {
          this.$data._chart.update()
        }
      },
      mounted() {
        //this.init()
        //this.renderChart(this.chartData, this.chartOptions)
      }
    }
  },
  
  setup(props) {
    const data = ref([]); // Inizializza data come un array reattivo vuoto
    const lightbox = ref(false);
    const logDialog = ref(false);
    const selectedRow = ref({});
    const tableData = ref([]);
    const chartData = ref({
      labels: [],
      datasets: [
        {
          label: 'Close Price',
          data: [],
          borderColor: 'blue',
          fill: false
        }
      ]
    });

    const chartOptions = ref({
      responsive: true,
      maintainAspectRatio: false
    });

    const tableColumns = [
      { name: 'Date', label: 'Date', field: 'Date', align: 'left' },
      { name: 'Open', label: 'Open', field: 'Open', align: 'left' },
      { name: 'High', label: 'High', field: 'High', align: 'left' },
      { name: 'Low', label: 'Low', field: 'Low', align: 'left' },
      { name: 'Close', label: 'Close', field: 'Close', align: 'left' },
      { name: 'Adj Close', label: 'Adj Close', field: 'Adj Close', align: 'left' },
      { name: 'Volume', label: 'Volume', field: 'Volume', align: 'left' },
      { name: 'Dividends', label: 'Dividends', field: 'Dividends', align: 'left' },
      { name: 'Stock Splits', label: 'Stock Splits', field: 'Stock Splits', align: 'left' }
    ];

    const fetchData = async () => {
      try {
        const response = await axios.get(constants.API_BASE_URL + props.dataUrl);
        data.value = response.data; // Assegna i dati ricevuti alla variabile data
      } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
      }
    }

    const update = async () => {
      try {
        await axios.get(constants.API_BASE_URL + '/dyn/tk/update');
      } catch (error) {
        console.error('Errore durante il caricamento dei dati:', error);
      }
    };

    const handleNameClick = async (row) => {
      selectedRow.value = row;
      if (row.status === 'ok') {
        try {
          const response = await axios.get(`${constants.API_BASE_URL}/dyn/tk/get/${row.filename}`);
          const csvData = response.data;
          const parsedData = csvData.split('\n').slice(1).map(line => {
            const [Date, Open, High, Low, Close, AdjClose, Volume, Dividends, StockSplits] = line.split(',');
            return {
              Date,
              Open: parseFloat(Open).toFixed(2),
              High: parseFloat(High).toFixed(2),
              Low: parseFloat(Low).toFixed(2),
              Close: parseFloat(Close).toFixed(2),
              'Adj Close': parseFloat(AdjClose).toFixed(2), 
              Volume: parseInt(Volume, 10),
              Dividends: parseFloat(Dividends).toFixed(2),
              'Stock Splits': parseFloat(StockSplits).toFixed(2)
            };
          });

          tableData.value = parsedData;
          chartData.value.labels = parsedData.map(item => item.Date);
          chartData.value.datasets[0].data = parsedData.map(item => item.Close);

          lightbox.value = true;
        } catch (error) {
          console.error('Errore durante il caricamento del file:', error);
        }
      } else {
        logDialog.value = true;
      }
    };

    onMounted(() => {
      fetchData();
    });


    //fetchData(); // Richiama fetchData all'inizializzazione del componente

    return {
      data,
      columns,
      pagination,
      update,
      handleNameClick,
      lightbox,
      logDialog,
      selectedRow,
      tableData,
      tableColumns,
      chartData,
      chartOptions
    }
  }
  
})
</script>
