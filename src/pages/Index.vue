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
    <div class="row q-col-gutter-lg">

      <div class="col-lg-2 col-md-2 col-xs-6 col-sm-6" v-for="(folder,index) in folders">
        <ticker-card class="col-lg-4 fit col-md-4 col-sm-12 col-xs-12" :name="folder.name" :index="index" :folder="backupPath"/>
      </div>

    </div>

    <q-dialog v-model="errorDialog" persistent transition-show="scale" transition-hide="scale">
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
import { defineComponent, defineAsyncComponent, ref, onMounted, computed, nextTick, Vue } from 'vue'
import { api } from 'boot/axios'
import { constants } from 'boot/constants'
import { date } from 'quasar'

export default defineComponent({
  name: "Directory",
  components: {
    TickerCard: defineAsyncComponent(() => import('components/cards/TickerCard'))
  },

  setup() {
    const loading = ref(false)
    const folders = ref([])
    const backupPath = ref('')

    const dateValue = ref()

    const errorDialog = ref(false)
    const errorText = ref('')

    function setDateNow() {
      let timeStamp = Date.now()
      let formattedDate = date.formatDate(timeStamp, 'YYYY/MM/DD')
      dateValue.value = formattedDate
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
      errorText
    }
  }
})
</script>

<style scoped>

</style>
