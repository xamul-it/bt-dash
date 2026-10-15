<template>
  <div v-if="points.length" class="equity-curve">
    <svg
      viewBox="0 0 900 230"
      role="img"
      aria-label="Curva del capitale normalizzata"
    >
      <line x1="45" y1="200" x2="880" y2="200" stroke="#cbd5e1" />
      <line x1="45" y1="15" x2="45" y2="200" stroke="#cbd5e1" />
      <text x="3" y="23" font-size="11" fill="#64748b">
        {{ bounds.max.toFixed(2) }}×
      </text>
      <text x="3" y="200" font-size="11" fill="#64748b">
        {{ bounds.min.toFixed(2) }}×
      </text>
      <polyline
        :points="line"
        fill="none"
        stroke="#2563eb"
        stroke-width="2.5"
      />
      <text x="45" y="222" font-size="11" fill="#64748b">
        {{ points[0].date?.slice(0, 10) }}
      </text>
      <text x="795" y="222" font-size="11" fill="#64748b">
        {{ points[points.length - 1].date?.slice(0, 10) }}
      </text>
    </svg>
    <div class="text-caption text-grey-7">
      Capitale normalizzato · 1 = capitale iniziale · curva campionata per la
      visualizzazione
    </div>
  </div>
</template>
<script>
export default {
  props: { points: { type: Array, default: () => [] } },
  computed: {
    bounds() {
      const v = this.points.map((p) => Number(p.value)).filter(Number.isFinite);
      return { min: Math.min(1, ...v), max: Math.max(1, ...v) };
    },
    line() {
      const { min, max } = this.bounds;
      return this.points
        .map(
          (p, i) =>
            `${45 + (i * 835) / Math.max(1, this.points.length - 1)},${200 - ((p.value - min) * 185) / (max - min || 1)}`,
        )
        .join(" ");
    },
  },
};
</script>
<style scoped>
.equity-curve svg {
  width: 100%;
  max-height: 320px;
}
</style>
