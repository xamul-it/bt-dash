<template>
  <q-page class="q-pa-sm">
    <div class="row q-col-gutter-sm ">

      <div class="q-pa-md" style="max-width: 300px">
        <q-input filled v-model="dateValue" mask="date" :rules="['date']">
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy ref="qDateProxy" cover transition-show="scale" transition-hide="scale">
                <q-date v-model="dateValue" :options="dateFilter"
                    navigation-min-year-month="2021/12"
                    minimal
                    today-btn>
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup :label="$t('close')" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="q-pa-md" style="max-width: 300px">
        <q-btn outline color="primary" size="1.55em" @click="getBackupData()" :loading="loading">
          <q-icon left size="1.0em" name="file_download"/>
          <div>{{$t('load')}}</div>
        </q-btn>
      </div>

      <div class="q-pa-md" style="max-width: 300px">
        <q-btn outline color="secondary" size="1.55em" @click="reset()">
          <q-icon left size="1.0em" name="restart_alt"/>
          <div>{{$t('reset')}}</div>
        </q-btn>
      </div>

    </div>

    <div>
    <q-card flat bordered>

      <q-splitter v-model="splitterModel" :limits="[50, 100]" :disable="splitterDisable" class="desktop-only">
        <template v-slot:before>
          <div class="row q-col-gutter-lg q-pa-md">
            <div :class="tickerClass" v-for="(folder,index) in folders">
              <ticker-card @source-url="(url) => source = url" :name="folder.name" :index="index" :folder="backupPath"/>
            </div>
          </div>
        </template>
        <template v-slot:after>
          <div class="q-pa-md">
            <div class="container">
              <iframe class="responsive-iframe" :src="source"></iframe>
              <q-btn class="absolute-top-right" round color="secondary" icon="close" @click="source = ''" size="sm"/>
            </div>
          </div>
        </template>
      </q-splitter>


          <div class="row q-col-gutter-lg q-pa-md mobile-only">
            <div :class="tickerClass" v-for="(folder,index) in folders">
              <ticker-card @source-url="(url) => source = url" :name="folder.name" :index="index" :folder="backupPath"/>
            </div>
          </div>

          <q-dialog v-model="statsDialogEnable" persistent maximized transition-show="scale" transition-hide="scale" class="mobile-only">
            <q-card flat>

              <q-card-actions align="right" class="bg-white text-teal">
                <q-btn round icon="close" size="sm" v-close-popup />
              </q-card-actions>

              <q-card-section class="bg-white q-pt-none">
                <div class="container">
                  <iframe class="responsive-iframe" :src="source"></iframe>
                </div>
              </q-card-section>

            </q-card>

          </q-dialog>


    </q-card>

    </div>

    <q-dialog v-model="errorDialog" persistent transition-show="scale" transition-hide="scale"> <!-- @hide="" -->
      <q-card class="bg-red text-white" style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{$t('error')}}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          {{ errorText }}
        </q-card-section>

        <q-card-actions align="right" class="bg-white text-teal">
          <q-btn flat label="OK" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script>
import { defineComponent, defineAsyncComponent, ref, onMounted, computed, watch, nextTick, Vue } from 'vue'
import { api } from 'boot/axios'
import { constants } from 'boot/constants'
import { date, Platform } from 'quasar'

function setDateNowFormatted() {
  let timeStamp = Date.now()
  return date.formatDate(timeStamp, 'YYYY/MM/DD')
}

export default defineComponent({
  name: "Index",
  components: {
    TickerCard: defineAsyncComponent(() => import('components/cards/TickerCard'))
  },

  setup() {
    const tickerClass = computed(() => {
      if(Platform.is.desktop) {
        if(splitterModel.value >= 80) {
          return 'col-lg-2 col-md-3 col-sm-4 col-xs-6'
        } else if(splitterModel.value < 80 && splitterModel.value > 65) {
          return 'col-lg-3 col-md-5 col-sm-9 col-xs-12'
        } else {
          return 'col-lg-4 col-md-6 col-sm-12 col-xs-12'
        }
      } else if(Platform.is.mobile) {
        return 'col-lg-4 col-md-4 col-sm-6 col-xs-12'
      }

    })
    const splitterDisable = computed(() => {
      if(!source.value || source.value == '' || source == '#')
        return true
      else
        return true //false
    })
    const statsDialogEnable = ref(false)
    const splitterModel = computed(() => {
      if(!source.value || source.value == '' || source == '#')
        return 100
      else
        return 50
    }) //Read only???!!!
    const source = ref('')
    const loading = ref(false)
    const folders = ref([])
    const backupPath = ref('')

    const dateValue = ref()

    const errorDialog = ref(false)
    const errorText = ref('')

    watch(source, async (newSource, oldSource) => {
      if(!newSource || newSource != '' || newSource != '#') {
        statsDialogEnable.value = true
      } else {
        statsDialogEnable.value = false
      }
    })

    function setDateNow() {
      dateValue.value = setDateNowFormatted()
    }

    function getLatestData (path = constants.API_BASE_FOLDER) {
      console.log(path)
      loading.value = true
      api.get(path+constants.API_INDEX_FILE).then( (response) => {
        folders.value = response.data.children
      })
      .catch( (e) => {
        console.log('getLatestData', e)
        handleUnexpectedError(e)
      })
      .finally(()=> {
        loading.value = false
      })
    }

    function handleUnexpectedError(e) {
      errorText.value = e
      errorDialog.value = true
    }

    function dateFilter (dt) {
      return dt > '2021/12/31' && (date.getDayOfWeek(dt) != 6 && date.getDayOfWeek(dt) != 7) && dt < date.formatDate(Date.now(), 'YYYY/MM/DD')
    }

    function getBackupData() {
      let backupDatePath = date.formatDate(dateValue.value, 'YYYYMMDD')
      getLatestData(constants.API_BACKUP_FOLDER+'/' + backupDatePath + constants.API_BACKUP_BASE_FOLDER)
      backupPath.value = backupDatePath
      //this.$forceUpdate()
    }

    function reset() {
      backupPath.value = ''
      loading.value = false
      setDateNow()
      getLatestData()
    }

    onMounted(() => {
      getLatestData()
      setDateNow()
    })

    return {
      loading,
      backupPath,
      folders,
      dateValue,
      dateFilter,
      getBackupData,
      reset,
      errorDialog,
      errorText,
      splitterModel,
      splitterDisable,
      source,
      tickerClass,
      statsDialogEnable
    }
  }
})
</script>

<style scoped>
.container {
  position: relative;
  overflow: hidden;
  width: 100%;
  /*padding-top: 56.25%; /* 16:9 Aspect Ratio (divide 9 by 16 = 0.5625) */
  padding-top: 200%;
}

/* Then style the iframe to fit in the container div with full height and width */
.responsive-iframe {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
