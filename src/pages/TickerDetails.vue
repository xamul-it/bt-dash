<template>
  <div class="q-pa-sm">

    <div class="row q-col-gutter-md">

      <table-data-api tableTitle="Today" :apiURL="tickerPath+constants.API_TODAY_FILE" :jsonDataPath="['data','today']"></table-data-api>

      <table-data-api tableTitle="Orders" :apiURL="tickerPath+constants.API_ORDERS_FILE" :jsonDataPath="['data']"></table-data-api>

      <table-data-api tableTitle="Positions" :apiURL="tickerPath+constants.API_POSITIONS_FILE" :jsonDataPath="['data']"></table-data-api>

    </div>

  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, onMounted, ref } from 'vue'
import { constants } from 'boot/constants'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: "Orders",
  components: {
    TableDataApi: defineAsyncComponent(() => import('components/tables/TableDataApi')),
  },

  setup() {
    const route = useRoute()

    const tickerPath = ref('')
    onMounted(() => {
      console.log('route', route.params)
      if(route.params.date) {
        tickerPath.value = constants.API_BACKUP_FOLDER+'/'+route.params.date+constants.API_BACKUP_BASE_FOLDER+'/'+route.params.ticker
      } else {
        tickerPath.value = constants.API_BASE_FOLDER+'/'+route.params.ticker
      }
    })
    return {
      constants,
      tickerPath
    }
  }
})
</script>

<style scoped>

</style>
