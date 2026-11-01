<template>
  <div>
    <div class="text-caption text-grey-7 q-mb-sm">Alpaca · {{ value.account_label || 'Conto associato' }}<q-badge v-if="value.paper != null" outline class="q-ml-xs">{{ value.paper ? 'Paper' : 'Live' }}</q-badge></div>
    <q-banner v-if="value.notice" dense class="bg-orange-1 q-mb-sm">{{ value.notice }}</q-banner>
    <div class="performance-periods">
      <q-card v-for="period in value.periods || []" :key="period.key" flat bordered>
        <q-card-section>
          <div class="text-subtitle2">{{ period.label }}</div>
          <div class="text-caption text-grey-7">{{ period.start ? `Dal ${date(period.start)}` : `Modifica del ${date(period.changed_on)}` }}</div>
          <div v-if="period.notice" class="text-caption q-mt-sm">{{ period.notice }}</div>
          <div class="text-caption text-grey-7 q-mt-md">Rendimento del periodo</div>
          <div class="text-h5" :class="tone(period.total_return_pct)">{{ percent(period.total_return_pct) }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">Drawdown massimo giornaliero</div>
          <div class="text-h6 text-negative">{{ percent(period.max_drawdown_pct) }}</div>
          <div class="q-mt-sm">Cicli chiusi rilevati: <b>{{ period.trades ?? '—' }}</b></div>
          <div class="text-caption text-grey-7 q-mt-sm">Capitale iniziale / finale</div>
          <div>{{ money(period.initial_equity) }} / {{ money(period.final_equity) }}</div>
          <div class="text-caption text-grey-7 q-mt-sm">{{ period.sessions ?? 0 }} intervalli giornalieri</div>
          <div v-if="period.observed_from" class="text-caption text-grey-7">Capitale di riferimento: {{ date(period.observed_from) }}</div>
          <div class="text-caption text-grey-7">Aggiornato: {{ date(period.updated_at, true) }}</div>
          <div v-for="notice in period.notices || []" :key="notice" class="text-caption text-orange-10 q-mt-sm">{{ notice }}</div>
        </q-card-section>
      </q-card>
    </div>
    <div class="text-caption text-grey-7 q-mt-sm">{{ value.coverage_note }}</div>
    <div v-if="value.periods?.length" class="text-caption text-grey-7 q-mt-xs">
      Posizioni aperte incluse. I cicli derivano dagli eseguiti registrati. Rendimento corretto per versamenti e prelievi con flussi a fine intervallo; drawdown sulla stessa serie giornaliera. Il secondo periodo segue strategia e parametri registrati.
    </div>
  </div>
</template>
<script>
export default {
  props: { value: { type: Object, default: () => ({}) } },
  methods: {
    date(value, time = false) {
      if (!value) return '—'
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? '—' : time ? parsed.toLocaleString('it-IT') : parsed.toLocaleDateString('it-IT')
    },
    percent(value) { return value == null ? '—' : `${Number(value).toFixed(2)}%` },
    money(value) { return value == null ? '—' : Number(value).toLocaleString('it-IT', { style: 'currency', currency: 'USD' }) },
    tone(value) { return value == null ? 'text-grey-7' : value < 0 ? 'text-negative' : 'text-positive' },
  },
}
</script>
<style scoped>
.performance-periods { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
@media (max-width: 599px) { .performance-periods { grid-template-columns: 1fr; } }
</style>
