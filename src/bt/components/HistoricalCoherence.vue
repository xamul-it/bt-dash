<template>
  <div class="historical-coherence">
    <q-badge :color="state.color" :label="state.label" tabindex="0" :aria-label="description">
      <q-tooltip max-width="420px">{{ description }}</q-tooltip>
    </q-badge>
    <div v-if="available" class="text-caption text-grey-7 q-mt-xs">{{ value.tail_blocks }} / {{ value.historical_blocks }} periodi</div>
  </div>
</template>
<script>
export default {
  name: 'HistoricalCoherence',
  props: {
    value: { type: Object, default: null },
    comparisonKind: { type: String, default: 'continuous' },
    unavailableReason: { type: String, default: 'Serie giornaliera del portafoglio non disponibile per questo confronto. I gain dei trade hanno un significato diverso.' },
  },
  computed: {
    available() {
      const value = this.value
      return ['many_precedents', 'few_precedents', 'very_few_precedents'].includes(value?.status) &&
        Number.isInteger(value?.historical_blocks) && value.historical_blocks >= 20 &&
        Number.isInteger(value?.tail_blocks) && value.tail_blocks >= 0 && value.tail_blocks <= value.historical_blocks
    },
    state() {
      if (!this.available) return { label: 'Non valutabile', color: 'grey-7' }
      return {
        many_precedents: { label: 'Molti precedenti', color: 'positive' },
        few_precedents: { label: 'Pochi precedenti', color: 'orange-9' },
        very_few_precedents: { label: 'Molto pochi precedenti', color: 'negative' },
      }[this.value.status]
    },
    description() {
      if (!this.available) return this.value?.reason || this.unavailableReason
      const count = `${this.value.tail_blocks} su ${this.value.historical_blocks} periodi storici hanno un punteggio almeno altrettanto atipico.`
      const dates = ` Riferimento: ${this.value.historical_start} → ${this.value.historical_end}, precedente alla finestra recente.`
      if (this.comparisonKind === 'balance' || this.comparisonKind === 'persistence') {
        const mean = Number(this.value.threshold_mean * 100).toLocaleString('it-IT', { maximumFractionDigits: 4 })
        const threshold = ` Media aritmetica giornaliera di riferimento: ${mean}%, calcolata dal ${this.value.threshold_reference_start} al ${this.value.reference_end}, escludendo tutte le finestre recenti.`
        const meaning = this.comparisonKind === 'balance'
          ? 'Il punteggio confronta insieme i conteggi di rendimenti negativi, nulli, positivi e sotto la media storica. Gli zeri sono distinti dalle perdite e le frequenze storiche non sono assunte pari al 50%.'
          : 'Il punteggio confronta lunghezza massima e finale delle sequenze di perdite e sotto media, e coppie consecutive dello stesso tipo. Il confronto usa soltanto le N sedute della finestra.'
        const frequencies = this.value.baseline_fractions
        const percentage = value => `${(value * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
        const baseline = this.comparisonKind === 'balance' && frequencies
          ? ` Frequenze nell'intero riferimento della media: negative ${percentage(frequencies.negative)}, zero ${percentage(frequencies.zero)}, positive ${percentage(frequencies.positive)}, sotto media ${percentage(frequencies.below_mean)}.` : ''
        return `${count}${dates}${threshold} ${meaning}${baseline} Le classi sono le stesse dello storico della strategia, senza assumere giornate indipendenti. I colori riassumono la frequenza descrittiva dei punteggi: almeno 20%, 5–20%, meno del 5%. Non sono soglie validate per decidere se la legge sia cambiata. I due indicatori e le finestre non costituiscono un test congiunto con garanzia sui falsi allarmi.`
      }
      const series = this.value.unit === 'daily_entry_return'
        ? 'risultati giornalieri dei run (PnL / capitale di ingresso), con lo stesso criterio nella baseline'
        : 'rendimenti giornalieri del portafoglio'
      return `${count}${dates} Il confronto descrittivo usa ${series}, ampiezza dei movimenti, drawdown e ordine temporale. Molti precedenti: almeno il 20%; pochi: dal 5% al 20%; molto pochi: meno del 5%. Indicatore esplorativo: non misura la probabilità che il processo sia invariato e può non riconoscere cambiamenti reali. Nessuna garanzia sui controlli ripetuti.`
    },
  },
}
</script>
