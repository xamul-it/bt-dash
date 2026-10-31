<template>
  <div v-if="points.length" class="equity-curve">
    <financial-chart
      mode="equity"
      :points="points"
      :comparison-points="comparisonPoints"
      :drawdown-points="drawdownPoints"
      :height="height"
      aria-label="Curva del capitale normalizzata interattiva"
    />
    <div class="text-caption text-grey-7">
      Capitale normalizzato · scala logaritmica · 1 = capitale iniziale · trascina per esplorare,
      usa la rotella per lo zoom
    </div>
  </div>
</template>
<script>
import FinancialChart from "./FinancialChart.vue";

export default {
  name: "EquityCurve",
  components: { FinancialChart },
  props: {
    points: { type: Array, default: () => [] },
    comparisonPoints: { type: Array, default: () => [] },
    drawdownPoints: { type: Array, default: () => [] },
    height: { type: Number, default: 320 },
  },
};
</script>
<style scoped>
.equity-curve {
  min-width: 0;
}
</style>
