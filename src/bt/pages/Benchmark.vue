<template>
  <q-page class="q-pa-sm">
    <div class="row q-col-gutter-sm q-py-sm items-start" >
      <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
        <table-benchmark @row-selected="handleRowSelected"></table-benchmark>
        </div>
      <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
        <area-chart ref="areaChartComponent"></area-chart>
      </div>
    </div>
  </q-page>
</template>

<script>
import {defineComponent, defineAsyncComponent} from 'vue'

export default defineComponent({
  name: "Charts",
  components: {
    AreaChart: defineAsyncComponent(() => import('src/bt/components/BenchmarkChart')),
    TableBenchmark: defineAsyncComponent(() => import('src/bt/components/BenchmarkList')),
  },
  methods: {
    handleRowSelected(nome) {
      if (this.$refs.areaChartComponent) {
        this.$refs.areaChartComponent.load(nome);
      }
    }
  }
})




</script>

<style scoped>

</style>
