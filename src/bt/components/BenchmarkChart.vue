<template>
  <div>
    <q-card>
      <q-card-section class="text-h6">
        Grafico {{ title }}
      </q-card-section>
      <q-card-section>
        <div ref="areachart" id="areaChart" style="height: 250px;"></div>
      </q-card-section>
      <q-resize-observer @resize="onResize"/>
    </q-card>
  </div>
</template>

<script>
import axios from 'axios'
import { constants } from 'boot/constants'

function calculateCumulativeReturns(data) {
  let cumulativeSum = 0;
  return data.map(item => {
    cumulativeSum += parseFloat(item.return);
    return { ...item, cumulativeReturn: cumulativeSum };
  });
}

export default {
  name: "AreaChart",
  data() {
    return {
      model: false,
      title: '',
      options: {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            label: {
              backgroundColor: '#6a7985'
            }
          }
        },
        legend: {
          data: ['Return','Cumulative'],
          bottom: 0,
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '10%',
          top:'5%',
          containLabel: true
        },
        xAxis: [
          {
            type: 'category',
            boundaryGap: false,
            data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          }
        ],
        yAxis: [
          {
            type: 'value'
          }
        ],
        series: [
          {
            name: 'Return',
            type: 'line',
            stack: 'Return',
            areaStyle: {},
            emphasis: {
              focus: 'series'
            },
            data: [120, 132, 101, 134, 90, 230, 210]
          },
          {
            name: 'Cumulative',
            type: 'line',
            stack: 'Cumulative',
            areaStyle: {},
            emphasis: {
              focus: 'series'
            },
            data: [120, 132, 101, 134, 90, 230, 210]
          }
        ]
      },
      area_chart: null
    }
  },
  mounted() {
    this.init();
  },
  watch: {
    '$q.dark.isActive': function () {
      this.init();
    }
  },
  methods: {
    init() {
      this.load("buyandhold")
    },
    async load(benchmark){
      const response = await axios.get(`${constants.API_BASE_URL}/dyn/bm/get/`+benchmark);
      const data = response.data;
      
      this.title = benchmark
      this.options.xAxis[0].data = data.map(item => item.index);
      this.options.series[0].data = data.map(item => parseFloat(item.return));
      this.options.legend[0] = "Return "+benchmark
      const cum = calculateCumulativeReturns(data);

      this.options.series[1].data = cum.map(item => parseFloat(item.cumulativeReturn));
      this.options.legend[1] = "Cumulative "+benchmark

      let areaChart = document.getElementById('areaChart');
      echarts.dispose(areaChart);
      let theme = this.model ? 'dark' : 'light';
      this.area_chart = echarts.init(areaChart, theme);
      this.area_chart.setOption(this.options)

    },
    onResize() {
      if (this.area_chart) {
        this.area_chart.resize();
      }
    }
  }
}
</script>

<style scoped>
</style>
