<template>
  <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
    <q-card>
      <q-form @submit.prevent="submitForm" class="q-pa-md">
        <!-- Select per i prefissi -->
        <q-select label="Seleziona Gruppo" :options="prefissiOptions" v-model="form.selectedPrefisso"
        @update:model-value="filterStrategies" />
        <!-- Strategia -->
        <q-select label="Strategia" :options="filteredStrategie" v-model="form.strategia" />

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
        <q-input v-if="form.tipoTickers === 'free'" label="Tickers" type="text" v-model="form.tickers"
          class="q-mb-md" />
        <div style="height: 20px;"></div> <!-- Aggiungi uno spaziatore qui -->

        <!-- Broker -->
        <q-select label="Broker" :options="broker" v-model="form.broker" />

        <q-btn label="Invia" @click="inviaDati" color="primary" class="q-mb-lg" />
        <q-toggle label="Debug Mode" v-model="form.debug" class="q-mb-lg" />


      </q-form>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, ref, computed, reactive, watch } from 'vue';
import axios from 'axios'
import { constants } from 'boot/constants'
import { Notify } from 'quasar'; // Importa Notify da Quasar


export default defineComponent({
  name: 'StrategyForm',
  props: {
    initialValues: {
      type: Object,
      default: () => ({})
    }
  },


  setup(props, { emit }) {

    const forms = reactive({ ...props.initialValues });

    watch(() => props.initialValues, (newValues) => {
      Object.assign(forms, newValues);
    }, { immediate: true });


    const today = new Date();
    const threeYearsAgo = new Date(new Date().setFullYear(today.getFullYear() - 3));
    const strategie = ref([]);
    const prefissiOptions = ref([]);
    const filteredStrategie = ref([]);
    const selectedPrefisso = 'Tutto';
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

    const broker = ref([
      { label: 'Default Internal', value: 'default' },
      { label: 'Alpaca', value: 'alpaca' },
    ]);

    async function inviaDati() {
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/mn/main`, form.value);
        Notify.create({ type: 'positive', message: 'Dati inviati con successo!' });
        emit('form-submitted');
      } catch (error) {
        console.error('Errore nell\'invio dei dati:', error);
        Notify.create({ type: 'negative', message: 'Errore nell\'invio dei dati:'+error });
      }
    }

    async function fetchData() {
      
      loading.value = true;
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/st/list`);
        strategie.value = response.data;
        //form.value.strategia = strategie.value[0];

        const tl = await axios.get(`${constants.API_BASE_URL}/dyn/tk/options`);
        tickerList.value = tl.data;
        //form.value.tickerList = tickerList.value[0];
        //Inizializzo i prefissi
        let prefissiSet = new Set(strategie.value.map(item => item.value.split('.')[0]));
        prefissiOptions.value = ['Tutto', ...prefissiSet];

        filteredStrategie.value = strategie.value

      } catch (e) {
        error.value = e;
        console.error(error)
      } finally {
        loading.value = false;
      }
    }


    fetchData();
    const form = ref({});


    const formold = ref({
      strategia: '',
      selectedPrefisso: prefissiOptions.value[0],
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

    function filterStrategies() {
      if (form.value.selectedPrefisso === 'Tutto') {
        filteredStrategie.value = strategie.value;
      } else {
        filteredStrategie.value = strategie.value.filter(s =>
          s.value.startsWith(form.value.selectedPrefisso + '.')
        );
        form.value.strategia= ''
      }
    }

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
      filteredStrategie,
      tipoCommissioni,
      tipiTickers,
      tickerList,
      formatCurrency,
      parseCurrency,
      formattedImportoOperazioni,
      formattedCash,
      prefissiOptions,
      filterStrategies,
      forms,
      broker
    };
  }
});
</script>