<template>
  <div class="q-mt-lg">
    <q-banner v-if="!run.done" class="bg-grey-2">La diagnostica sarà disponibile al termine del run.</q-banner>
    <template v-else>
      <div v-if="loading" class="q-my-md"><q-spinner size="20px" /> Caricamento diagnostica del run…</div>
      <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">
        {{ error }}
        <template #action><q-btn flat label="Riprova" @click="load" /></template>
      </q-banner>
      <template v-if="data">
        <q-banner v-for="warning in data.warnings" :key="warning" class="bg-orange-1 q-mb-sm">{{ warning }}</q-banner>
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2">Il periodo finale è compatibile con la storia del run?</div>
            <div class="text-caption text-grey-7 q-mt-xs">
              Baseline: tutti i trade chiusi del run selezionato, comprese le finestre finali.
              Le finestre terminano alla fine del run e contano le date osservate, inclusi i giorni senza trade.
              Non è una validazione fuori campione.
              L’indicatore esplorativo della serie usa invece i rendimenti del portafoglio e un riferimento precedente alle ultime 25 sedute, escludendo le finestre recenti.
            </div>
            <BaselineComparison :selected-baseline="data.baseline" :windows="data.windows"
              calendar-note="Le finestre usano le date presenti negli artefatti del run, non la data odierna. Una finestra incompleta mostra —. Gain medio/giorno: PnL dei trade chiusi sul capitale di ingresso, attribuito alla sessione di ingresso." />
          </q-card-section>
        </q-card>
        <q-card flat bordered>
          <q-card-section class="row items-center q-col-gutter-sm">
            <div class="col text-subtitle2">Riconciliazione giornaliera — Backtest</div>
            <div class="col-auto"><q-select v-model="historyDays" dense outlined :options="[25, 50, 100, 250, 1000]" label="Ultime date" style="min-width: 140px" @update:model-value="load" /></div>
            <div class="col-12 text-caption text-grey-7">
              {{ data.rows.length }} / {{ data.total_days }} date. Aperture e chiusure dei lotti presenti in trades.json, alle date effettive di esecuzione.
              Le aperture di posizioni ancora aperte a fine run non sono contenute nei trade chiusi; sono elencate nel riepilogo finale.
              Il rendimento di portafoglio viene da returns.csv; è distinto dal gain giornaliero sui trade della tabella statistica.
            </div>
          </q-card-section>
          <q-separator />
          <DailyReconciliationTable :rows="data.rows" :expanded="expanded" @toggle="toggle">
            <template #detail="{ row }">
              <div class="q-pa-sm">
                <div v-for="group in [{ key: 'opened', label: 'Aperture' }, { key: 'closed', label: 'Chiusure' }]" :key="group.key" class="q-mb-sm">
                  <b>{{ group.label }}</b>
                  <div v-if="!row[group.key].length" class="text-caption text-grey-7">Nessun movimento nei trade registrati.</div>
                  <q-list v-else dense separator>
                    <q-item v-for="trade in row[group.key]" :key="trade.key">
                      <q-item-section>
                        <q-item-label>{{ trade.asset || trade.symbol }} · {{ trade.entry_side || 'direzione n/d' }} · quantità {{ display(trade.size, 4) }} · prezzo ingresso {{ display(trade.price) }}</q-item-label>
                        <q-item-label caption>Ingresso {{ trade.open_datetime || 'n/d' }} · uscita {{ trade.close_datetime || 'n/d' }}<template v-if="group.key === 'closed'"> · PnL {{ display(trade.pnl) }} · <span :class="returnColor(trade.pnl_pct)">{{ display(trade.pnl_pct) }}%</span></template></q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
                <div class="text-subtitle2">Posizioni a fine giornata</div>
                <div v-if="row.holdings === null" class="text-caption text-grey-7">Snapshot giornaliero non disponibile.</div>
                <div v-else-if="!row.holdings.length" class="text-caption text-grey-7">Nessuna posizione.</div>
                <div v-for="position in row.holdings || []" :key="position.asset" class="text-caption">
                  {{ position.asset }} · controvalore {{ display(position.market_value) }}
                </div>
              </div>
            </template>
          </DailyReconciliationTable>
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2">Posizioni aperte a fine run</div>
            <div v-if="!data.open_positions.length" class="text-caption text-grey-7">Nessuna posizione aperta registrata; eventuali artefatti mancanti sono segnalati sopra.</div>
            <q-list v-else dense separator>
              <q-item v-for="position in data.open_positions" :key="position.asset">
                <q-item-section>{{ position.asset }} · quantità {{ display(position.size, 4) }} · prezzo medio {{ display(position.price) }} · ultimo prezzo {{ display(position.current) }}</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </template>
    </template>
  </div>
</template>
<script>
import { api } from 'boot/axios'
import { returnColor } from '../utils/returnColor'
import BaselineComparison from './BaselineComparison.vue'
import DailyReconciliationTable from './DailyReconciliationTable.vue'
export default {
  name: 'RunDiagnostics',
  components: { BaselineComparison, DailyReconciliationTable },
  props: { run: { type: Object, required: true }, endpoint: { type: String, required: true } },
  data() { return { data: null, error: '', loading: false, historyDays: 25, expanded: [], requestVersion: 0 } },
  watch: {
    'run.id': { immediate: true, handler() { this.data = null; this.expanded = []; this.historyDays = 25; this.load() } },
    'run.done'() { this.load() },
  },
  beforeUnmount() { this.requestVersion++ },
  methods: {
    returnColor,
    async load() {
      const version = ++this.requestVersion
      this.error = ''
      if (!this.run.done) { this.loading = false; return }
      this.loading = true
      try {
        const { data } = await api.get(`${this.endpoint}/jobs/${encodeURIComponent(this.run.id)}/diagnostics`, { params: { history_days: this.historyDays } })
        if (version === this.requestVersion) { this.data = data; this.expanded = [] }
      } catch (error) {
        if (version === this.requestVersion) { this.data = null; this.error = error.response?.data?.error || error.message || 'Diagnostica non disponibile' }
      } finally {
        if (version === this.requestVersion) this.loading = false
      }
    },
    toggle(key) { this.expanded = this.expanded.includes(key) ? this.expanded.filter(value => value !== key) : [...this.expanded, key] },
    display(value, decimals = 2) {
      if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
      return Number(value).toLocaleString('it-IT', {
        minimumFractionDigits: decimals === 2 ? 2 : 0,
        maximumFractionDigits: decimals,
      })
    },
  },
}
</script>
