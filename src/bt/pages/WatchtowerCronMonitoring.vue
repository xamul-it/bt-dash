<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="text-h5">Watchtower — Profili Cron</div>
        <div class="text-caption text-grey-7">
          Strategie schedulate a barra daily (overnight_ah e simili) — non coperte dal monitoraggio a feed live
        </div>
      </div>
      <div class="col-auto row q-col-gutter-sm items-center">
        <div class="col-auto">
          <q-select
            v-model="selectedProfile"
            :options="profileOptions"
            label="Profilo"
            dense
            outlined
            emit-value
            map-options
            style="min-width: 220px"
            @update:model-value="loadOverview"
          />
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            icon="refresh"
            :loading="loading"
            @click="loadOverview"
          />
        </div>
      </div>
    </div>

    <q-banner v-if="loadError" class="bg-red-1 text-red-9 q-mb-md" rounded>
      {{ loadError }}
    </q-banner>

    <div v-if="!selectedProfile && !loading" class="text-grey-6 q-pa-lg text-center">
      Nessun profilo trovato nel registro. I profili appaiono qui appena hanno almeno un dato in una delle Fasi D/A/C/B.
    </div>

    <template v-if="overview">
      <!-- Status banner: capire in 10 secondi se c'è un problema -->
      <q-banner :class="statusBannerClass" rounded class="q-mb-md text-white">
        <template #avatar>
          <q-icon :name="statusIcon" size="2rem" />
        </template>
        <div class="text-subtitle1">{{ statusHeadline }}</div>
        <div class="text-caption">{{ statusSubline }}</div>
      </q-banner>

      <div class="row q-col-gutter-md q-mb-md">
        <!-- Cosa è successo oggi / di recente -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8">Cosa è successo di recente</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div v-if="!latestResult" class="text-grey-6">
                Nessuna riconciliazione ancora eseguita per questo profilo.
              </div>
              <template v-else>
                <div class="text-body1">
                  <b>{{ formatDate(latestResult.trading_date) }}</b>
                  — {{ resultHeadline(latestResult) }}
                </div>
                <div v-if="resultDetail(latestResult)" class="text-caption text-grey-7 q-mt-xs">
                  {{ resultDetail(latestResult) }}
                </div>
                <ul v-if="humanDiffs(latestResult).length" class="q-mt-sm q-mb-none q-pl-md">
                  <li v-for="(line, idx) in humanDiffs(latestResult)" :key="idx" class="text-body2">{{ line }}</li>
                </ul>
              </template>
              <div v-if="pendingCount" class="q-mt-md">
                <q-badge color="orange" class="q-pa-xs">
                  {{ pendingCount }} giorni in coda (aperti o in attesa dei parametri)
                </q-badge>
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Performance vs storia -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8">La strategia performa come in passato?</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div v-if="!prePost.pre || !prePost.post" class="text-grey-6">
                Footprint pre/post attivazione non ancora calcolato.
              </div>
              <template v-else>
                <div class="text-body1">{{ driftHeadline }}</div>
                <table class="footprint-table q-mt-sm">
                  <thead>
                    <tr><th></th><th>Pre-attivazione</th><th>Da {{ formatDate(overview.current_version?.effective_from_date) }}</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Trade</td>
                      <td>{{ prePost.pre.sample_size }}</td>
                      <td>{{ prePost.post.sample_size }}</td>
                    </tr>
                    <tr>
                      <td>Win rate</td>
                      <td>{{ pct(prePost.pre.metrics?.win_rate) }}</td>
                      <td>{{ pct(prePost.post.metrics?.win_rate) }}</td>
                    </tr>
                    <tr>
                      <td>Gain medio/trade</td>
                      <td>{{ pctSigned(prePost.pre.metrics?.mean) }}</td>
                      <td>{{ pctSigned(prePost.post.metrics?.mean) }}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="text-caption text-grey-7 q-mt-sm">
                  Confidenza test: {{ pct(overview.latest_drift_check?.verdict?.confidence) }}
                  — campione post-attivazione ancora {{ prePost.post.sample_size < 30 ? 'piccolo, da confermare nel tempo' : 'sufficiente' }}.
                </div>
              </template>
            </q-card-section>
          </q-card>
        </div>

        <!-- Chi possiede l'account -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8">Account e proprietà</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div v-if="!overview.registry" class="text-grey-6">
                Account non registrato — nessuna assegnazione esplicita nel registro.
              </div>
              <template v-else>
                <div class="text-body1">
                  <b>{{ overview.registry.display_name }}</b>
                  <q-badge :color="overview.registry.paper ? 'blue-grey' : 'deep-orange'" class="q-ml-sm">
                    {{ overview.registry.paper ? 'paper' : 'LIVE' }}
                  </q-badge>
                </div>
                <div class="text-body2 text-grey-8 q-mt-xs">
                  Strategia assegnata: {{ overview.registry.assigned_strategy }}
                </div>
                <div v-if="!overview.open_guardrail_alerts.length" class="text-body2 text-positive q-mt-sm">
                  <q-icon name="check_circle" size="xs" /> Nessun ordine attribuibile a un'altra strategia su questo account.
                </div>
                <div v-else class="q-mt-sm">
                  <div v-for="alert in overview.open_guardrail_alerts" :key="alert.id" class="text-body2 text-negative">
                    <q-icon name="warning" size="xs" /> {{ guardrailAlertText(alert) }}
                  </div>
                </div>
              </template>
            </q-card-section>
          </q-card>
        </div>

        <!-- Parametri/commit correnti -->
        <div class="col-12 col-md-6">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8">Configurazione in vigore</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div v-if="!overview.current_version" class="text-grey-6">Nessuna versione registrata.</div>
              <template v-else>
                <div class="text-body2">
                  In vigore dal <b>{{ formatDate(overview.current_version.effective_from_date) }}</b>
                  <q-badge :color="overview.current_version.source === 'observed_run' ? 'positive' : 'grey-6'" class="q-ml-sm">
                    {{ overview.current_version.source === 'observed_run' ? 'osservato' : 'ricostruito' }}
                  </q-badge>
                </div>
                <div class="text-caption text-grey-7 q-mt-xs">
                  {{ overview.timeline.length }} versione/i note dal {{ formatDate(overview.timeline[0]?.effective_from_date) }}
                </div>
                <q-expansion-item dense label="Vedi parametri (STRATARGS)" class="q-mt-sm">
                  <pre class="stratargs-pre">{{ JSON.stringify(overview.current_version.stratargs, null, 2) }}</pre>
                </q-expansion-item>
              </template>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Storico riconciliazioni -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">Riconciliazione giornaliera — ultimi giorni</div>
        </q-card-section>
        <q-separator />
        <q-table
          :rows="reconciliationRows"
          :columns="reconciliationColumns"
          row-key="key"
          dense
          flat
          :pagination="{ rowsPerPage: 10 }"
        >
          <template #body="props">
            <q-tr
              :props="props"
              :class="{ 'cursor-pointer': !!props.row.raw }"
              @click="props.row.raw && toggleDay(props.row.key)"
            >
              <q-td auto-width>
                <q-icon
                  v-if="props.row.raw"
                  :name="expandedDays.includes(props.row.key) ? 'expand_more' : 'chevron_right'"
                />
              </q-td>
              <q-td key="trading_date" :props="props">{{ props.row.trading_date }}</q-td>
              <q-td key="status" :props="props">
                <q-badge :color="props.row.badgeColor">{{ props.row.statusLabel }}</q-badge>
              </q-td>
              <q-td key="detail" :props="props">{{ props.row.detail }}</q-td>
            </q-tr>

            <q-tr v-if="props.row.raw && expandedDays.includes(props.row.key)" :props="props" no-hover>
              <q-td colspan="100%" class="bg-grey-1">
                <div class="q-pa-sm">
                  <div class="text-caption text-grey-8 q-mb-xs">
                    Replay su commit <code>{{ (props.row.raw.core_commit || '—').slice(0, 10) }}</code>
                    <q-badge
                      v-if="props.row.raw.core_commit_resolution"
                      outline
                      :color="props.row.raw.core_commit_resolution === 'exact' ? 'positive' : 'orange'"
                      class="q-ml-xs"
                    >{{ props.row.raw.core_commit_resolution }}</q-badge>
                    <span v-if="daySummary(props.row.raw).cash_used">
                      — cash usato ${{ num(daySummary(props.row.raw).cash_used) }}</span>
                    <span v-if="daySummary(props.row.raw).bt_entry_count != null">
                      — {{ daySummary(props.row.raw).bt_entry_count }} ingressi attesi dal backtest</span>
                  </div>

                  <div v-if="commitCaveat(props.row.raw)" class="text-caption text-orange-9 q-mb-xs">
                    ⚠ {{ commitCaveat(props.row.raw) }}
                  </div>

                  <div v-if="props.row.raw.status === 'error'" class="text-negative">
                    Replay del backtest fallito: {{ props.row.raw.error || 'errore sconosciuto' }}
                  </div>

                  <template v-else>
                    <ul class="q-my-xs q-pl-md">
                      <li
                        v-for="(line, i) in dayReading(props.row.raw)"
                        :key="i"
                        class="text-body2"
                        :class="line.cls"
                      >{{ line.text }}</li>
                    </ul>

                    <div class="diff-scroll">
                      <table class="diff-table q-mt-sm">
                        <thead>
                          <tr>
                            <th>Simbolo</th>
                            <th>Backtest (qty @ prezzo)</th>
                            <th>Reale / Alpaca (qty @ prezzo)</th>
                            <th>Stato ordine</th>
                            <th>Slippage</th>
                            <th>Qty reale/BT</th>
                            <th>Natura</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="drow in diffTableRows(props.row.raw)"
                            :key="drow.symbol + ':' + drow.category"
                            :class="drow.cls"
                          >
                            <td>{{ drow.symbol }}</td>
                            <td>{{ drow.bt }}</td>
                            <td>{{ drow.live }}</td>
                            <td>{{ drow.orderStatus }}</td>
                            <td>{{ drow.edge }}</td>
                            <td>{{ drow.sizing }}</td>
                            <td>{{ drow.categoryLabel }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div class="text-caption text-grey-6 q-mt-xs">
                      "Due strategie diverse" / contaminazione account → riquadro "Account e proprietà" sopra (guardrail).
                      Divergenze sugli <i>exit</i> non sono coperte: il replay confronta solo gli ingressi.
                    </div>
                    <div v-if="props.row.raw.replay_outpath" class="text-caption text-grey-6">
                      Output replay: <code>{{ props.row.raw.replay_outpath }}</code>
                    </div>
                  </template>
                </div>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card>

      <!-- Timeline parametri completa -->
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">Cosa è cambiato nel tempo</div>
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="v in reversedTimeline" :key="v.id">
            <q-item-section>
              <q-item-label>
                {{ formatDate(v.effective_from_date) }} → {{ v.effective_to_date ? formatDate(v.effective_to_date) : 'oggi' }}
                <q-badge :color="v.source === 'observed_run' ? 'positive' : 'grey-6'" class="q-ml-sm">
                  {{ v.source === 'observed_run' ? 'osservato' : 'ricostruito' }}
                </q-badge>
              </q-item-label>
              <q-item-label caption>
                commit codice: {{ v.core_commit ? v.core_commit.slice(0, 10) : 'non registrato' }}
                — hash parametri: {{ v.params_hash.slice(0, 10) }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </template>
  </q-page>
</template>

<script>
import { api } from 'boot/axios'

const CATEGORY_LABELS = {
  never_submitted: 'atteso dal backtest ma nessun ordine reale trovato',
  live_order_not_filled: 'ordine reale inviato ma non eseguito (rifiutato / annullato / in sospeso)',
  partial_fill: 'ordine reale eseguito solo parzialmente',
  extra_live_order: 'ordine reale senza corrispondenza nel backtest (possibile divergenza di segnale/dati)',
  matched: 'combacia con il backtest',
}

export default {
  name: 'WatchtowerCronMonitoring',
  data() {
    return {
      profiles: [],
      selectedProfile: null,
      overview: null,
      loading: false,
      loadError: '',
      expandedDays: [],
    }
  },
  computed: {
    profileOptions() {
      return this.profiles.map((p) => ({
        label: `${p.profile} (${p.strategy || 'strategia sconosciuta'})`,
        value: p.profile,
      }))
    },
    latestResult() {
      const results = this.overview?.reconciliation_results || []
      return results.length ? results[0] : null
    },
    pendingCount() {
      return this.overview?.pending_queue?.length || 0
    },
    prePost() {
      const footprints = this.overview?.footprints || []
      return {
        pre: footprints.find((f) => f.period === 'pre_activation'),
        post: footprints.find((f) => f.period === 'post_activation'),
      }
    },
    driftHeadline() {
      const check = this.overview?.latest_drift_check
      if (!check) return 'Nessun confronto ancora calcolato.'
      if (check.status === 'warning') {
        return 'Possibile cambio di regime: il comportamento recente si discosta dalla storia pre-attivazione.'
      }
      return 'Nessun cambio di regime rilevato: il comportamento recente è statisticamente coerente con la storia pre-attivazione.'
    },
    reversedTimeline() {
      return [...(this.overview?.timeline || [])].reverse()
    },
    reconciliationColumns() {
      return [
        { name: 'expand', label: '', field: 'expand', align: 'left' },
        { name: 'trading_date', label: 'Giorno', field: 'trading_date', align: 'left' },
        { name: 'status', label: 'Esito', field: 'statusLabel', align: 'left' },
        { name: 'detail', label: 'Dettaglio', field: 'detail', align: 'left' },
      ]
    },
    reconciliationRows() {
      const rows = (this.overview?.reconciliation_results || []).map((r) => ({
        key: `res-${r.trading_date}`,
        trading_date: this.formatDate(r.trading_date),
        statusLabel: this.rowStatusLabel(r),
        badgeColor: this.rowBadgeColor(r),
        detail: this.resultHeadline(r),
        raw: r,
      }))
      const pendingRows = (this.overview?.pending_queue || []).slice(0, 15).map((p) => ({
        key: `pend-${p.trading_date}`,
        trading_date: this.formatDate(p.trading_date),
        statusLabel: p.status === 'blocked_missing_params' ? 'parametri sconosciuti' : 'in coda',
        badgeColor: p.status === 'blocked_missing_params' ? 'grey-7' : 'orange',
        detail: p.reason === 'open_day' ? 'giorno ancora aperto / non settled' : 'in attesa di elaborazione',
        raw: null,
      }))
      return [...pendingRows, ...rows]
    },
    statusHeadline() {
      if (!this.overview) return ''
      if ((this.overview.open_guardrail_alerts || []).length) {
        return 'Attenzione: possibile contaminazione tra strategie sullo stesso account'
      }
      const hardIssue = (this.latestResult?.summary?.counts &&
        Object.keys(this.latestResult.summary.counts).some((k) => k !== 'matched' && k !== 'sizing_divergence'))
      if (hardIssue) return 'Divergenza rilevata nell\'ultima riconciliazione'
      if (this.overview.latest_drift_check?.status === 'warning') return 'Possibile cambio di regime nella strategia'
      return 'Tutto nella norma'
    },
    statusSubline() {
      if (!this.overview) return ''
      const parts = []
      if (this.latestResult) parts.push(`Ultima riconciliazione: ${this.formatDate(this.latestResult.trading_date)}`)
      if (this.pendingCount) parts.push(`${this.pendingCount} giorni in coda`)
      return parts.join(' — ') || 'Nessun dato di riconciliazione ancora disponibile'
    },
    statusIcon() {
      const h = this.statusHeadline
      if (h.startsWith('Attenzione') || h.startsWith('Divergenza')) return 'error'
      if (h.startsWith('Possibile')) return 'warning'
      return 'check_circle'
    },
    statusBannerClass() {
      const h = this.statusHeadline
      if (h.startsWith('Attenzione') || h.startsWith('Divergenza')) return 'bg-negative'
      if (h.startsWith('Possibile')) return 'bg-warning text-dark'
      return 'bg-positive'
    },
  },
  async mounted() {
    await this.loadProfiles()
  },
  methods: {
    async loadProfiles() {
      this.loading = true
      this.loadError = ''
      try {
        const { data } = await api.get('/dyn/obs/watchtower/cron/profiles')
        this.profiles = data || []
        if (this.profiles.length && !this.selectedProfile) {
          this.selectedProfile = this.profiles[0].profile
        }
        if (this.selectedProfile) await this.loadOverview()
      } catch (err) {
        this.loadError = `Impossibile caricare i profili: ${err?.message || err}`
      } finally {
        this.loading = false
      }
    },
    async loadOverview() {
      if (!this.selectedProfile) return
      this.loading = true
      this.loadError = ''
      try {
        const { data } = await api.get(`/dyn/obs/watchtower/cron/${this.selectedProfile}/overview`)
        this.overview = data
      } catch (err) {
        this.loadError = `Impossibile caricare il profilo ${this.selectedProfile}: ${err?.message || err}`
        this.overview = null
      } finally {
        this.loading = false
      }
    },
    formatDate(value) {
      if (!value) return '—'
      return String(value).slice(0, 10)
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
    rowBadgeColor(result) {
      if (result.status === 'error') return 'grey-8'
      const counts = result.summary?.counts || {}
      const hard = Object.keys(counts).some((k) => k !== 'matched' && k !== 'sizing_divergence')
      return hard ? 'negative' : 'positive'
    },
    rowStatusLabel(result) {
      if (result.status === 'error') return 'errore replay'
      const counts = result.summary?.counts || {}
      const hard = Object.keys(counts).some((k) => k !== 'matched' && k !== 'sizing_divergence')
      return hard ? 'divergenza' : 'pulito'
    },
    resultHeadline(result) {
      if (!result) return ''
      if (result.status === 'error') return 'Il replay del backtest è fallito per questo giorno.'
      const counts = result.summary?.counts || {}
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const matched = counts.matched || 0
      const hardKeys = Object.keys(counts).filter((k) => k !== 'matched' && k !== 'sizing_divergence')
      if (!hardKeys.length) {
        return `${matched} di ${total} ordini combaciano con il backtest, nessun problema.`
      }
      return `${hardKeys.length} tipo/i di divergenza su ${total} ordini confrontati.`
    },
    resultDetail(result) {
      if (!result || result.status === 'error') return result?.error || ''
      const sizing = (result.summary?.counts || {}).sizing_divergence
      if (sizing) {
        return 'Le quantità differiscono leggermente dal backtest: atteso, l\'equity simulata nel backtest diverge da quella reale su una finestra lunga — non è un errore di esecuzione.'
      }
      return ''
    },
    humanDiffs(result) {
      if (!result || !result.diffs) return []
      const hardDiffs = result.diffs.filter((d) => d.category !== 'matched')
      return hardDiffs.slice(0, 8).map((d) => {
        const label = CATEGORY_LABELS[d.category] || CATEGORY_LABELS[(d.category || '').split(':')[0]] || d.category
        return `${d.symbol}: ${label}`
      })
    },
    guardrailAlertText(alert) {
      const map = {
        multiple_source_accounts: 'Ordini con etichette account diverse sullo stesso account reale.',
        source_account_registry_mismatch: 'L\'account reale non corrisponde al profilo registrato.',
        multiple_client_order_id_run_tags: 'Ordini di più strategie diverse rilevati sullo stesso account.',
        client_order_id_run_tag_mismatch: 'Un ordine porta l\'identificativo di un\'altra strategia.',
        unregistered_account: 'Account non ancora registrato nel sistema.',
      }
      return map[alert.alert_type] || alert.alert_type
    },

    // ----- Drill-down per-giorno della riconciliazione (punto C) -----
    toggleDay(key) {
      const i = this.expandedDays.indexOf(key)
      if (i >= 0) this.expandedDays.splice(i, 1)
      else this.expandedDays.push(key)
    },
    daySummary(result) {
      return result?.summary || {}
    },
    num(value) {
      if (value === null || value === undefined || value === '') return '—'
      return Number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 })
    },
    qty(value) {
      if (value === null || value === undefined || value === '') return '—'
      return Number(value).toLocaleString('it-IT', { maximumFractionDigits: 4 })
    },
    bps(value) {
      if (value === null || value === undefined) return '—'
      const n = Number(value)
      return `${n >= 0 ? '+' : ''}${n.toFixed(1)} bps`
    },
    diffCategoryLabel(category) {
      const cat = String(category || '')
      if (cat.startsWith('live_order_not_filled:')) {
        const st = cat.split(':')[1] || 'sconosciuto'
        const map = {
          rejected: 'rifiutato', canceled: 'annullato', cancelled: 'annullato',
          expired: 'scaduto', pending: 'in sospeso', new: 'in sospeso',
          accepted: 'in sospeso', done_for_day: 'chiuso a fine giornata',
        }
        return `ordine inviato ma non eseguito — ${map[st] || st}`
      }
      return CATEGORY_LABELS[cat] || cat
    },
    diffTableRows(result) {
      const diffs = result?.diffs || []
      const order = { never_submitted: 0, partial_fill: 1, extra_live_order: 2, matched: 4 }
      const rank = (c) => (c && c.startsWith('live_order_not_filled') ? 3 : (order[c] ?? 5))
      return [...diffs]
        .sort((a, b) => rank(a.category) - rank(b.category))
        .map((d) => {
          const cat = d.category || ''
          const bt = d.bt ? `${this.qty(d.bt.bt_qty)} @ ${this.num(d.bt.bt_entry_price)}` : '—'
          let live = '—'
          let orderStatus = '—'
          if (cat === 'matched' || cat === 'partial_fill' || cat === 'extra_live_order') {
            live = d.live ? `${this.qty(d.live.filled_qty ?? d.live.qty)} @ ${this.num(d.live.filled_avg_price)}` : '—'
            orderStatus = d.live?.status || (cat === 'partial_fill' ? 'fill parziale' : 'filled')
          } else if (cat === 'never_submitted') {
            live = 'nessun ordine'
          } else if (cat.startsWith('live_order_not_filled')) {
            const orders = Array.isArray(d.live) ? d.live : (d.live ? [d.live] : [])
            orderStatus = orders.map((o) => o.status).filter(Boolean).join(', ') || (cat.split(':')[1] || '—')
            live = 'non eseguito'
          }
          return {
            symbol: d.symbol || '—',
            bt,
            live,
            orderStatus,
            edge: d.entry_edge_bps != null ? this.bps(d.entry_edge_bps) : '—',
            sizing: d.sizing_ratio_live_over_bt != null
              ? `${d.sizing_ratio_live_over_bt}×${d.sizing_divergence ? ' ⚠' : ''}`
              : '—',
            category: cat,
            categoryLabel: this.diffCategoryLabel(cat),
            cls: cat !== 'matched' ? 'diff-hard' : (d.sizing_divergence ? 'diff-soft' : ''),
          }
        })
    },
    dayReading(result) {
      const counts = (result?.summary && result.summary.counts) || {}
      const lines = []
      const missing = counts.never_submitted || 0
      const notFilledEntries = Object.entries(counts).filter(([k]) => k.startsWith('live_order_not_filled:'))
      const notFilled = notFilledEntries.reduce((a, [, n]) => a + n, 0)
      const extra = counts.extra_live_order || 0
      const partial = counts.partial_fill || 0
      const sizing = counts.sizing_divergence || 0

      if (missing) {
        lines.push({ cls: 'text-negative', text: `${missing} ordine/i previsti dal backtest e mai inviati nel reale (ingresso mancato).` })
      }
      if (notFilled) {
        const byStatus = notFilledEntries
          .map(([k, n]) => `${n} ${this.diffCategoryLabel(k).replace('ordine inviato ma non eseguito — ', '')}`)
          .join(', ')
        lines.push({ cls: 'text-negative', text: `${notFilled} ordine/i inviati ma non eseguiti (${byStatus}).` })
      }
      if (partial) {
        lines.push({ cls: 'text-negative', text: `${partial} ordine/i eseguiti solo in parte (fill parziale broker-side).` })
      }
      if (extra) {
        lines.push({ cls: 'text-negative', text: `${extra} ordine/i reali su titoli non previsti dal backtest — selezione/segnale divergente, oppure contaminazione da un'altra strategia sullo stesso conto.` })
      }
      if (sizing) {
        lines.push({ cls: 'text-grey-8', text: `${sizing} titolo/i con quantità reale/backtest fuori banda 0.85–1.15: atteso, l'equity simulata del replay diverge da quella reale del conto — non è un errore di esecuzione.` })
      }

      const edges = (result?.diffs || [])
        .filter((d) => d.category === 'matched' && d.entry_edge_bps != null)
        .map((d) => Number(d.entry_edge_bps))
      if (edges.length) {
        const avg = edges.reduce((a, b) => a + b, 0) / edges.length
        const worst = edges.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
        lines.push({
          cls: Math.abs(avg) >= 15 ? 'text-orange-9' : 'text-grey-8',
          text: `Slippage prezzo di ingresso: media ${this.bps(avg)}, max ${this.bps(worst)} su ${edges.length} ordini combacianti.`,
        })
      }

      if (!lines.length) {
        lines.push({ cls: 'text-positive', text: 'Nessuna divergenza: tutti gli ordini reali combaciano con il backtest.' })
      }
      return lines
    },
    commitCaveat(result) {
      const res = result?.core_commit_resolution
      if (res && res !== 'exact') {
        return `Il replay non ha usato il commit esatto di quel giorno (${res}): parte delle divergenze di selezione titoli può essere artefatto del commit, non un problema reale.`
      }
      return ''
    },
  },
}
</script>

<style scoped>
.footprint-table {
  width: 100%;
  border-collapse: collapse;
}
.footprint-table th, .footprint-table td {
  text-align: right;
  padding: 2px 8px;
}
.footprint-table th:first-child, .footprint-table td:first-child {
  text-align: left;
}
.stratargs-pre {
  font-size: 0.75rem;
  max-height: 300px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.04);
  padding: 8px;
  border-radius: 4px;
}
.full-height {
  height: 100%;
}
.diff-scroll {
  overflow-x: auto;
}
.diff-table {
  border-collapse: collapse;
  font-size: 0.78rem;
  min-width: 640px;
}
.diff-table th, .diff-table td {
  padding: 3px 10px;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.diff-table th:first-child, .diff-table td:first-child,
.diff-table th:last-child, .diff-table td:last-child {
  text-align: left;
}
.diff-table tr.diff-hard td {
  background: rgba(193, 0, 21, 0.06);
}
.diff-table tr.diff-soft td {
  background: rgba(255, 145, 0, 0.06);
}
</style>
