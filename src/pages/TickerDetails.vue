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
import { defineComponent, defineAsyncComponent, onMounted, ref, toRefs, reactive, computed } from 'vue'
import { constants } from 'boot/constants'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: "TickerDetails",
  components: {
    TableDataApi: defineAsyncComponent(() => import('components/tables/TableDataApi')),
  },

  setup() {
    const route = useRoute()
    const routeParamsRef = toRefs(route).params

    const tickerPath = computed(() => {
        if(routeParamsRef.value.date) {
          return constants.API_BACKUP_FOLDER+'/'+routeParamsRef.value.date+constants.API_BACKUP_BASE_FOLDER+'/'+routeParamsRef.value.ticker
        } else {
          return constants.API_BASE_FOLDER+'/'+routeParamsRef.value.ticker
        }
      }
    )

    return {
      constants,
      tickerPath,
      routeParamsRef
    }
  }
})
</script>

<style scoped>

</style>
