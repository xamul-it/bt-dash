<template>
  <q-page class="q-pa-sm">

    <table-tickers class="q-mt-lg"></table-tickers>
    <table-ticker class="q-mt-lg" :dataUrl="'/dyn/tk/list'"></table-ticker>


  </q-page>
</template>

<script>
import {defineComponent, defineAsyncComponent} from 'vue';

export default defineComponent({
  name: "Tables",
  components: {
    TableTickers: defineAsyncComponent(() => import('src/bt/components/TableTickerList')),
    TableTicker: defineAsyncComponent(() => import('src/bt/components/TableTicker')),
  },
})
</script>

<style>

</style>
