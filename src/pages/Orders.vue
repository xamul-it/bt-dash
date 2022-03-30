<template>
  <q-page class="q-pa-sm">

    <div class="row q-col-gutter-lg q-pa-md">
      <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12" v-for="(order,key) in orders">

        <q-card>
          <q-card-section horizontal class="bg-grey-2 text-grey-8">
            <q-item class="full-width">

              <q-item-section>
                <q-item-label class="text-grey-8 text-weight-bold">{{ key }}</q-item-label>
              </q-item-section>

            </q-item>
          </q-card-section>

          <q-separator />
          <q-card-section>
            <pre>
              {{order[0]}}

              {{order[1]}}
            </pre>
          </q-card-section>
        </q-card>

      </div>
    </div>

    <error-dialog :is-error="errorDialog" :error-text="errorText"/>

  </q-page>
</template>

<script>
import { defineComponent, defineAsyncComponent, ref, onMounted, computed, watch, nextTick, Vue } from 'vue'
import { api } from 'boot/axios'
import { constants } from 'boot/constants'
import { date, Platform } from 'quasar'

export default defineComponent({
  name: "Orders",
  components: {
    ErrorDialog: defineAsyncComponent(() => import('components/dialogs/ErrorDialog'))
  },

  setup() {
    const orders = ref([])

    const loading = ref(false)

    const errorDialog = ref(false)
    const errorText = ref('')

    function getLatestData (path = constants.API_BASE_FOLDER) {
      console.log(path)
      loading.value = true
      api.get(path+constants.API_ORDERS_FILE).then( (response) => {
        orders.value = response.data
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
      errorText.value = e.message
      errorDialog.value = true
    }

    function reset() {
      loading.value = false
      getLatestData()
    }

    onMounted(() => {
      getLatestData()
    })

    return {
      orders,
      loading,
      errorDialog,
      errorText
    }
  }
})
</script>

<style scoped>

</style>
