<template>
  <div class="baseline-comparison">
    <div class="overflow-auto">
      <table class="footprint-table q-mt-sm">
        <thead>
          <tr>
            <th></th>
            <th>Baseline
              <q-icon v-if="referenceExcludedDays.length" name="warning" size="14px" color="warning" tabindex="0" aria-label="Giornate escluse dalla baseline">
                <q-tooltip>{{ referenceExcludedDays.length }} giornate aperte o senza trade conclusi escluse dal riferimento storico.</q-tooltip>
              </q-icon><div class="text-caption text-grey-7">{{ dateRange(selectedBaseline) }}</div></th>
            <th v-for="window in windows" :key="window.days">
              {{ window.comparison?.recent?.effective_day_count !== undefined ? `Ultime ${window.days} giornate valide` : `Ultimi ${window.days} giorni` }}
              <q-icon v-if="window.comparison?.recent?.excluded_days?.length" name="warning" size="14px" color="warning" tabindex="0" aria-label="Giornate escluse dal calcolo">
                <q-tooltip>{{ exclusionsText(window.comparison.recent) }}</q-tooltip>
              </q-icon>
              <div class="text-caption text-grey-7">{{ dateRange(window.comparison?.recent) }}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Trade</td><td>{{ selectedBaseline?.sample_size ?? '—' }}</td><td v-for="window in windows" :key="`trades-${window.days}`">{{ window.comparison?.recent?.sample_size ?? '—' }}</td></tr>
          <tr><td>Win rate</td><td>{{ pct(selectedBaseline?.metrics?.win_rate) }}</td><td v-for="window in windows" :key="`win-${window.days}`">{{ pct(window.comparison?.recent?.metrics?.win_rate) }}</td></tr>
          <tr><td>Gain medio/trade</td><td :class="returnColor(selectedBaseline?.metrics?.mean)">{{ pctSigned(selectedBaseline?.metrics?.mean) }}</td><td v-for="window in windows" :key="`trade-gain-${window.days}`" :class="returnColor(window.comparison?.recent?.metrics?.mean)">{{ pctSigned(window.comparison?.recent?.metrics?.mean) }}</td></tr>
          <tr><td>Gain medio/giorno</td><td :class="returnColor(selectedBaseline?.metrics?.average_daily_return_pct)">{{ pctSigned(selectedBaseline?.metrics?.average_daily_return_pct) }}</td><td v-for="window in windows" :key="`day-gain-${window.days}`" :class="returnColor(window.comparison?.recent?.metrics?.average_daily_return_pct)">{{ pctSigned(window.comparison?.recent?.metrics?.average_daily_return_pct) }}</td></tr>
          <tr><td>Compatibilità statistica <StatisticalHelp indicator="compatibility" /></td><td>—</td><td v-for="window in windows" :key="`compatibility-${window.days}`">
            <span :class="compatibilityColor(window.comparison)">{{ compatibilityLabel(window.comparison) }}
              <q-tooltip>{{ compatibilityDirectionText(window.comparison) }}</q-tooltip>
            </span>
          </td></tr>
          <tr>
            <td>Coerenza storica della serie <StatisticalHelp indicator="continuous" /><div class="text-caption text-grey-7">Esplorativa · {{ dailySeriesLabel }}</div></td>
            <td>—</td>
            <td v-for="window in windows" :key="`coherence-${window.days}`">
              <HistoricalCoherence :value="window.comparison?.recent?.historical_coherence" />
            </td>
          </tr>
          <tr v-for="aspect in [{ key: 'balance', label: 'Bilanciamento dei rendimenti' }, { key: 'persistence', label: 'Persistenza dei rendimenti' }]" :key="aspect.key">
            <td>{{ aspect.label }} <StatisticalHelp :indicator="aspect.key" /><div class="text-caption text-grey-7">Esplorativa · soglie zero e media storica</div></td>
            <td>—</td>
            <td v-for="window in windows" :key="`${aspect.key}-${window.days}`">
              <BalancePersistence :value="window.comparison?.recent?.balance_persistence" :kind="aspect.key" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="ongoing-sequences q-mt-md">
      <span class="text-weight-medium">Sequenze ancora aperte<template v-if="ongoingSequence"> al {{ formatDate(ongoingSequence.recent_end) }}</template></span>
      <StatisticalHelp indicator="ongoing" />
      <template v-if="ongoingSequence">
        <div>Perdite consecutive: {{ ongoingSequence.ongoing_negative_days }} sedute</div>
        <div>Giorni consecutivi sotto media: {{ ongoingSequence.ongoing_below_mean_days }} sedute</div>
        <div class="text-caption text-grey-7">Zero = nessuna sequenza aperta all’ultima seduta del run. Il conteggio può iniziare prima delle finestre mostrate.</div>
      </template>
      <div v-else class="text-caption text-grey-7">Non valutabile: serie giornaliera o riferimento storico insufficiente.</div>
    </div>
    <div class="text-caption text-grey-7 q-mt-sm">
      Compatibilità: test bilaterale del gain medio/trade della finestra rispetto a media e dispersione della baseline.
      Un valore alto indica che la media non risulta insolita sotto l’ipotesi di indipendenza dei trade.
      Gain medi: verde se positivi, rosso se negativi. Colore della compatibilità in base allo scarto dalla baseline: verde sopra +0,01 punti percentuali,
      rosso sotto −0,01, grigio nella fascia ±0,01.
      {{ calendarNote }} Il test confronta le medie e non considera l’ordine temporale dei risultati.
      Coerenza della serie: confronto esplorativo con periodi storici consecutivi, distinti dal test della media.
      I conteggi indicano quanti periodi precedenti hanno un punteggio almeno altrettanto atipico; non sono probabilità che la strategia sia invariata.
      Bilanciamento e persistenza usano le stesse serie giornaliere: gli zeri restano distinti dalle perdite, la media è fissata sullo storico precedente e i colori sono descrittivi.
    </div>
  </div>
</template>
<script>
import { returnColor } from '../utils/returnColor'
import compatibilityMethods from '../utils/baselineCompatibility'
import HistoricalCoherence from './HistoricalCoherence.vue'
import BalancePersistence from './BalancePersistence.vue'
import StatisticalHelp from './StatisticalHelp.vue'
export default {
  name: 'BaselineComparison',
  components: { HistoricalCoherence, BalancePersistence, StatisticalHelp },
  props: {
    selectedBaseline: { type: Object, default: null },
    windows: { type: Array, default: () => [] },
    dailySeriesLabel: { type: String, default: 'portafoglio giornaliero' },
    calendarNote: { type: String, default: 'Le date seguono il calendario di trading; i giorni senza evidenze restano fuori dal campione.' },
  },
  computed: {
    referenceExcludedDays() {
      return this.windows[0]?.comparison?.recent?.reference_excluded_days || []
    },
    ongoingSequence() {
      return this.windows.map(window => window.comparison?.recent?.balance_persistence).find(value =>
        value?.status === 'available' && value.recent_end && Number.isFinite(value.threshold_mean) &&
        ['ongoing_negative_days', 'ongoing_below_mean_days'].every(key => Number.isInteger(value[key]) && value[key] >= 0)
      ) || null
    },
  },
  methods: {
    ...compatibilityMethods,
    returnColor,
    exclusionsText(recent) {
      const dates = recent.excluded_days.map(day => `${day.date}: ${day.reason}`).join('; ')
      return `Giornate escluse dal calcolo: ${dates}. Le giornate escluse vengono saltate prima di formare le finestre. Disponibili ${recent.effective_day_count} giornate valide; il confronto richiede il numero indicato nella colonna.`
    },
    formatDate(value) { return value ? String(value).slice(0, 10) : '—' },
    dateRange(footprint) {
      if (!footprint) return '—'
      const range = `${this.formatDate(footprint.window_start)} → ${this.formatDate(footprint.window_end)}`
      if (Number.isFinite(Number(footprint.observed_day_count))) {
        const expected = Number(footprint.observed_day_count) + Number(footprint.missing_day_count || 0)
        return `${range} · ${footprint.observed_day_count}/${expected} replay`
      }
      return range
    },
    pct(value) {
      if (value === null || value === undefined) return '—'
      return `${(Number(value) * 100).toFixed(1)}%`
    },
    pctSigned(value) {
      if (value === null || value === undefined) return '—'
      const v = Number(value)
      return `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`
    },
  },
}
</script>
<style scoped>
table { border-collapse: collapse; width: 100%; white-space: nowrap; }
th, td { padding: 8px 12px; text-align: right; border-bottom: 1px solid #ddd; }
th:first-child, td:first-child { text-align: left; }
</style>
