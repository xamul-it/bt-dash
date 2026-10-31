<template>
  <div class="balance-persistence" :data-kind="kind">
    <HistoricalCoherence :value="rankValue" :comparison-kind="kind" />
    <template v-if="available">
      <template v-if="kind === 'balance'">
        <div class="text-caption q-mt-xs">
          <span class="text-negative">Negative {{ value.recent.negative_days }}</span> ·
          <span class="text-grey-7">zero {{ value.recent.zero_days }}</span> ·
          <span class="text-positive">positive {{ value.recent.positive_days }}</span>
        </div>
        <div class="text-caption text-grey-7">Sotto media {{ value.recent.below_mean_days }} / {{ value.window_days }}</div>
        <div class="text-caption text-grey-7">Media storica {{ meanLabel }}%</div>
      </template>
      <template v-else>
        <div class="text-caption q-mt-xs">Massimo di perdite consecutive: {{ value.recent.longest_negative_run }}</div>
        <div class="text-caption">Massimo di giorni consecutivi sotto media: {{ value.recent.longest_below_mean_run }}</div>
      </template>
    </template>
  </div>
</template>
<script>
import HistoricalCoherence from './HistoricalCoherence.vue'
export default {
  name: 'BalancePersistence',
  components: { HistoricalCoherence },
  props: {
    value: { type: Object, default: null },
    kind: { type: String, default: 'balance' },
  },
  computed: {
    available() {
      const value = this.value
      const counts = value?.recent
      if (value?.status !== 'available' || !Number.isFinite(value.threshold_mean) || !counts) return false
      const fields = ['negative_days', 'zero_days', 'positive_days', 'below_mean_days', 'longest_negative_run', 'longest_below_mean_run']
      return Number.isInteger(value.window_days) && value.window_days > 0 &&
        fields.every(key => Number.isInteger(counts[key]) && counts[key] >= 0 && counts[key] <= value.window_days) &&
        counts.negative_days + counts.zero_days + counts.positive_days === value.window_days
    },
    rankValue() {
      if (!this.available) return { status: 'unavailable', reason: this.value?.reason }
      return { ...this.value, ...this.value[this.kind] }
    },
    meanLabel() {
      if (!this.available) return '—'
      const mean = this.value.threshold_mean * 100
      return `${mean >= 0 ? '+' : ''}${mean.toLocaleString('it-IT', { maximumFractionDigits: 4 })}`
    },
  },
}
</script>
<style scoped>
.balance-persistence[data-kind="persistence"] {
  min-width: 190px;
  max-width: 240px;
  white-space: normal;
  margin-left: auto;
}
</style>
