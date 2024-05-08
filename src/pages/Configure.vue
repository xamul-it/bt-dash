<template>
  <q-page class="q-pa-sm">

    <table-tickers class="q-mt-lg"></table-tickers>
    <table-ticker class="q-mt-lg"></table-ticker>

  </q-page>
</template>

<script>
import {defineComponent, defineAsyncComponent} from 'vue';

export default defineComponent({
  name: "Tables",
  components: {
    TableTickers: defineAsyncComponent(() => import('components/tables/TableTickerList')),
    TableTicker: defineAsyncComponent(() => import('components/tables/TableTicker')),
  },
})
</script>

<style>

</style>
