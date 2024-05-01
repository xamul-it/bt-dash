<template>
  <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
    <q-card>
      <q-form class="q-pa-md">
        <!-- Strategia -->
        <q-select label="Strategia" :options="strategie" v-model="form.strategia" />

        <!-- Parametri Strategia -->
        <q-input label="Parametri Strategia" type="text" v-model="form.parametriStrategia" />

        <div class="row items-center q-gutter-sm">

          <!-- Campo Da (data) -->
          <div class="col">
            <q-input filled v-model="form.da" label="Da">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy transition-show="scale" transition-hide="scale">
                    <q-date v-model="form.da" mask="YYYY-MM-DD" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- Campo A (data) -->
          <div class="col-6">
            <q-input filled v-model="form.a" label="A">
              <template v-slot:append>
                <q-icon name="event" class="cursor-pointer">
                  <q-popup-proxy transition-show="scale" transition-hide="scale">
                    <q-date v-model="form.a" mask="YYYY-MM-DD" />
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>
        </div>

        <div class="row items-center q-gutter-sm">
          <!-- Cash (valuta) -->
          <div class="col">
            <q-input label="Cash" type="text" prefix="€" v-model.lazy="formattedCash" />
          </div>

          <div class="col">
            <!-- Importo Operazioni (valuta) v-model="form.importoOperazioni"-->
            <q-input label="Importo Operazioni" type="text" prefix="€" v-model.lazy="formattedImportoOperazioni" />
          </div>
        </div>
        <!-- Tipo commissioni -->
        <q-select label="Tipo Commissioni" :options="tipoCommissioni" v-model="form.tipoCommissioni" />

        <!-- Tipo Tickers -->
        <q-option-group v-model="form.tipoTickers" type="radio" :options="tipiTickers" inline />

        <!-- ticker list (attivato se si sceglie 'lista') -->
        <q-select v-if="form.tipoTickers === 'lista'" label="Ticker List" :options="tickerList"
          v-model="form.tickerList" />

        <!-- ticker (attivato se si sceglie 'ticker') -->
        <q-input v-if="form.tipoTickers === 'ticker'" label="Ticker" v-model="form.ticker" />

        <!-- tickers (testo, attivato se si sceglie 'free') -->
        <q-input v-if="form.tipoTickers === 'free'" label="Tickers" type="text" v-model="form.tickers" class="q-mb-md"/>
        <div style="height: 20px;"></div>  <!-- Aggiungi uno spaziatore qui -->

        <q-btn label="Invia" @click="inviaDati" color="primary" class="q-mb-lg" />
        <q-toggle label="Debug Mode" v-model="form.debug" class="q-mb-lg"/>
        
      </q-form>
    </q-card>
  </div>
</template>
  
<script>
import { defineComponent, ref, computed } from 'vue';
import axios from 'axios'
import { constants } from 'boot/constants'



export default defineComponent({
  setup() {
    const today = new Date();
    const threeYearsAgo = new Date(new Date().setFullYear(today.getFullYear() - 3));
    const strategie = ref([]);
    const tickerList = ref([]);
    const loading = ref(false);
    const error = ref(null);

    const tipoCommissioni = ref([
      // Definisci le opzioni per la select 'Tipo Commissioni'
      { label: 'Nessuna', value: 'none' },
      { label: 'Fineco (2.75 + tobin)', value: 'fineco' },
      { label: 'Fineco (2.75)', value: 'lfineco' },
    ]);

    const tipiTickers = ref([
      { label: 'Lista', value: 'lista' },
      { label: 'Ticker', value: 'ticker' },
      { label: 'Free', value: 'free' },
    ]);


    async function inviaDati() {
      try {
        // sostituisci `axios` con il tuo metodo di chiamata API preferito
        // per questo esempio, assumeremo che tu abbia configurato Axios globalmente
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/mn/main`, form.value);
        $q.notify({ type: 'positive', message: 'Dati inviati con successo!' });
      } catch (error) {
        console.error('Errore nell\'invio dei dati:', error);
        $q.notify({ type: 'negative', message: 'Errore nell\'invio dei dati.' });
      }
    }

    async function fetchData() {
      loading.value = true;
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/strategies/index.json`);
        strategie.value = response.data;
        form.value.strategia = strategie.value[0]; 

        const tl = await axios.get(`${constants.API_BASE_URL}/dyn/tk/options`);
        tickerList.value = tl.data;
        form.value.tickerList = tickerList.value[0]; 

      } catch (e) {
        error.value = e;
        console.error(error)
      } finally {
        loading.value = false;
      }
    }

    fetchData();

    const form = ref({
      strategia: '',
      parametriStrategia: '',
      da: threeYearsAgo.toISOString().split('T')[0], // Formatta la data in formato YYYY-MM-DD
      a: today.toISOString().split('T')[0], // Formatta la data in formato YYYY-MM-DD
      cash: 200000,
      importoOperazioni: 10000,
      tipoCommissioni: tipoCommissioni.value[1],
      tipoTickers: tipiTickers.value[0].value,
      tickerList: '',
      ticker: '',
      tickers: '',
      debug: false,
    });


    function formatCurrency(value) {
      const formatter = new Intl.NumberFormat('it-IT', { // 'it-IT' usa il punto per migliaia e virgola per decimali
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
      return formatter.format(value);
    }

    function parseCurrency(value) {
      // Rimuovi formattazione e converti in numero
      return parseFloat(value.replace(/\./g, '').replace(/,/g, '.'));
    }

    // Calcolato per ottenere/settare il valore formattato
    const formattedImportoOperazioni = computed({
      get: () => formatCurrency(form.value.importoOperazioni),
      set: val => form.value.importoOperazioni = parseCurrency(val)
    });

    // Calcolato per ottenere/settare il valore formattato
    const formattedCash = computed({
      get: () => formatCurrency(form.value.cash),
      set: val => form.value.cash = parseCurrency(val)
    });

    return {
      form,
      inviaDati,
      strategie,
      tipoCommissioni,
      tipiTickers,
      tickerList,
      formatCurrency,
      parseCurrency,
      formattedImportoOperazioni,
      formattedCash
    };
  }
});
</script>
  