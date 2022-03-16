<template>
  <q-card>
    <q-item>

      <q-item-section>
        <q-item-label class="text-grey-8 text-weight-bold" :style="[data.PNL<0 ? {'color': 'red !important'}:'']">{{ name }}</q-item-label>
      </q-item-section>

      <q-item-section side>
        <q-item-label class="text-grey-8">
          <a ref="link" :href="baseURL+'/'+name+constants.STATS_FILE" target="_blank" style="text-decoration: none;"><!--{{ index }} {{ backup }}--> <q-icon name="insights" color="secondary" size="20px"/></a>
          <q-tooltip>
            Statistiche
          </q-tooltip>
        </q-item-label>

      </q-item-section>
    </q-item>

    <q-separator></q-separator>

    <q-card-section>

      <div class="q-pa-sm text-grey-8">

        <q-item-label>
          <!-- q-btn size="sm" flat round icon="date_range" class="bg-indigo-7 text-white" title="Date range"/ -->
          <q-icon name="date_range" color="blue" size="20px"/>
          {{data.fromdate}}
          -
          {{data.todate}}
          <q-tooltip>
            Intervallo date
          </q-tooltip>
        </q-item-label>

      </div>

      <div class="q-pa-sm row">

         <div class="text-grey-8 col">

           <q-item-label>
            <q-icon name="account_balance_wallet" color="gray" size="20px"/>
            <span :style="[data['ptf inizio']<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data['ptf inizio'],0)}}</span>
            <q-tooltip>
              Ptf inizio
            </q-tooltip>
          </q-item-label>

        </div>
        <div class="text-grey-8 col">

          <q-item-label>
            <!-- q-icon name="help_center" color="gray" size="20px" title="SQN"/ -->
            <strong>SQN</strong>:
            <span :style="[data.SQN<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data.SQN,3)}}</span>
            <q-tooltip>
              SQN
            </q-tooltip>
          </q-item-label>

        </div>
      </div>

      <div class="q-pa-sm row">

        <div class="text-grey-8 col">

          <q-item-label>
            <q-icon name="show_chart" color="gray" size="20px"/>
            <span :style="[data.PNL<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data.PNL,5)}}</span>
            <q-tooltip>
              PNL
            </q-tooltip>
          </q-item-label>

        </div>
        <div class="text-grey-8 col">

          <q-item-label>
            <!-- q-icon name="show_chart" color="gray" size="20px" title="Sharpe ratio"/ -->
            <strong>Sharpe</strong>:
            <span :style="[data.Sharpe<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data.Sharpe,3)}}</span>
            <q-tooltip>
              Sharpe ratio
            </q-tooltip>
          </q-item-label>

        </div>

      </div>
      <div class="q-pa-sm row">

        <div class="text-grey-8 col">

          <q-item-label>
            <q-icon name="candlestick_chart" color="gray" size="20px"/>
            <span :style="[data.trades<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data.trades,0)}}</span>
            <q-tooltip>
              Trades
            </q-tooltip>
          </q-item-label>

         </div>

         <div class="text-grey-8 col">

          <q-item-label>
            <!-- q-icon name="help" color="gray" size="20px" title="VWR"/ -->
            <strong>VWR</strong>:
            <span :style="[data.VWR<0 ? {'color': 'red'}:'']">{{$filters.floatFormat(data.VWR,3)}}</span>
            <q-tooltip>
              VWR
            </q-tooltip>
          </q-item-label>

         </div>

      </div>

      <q-expansion-item expand-separator dense dense-toggle :header-style="{ paddingTop: '0px', paddingBottom: '0px' }">
        <q-tooltip>
            Dati
          </q-tooltip>
        <q-card>
          <q-card-section>
            <pre class="text-grey-8">{{data}}</pre>
          </q-card-section>
        </q-card>
      </q-expansion-item>



    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, ref, onMounted, onUpdated } from 'vue'
import { api } from 'boot/axios'
import { constants } from 'boot/constants'

export default defineComponent({
  name: "TickerCard",
  props: {
    error: {
      type: Boolean,
      default: false
    },
    name: String,
    index: Number,
    folder: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const link = ref(null)
    const data = ref([])
    const baseURL = ref(constants.API_BASE_FOLDER)

    function getTickerData () {
      if(!props.error) {
        if(props.folder!='') {
          baseURL.value = constants.API_BACKUP_FOLDER + '/' + props.folder + constants.API_BACKUP_BASE_FOLDER
          loadData()
        } else {
          baseURL.value = constants.API_BASE_FOLDER
          loadData()
        }
      }
    }

    function resetData () {
      data.value = []
    }

    function handleUnexpectedError(e) {
      link.value.setAttribute('href','#')
    }

    function loadData() {
      api.get(baseURL.value+'/'+props.name+constants.API_TICKER_DATA_FILE).then( (response) => {
        //https://stackoverflow.com/questions/63559228/how-to-access-an-object-without-knowing-its-name
        data.value = response.data[Object.keys(response.data)[0]]
      }).catch( (e) => {
        console.log(e)
        handleUnexpectedError(e)
      })
    }

    onMounted(() => {
      console.log('TickerCard mounted', props)
      getTickerData()
    })

    onUpdated(() => {
      console.log('TickerCard updated', props)
      resetData()
      getTickerData()
    })

    return {
      link,
      data,
      baseURL,
      constants
    }
  },

})
</script>

<style scoped>

</style>
