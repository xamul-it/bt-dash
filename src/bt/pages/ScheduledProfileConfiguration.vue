<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="text-h5">Strategie Schedulate — Configurazione</div>
        <div class="text-caption text-grey-7">
          Onboarding di un profilo schedulato via cron (timeframe daily, tipo overnight_ah).
          Checklist dei passi da fare fuori dashboard + stato live per verificarli.
        </div>
      </div>
    </div>

    <!-- Sezione 1 — Selettore profilo -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle2 text-grey-8">1 · Profilo</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col-12 col-md-5">
          <q-select
            v-model="selectedProfile"
            use-input
            fill-input
            hide-selected
            hide-dropdown-icon
            clearable
            input-debounce="0"
            new-value-mode="add-unique"
            :options="filteredOptions"
            label="Nome profilo"
            hint="Campo libero. Anche un profilo non ancora creato in DB è valido."
            outlined
            dense
            @filter="filterProfiles"
            @input-value="onInputValue"
            @update:model-value="onSelect"
            @clear="onClear"
          />
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            icon="refresh"
            :loading="loading"
            :disable="!profile"
            @click="loadStatus"
          >
            <q-tooltip>Ricarica lo stato live</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
    </q-card>

    <div v-if="!profile" class="text-grey-6 q-pa-lg text-center">
      Digita un nome di profilo per vedere la checklist e lo stato live.
    </div>

    <template v-if="profile">
      <q-banner v-if="loadError" class="bg-red-1 text-red-9 q-mb-md" rounded>
        {{ loadError }}
      </q-banner>

      <!-- Sezione 3 — Stato live -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="row items-center">
          <div class="text-subtitle2 text-grey-8 col">
            3 · Stato live — <code>{{ profile }}</code>
          </div>
          <q-spinner v-if="loading" size="sm" color="primary" />
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="ind in indicators" :key="ind.key">
            <q-item-section avatar>
              <q-icon :name="ind.icon" :color="ind.color" size="sm" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ ind.label }}</q-item-label>
              <q-item-label caption>{{ ind.detail }}</q-item-label>
            </q-item-section>
            <q-item-section side v-if="ind.optional">
              <q-badge color="grey-5" text-color="grey-9" label="opzionale" />
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Natura della discrepanza dell'ultima riconciliazione -->
        <template v-if="lastReconciliation">
          <q-separator />
          <q-card-section>
            <div class="text-body2 text-grey-8 q-mb-xs">
              Ultima riconciliazione — <b>{{ dateOnly(lastReconciliation.trading_date) }}</b> ·
              <span :class="reconciliationVerdict === 'pulito' ? 'text-positive' : 'text-negative'">
                {{ reconciliationVerdict }}
              </span>
            </div>
            <ul class="q-my-none q-pl-md">
              <li
                v-for="(line, idx) in reconciliationBreakdown"
                :key="idx"
                class="text-body2"
                :class="{
                  'text-negative': line.tone === 'negative',
                  'text-orange-9': line.tone === 'warning',
                  'text-positive': line.tone === 'positive',
                  'text-grey-8': line.tone === 'info',
                }"
              >{{ line.text }}</li>
            </ul>
            <div class="text-caption text-grey-6 q-mt-sm">
              Storico completo giorno-per-giorno nella pagina Profili Cron.
            </div>
          </q-card-section>
        </template>

        <q-card-section v-if="!overview && !loading && !loadError" class="text-grey-6">
          Nessun dato per questo profilo: è nuovo, oppure non è ancora stato eseguito nessun cron.
        </q-card-section>
      </q-card>

      <!-- Baseline / stabilità strategia (livello 1) -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="text-subtitle2 text-grey-8">Baseline / stabilità strategia</q-card-section>
        <q-separator />
        <q-card-section class="row q-col-gutter-md items-end">
          <div class="col-12 col-md-6">
            <q-select v-model="selectedBaselineId" :options="baselineOptions" label="Baseline di confronto"
                      dense outlined emit-value map-options clearable
                      @update:model-value="checkDrift" />
          </div>
          <div class="col-6 col-md-3">
            <q-input v-model.number="recentWindowDays" type="number" min="3" max="30"
                     label="Giorni recenti" dense outlined @blur="checkDrift" />
          </div>
          <div class="col-auto">
            <q-btn flat icon="refresh" label="Verifica" :loading="driftLoading"
                   :disable="!selectedBaselineId" @click="checkDrift" />
          </div>
          <div class="col-auto">
            <q-btn flat color="primary" label="Gestione baseline" icon-right="open_in_new"
                   to="/ScheduledProfiles/Baselines" />
          </div>
        </q-card-section>
        <q-banner v-if="selectedBaselineCompatibility && selectedBaselineCompatibility.status !== 'compatible'"
                  class="bg-orange-1 text-orange-10 q-mx-md q-mb-md" rounded dense>
          {{ baselineCompatibilityMessage(selectedBaselineCompatibility) }}
        </q-banner>
        <q-card-section v-else-if="selectedBaselineCompatibility" class="text-caption text-positive q-pt-none">
          Baseline allineata a codice e configurazione correnti.
        </q-card-section>
        <q-card-section v-if="overview?.latest_profile_baseline_drift_check" class="text-caption text-grey-8">
          Ultimo controllo schedulato disponibile:
          {{ dateOnly(overview.latest_profile_baseline_drift_check.checked_at) }} ·
          baseline {{ overview.latest_profile_baseline_drift_check.baseline_id != null ? '#' + overview.latest_profile_baseline_drift_check.baseline_id : 'non associata' }} ·
          <span :class="scheduledDriftStatusClass(overview.latest_profile_baseline_drift_check.status)">
            {{ overview.latest_profile_baseline_drift_check.status }}
          </span>
          ·
          <q-badge v-if="overview?.profile_baseline_drift_state?.status === 'current'"
                   color="positive" label="corrente" />
          <q-badge v-else color="grey-7" label="storico — non corrente" />
        </q-card-section>
        <q-card-section v-if="overview?.profile_baseline_drift_state?.status === 'no_compatible_baseline'"
                        class="text-caption text-orange-9">
          Non esiste una baseline allineata al BACK attuale. L’eventuale controllo mostrato sopra è conservato come storico.
        </q-card-section>
        <q-card-section v-else-if="overview?.profile_baseline_drift_state?.status === 'not_checked_current_baseline'"
                        class="text-caption text-grey-8">
          La baseline corrente non è ancora stata verificata. L’eventuale controllo mostrato sopra appartiene a una baseline precedente.
        </q-card-section>
        <q-card-section v-if="drift && !drift.error">
          <div class="text-body1" :class="driftHeadlineClass()">
            {{ driftHeadlineIt() }}
          </div>
          <div class="text-caption text-grey-7 q-mt-xs">
            confidence {{ drift.confidence != null ? (drift.confidence * 100).toFixed(0) + '%' : '—' }} ·
            z-mean {{ drift.z_mean != null ? drift.z_mean.toFixed(2) : '—' }} ·
            KS {{ drift.ks_distance != null ? drift.ks_distance.toFixed(3) : '—' }} ·
            campione recente {{ drift.recent_sample_size }} trade
            ({{ drift.recent_window_start }}→{{ drift.recent_window_end }}) vs baseline {{ drift.baseline_sample_size }}
          </div>
        </q-card-section>
        <q-card-section v-else-if="drift && drift.error" class="text-negative">{{ drift.error }}</q-card-section>
        <q-card-section v-else class="text-grey-6">
          Seleziona una baseline per verificare la coerenza del backtest recente.
        </q-card-section>
        <q-separator />
        <q-card-section class="text-subtitle2 text-grey-8">Storico controlli schedulati</q-card-section>
        <q-table :rows="driftHistory" :columns="driftHistoryColumns" row-key="id"
                 dense flat :loading="driftHistoryLoading"
                 :pagination="{ rowsPerPage: 25 }" :rows-per-page-options="[25, 50, 100, 0]"
                 no-data-label="Nessun controllo schedulato registrato">
          <template #body-cell-checked_at="props">
            <q-td :props="props">{{ dateTime(props.row.checked_at) }}</q-td>
          </template>
          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge :color="scheduledDriftStatusColor(props.row.status)" :label="props.row.status" />
            </q-td>
          </template>
          <template #body-cell-relation="props">
            <q-td :props="props">
              <q-badge :color="props.row.relation === 'current' ? 'positive' : 'grey-7'"
                       :label="driftRelationLabel(props.row.relation)" />
            </q-td>
          </template>
        </q-table>
      </q-card>

      <!-- Sezione 4 — Link successivo -->
      <q-banner
        v-if="overview && blockingDone"
        class="bg-green-1 text-green-9 q-mb-md"
        rounded
      >
        <template #avatar>
          <q-icon name="check_circle" color="positive" />
        </template>
        Tutti i passi bloccanti risultano completati.
        <template #action>
          <q-btn
            flat
            color="green-9"
            label="Vai a Profili Cron"
            icon-right="arrow_forward"
            to="/Watchtower/CronMonitoring"
          />
        </template>
      </q-banner>

      <!-- Sezione 2 — Checklist "fuori dash" -->
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">2 · Checklist fuori dashboard</div>
          <div class="text-caption text-grey-7">
            I template mostrano <code>&lt;profile&gt;</code> sostituito con
            <code>{{ profile }}</code>. Nessuna di queste azioni è eseguita dalla dashboard.
          </div>
        </q-card-section>
        <q-separator />
        <q-list separator>
          <q-item v-for="(step, idx) in checklist" :key="idx" class="q-py-md">
            <q-item-section avatar top>
              <q-avatar
                :color="step.optional ? 'grey-5' : 'primary'"
                text-color="white"
                size="28px"
              >{{ idx + 1 }}</q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-body1">
                {{ step.title }}
                <q-badge
                  v-if="step.optional"
                  color="grey-5"
                  text-color="grey-9"
                  label="opzionale"
                  class="q-ml-sm"
                />
              </q-item-label>

              <q-item-label v-if="step.path" caption class="q-mt-xs">
                Percorso:
                <code class="path-code">{{ render(step.path) }}</code>
                <q-btn
                  flat
                  dense
                  size="sm"
                  icon="content_copy"
                  @click="copy(render(step.path))"
                >
                  <q-tooltip>Copia percorso</q-tooltip>
                </q-btn>
              </q-item-label>

              <div v-if="step.body" class="template-block q-mt-sm">
                <q-btn
                  class="template-copy"
                  flat
                  dense
                  size="sm"
                  icon="content_copy"
                  label="Copia"
                  @click="copy(render(step.body))"
                />
                <pre>{{ render(step.body) }}</pre>
              </div>

              <ul v-if="step.notes && step.notes.length" class="q-mt-sm q-mb-none q-pl-md">
                <li
                  v-for="(note, nidx) in step.notes"
                  :key="nidx"
                  class="text-body2 text-grey-8"
                >{{ render(note) }}</li>
              </ul>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </template>
  </q-page>
</template>

<script>
import { api } from 'boot/axios'
import { copyToClipboard, Notify } from 'quasar'

// Checklist statica, allineata a docs/scheduled-trading-operations.md +
// estensioni Fase 1/3 di Watchtower. `<profile>` viene sostituito a runtime
// dal valore digitato in Sezione 1. Nessun nome di profilo hardcoded.
const CHECKLIST = [
  {
    title: 'Account Alpaca',
    path: '~/.config/backtrader/accounts/<profile>.env',
    body: [
      'ALPACA_API_KEY=...',
      'ALPACA_SECRET_KEY=...',
      'BROKER_API_KEY=...',
      'BROKER_SECRET_KEY=...',
    ].join('\n'),
    notes: [
      'Permessi 0600 sul file.',
      'Mai dedurre le credenziali da un file esistente di un altro profilo: vanno create ex novo.',
    ],
  },
  {
    title: 'Parametri strategia',
    path: 'config-common/scheduled/strategies/<profile>.env',
    body: [
      'STRAT=<modulo.Classe>',
      'TICKER=<file_universo.json>',
      'DATA_PROVIDER=<provider>',
      'ALPACA_FEED=<feed>',
      'FROM_DAYS=<n>',
      'MAX_EXPOSURE=<n>',
      'MARGIN_LEVERAGE=<n>',
      'ENTRY_TIF=<tif>',
      'ENTRY_HANDLER=<handler>',
      'EXIT_HANDLER=<handler>',
      'EXIT_FALLBACK_HANDLER=<handler>',
      'STRATARGS="..."',
    ].join('\n'),
  },
  {
    title: 'Config profilo schedulato',
    path: '~/.config/backtrader/scheduled/<profile>.env',
    body: [
      'ROLE=<profile>',
      'TRADING_MODE=paper|live',
      'CODE_ROOT=<path checkout>',
      'ACCOUNT_ENV=/home/htpc/.config/backtrader/accounts/<profile>.env',
      'STRATEGY_CONFIG=config-common/scheduled/strategies/<profile>.env',
      'RUN_ID=<run_id>',
    ].join('\n'),
    notes: [
      'ROLE deve coincidere col nome profilo (<profile>).',
      'TRADING_MODE ammette solo paper o live.',
      'Se TRADING_MODE=live, CODE_ROOT deve essere il checkout backtrader-prod sul branch prod.',
      'Regole validate da bt-scheduled.',
    ],
  },
  {
    title: 'Crontab',
    body: [
      '<min> <ora> * * 1-5 /home/htpc/bin/bt-scheduled <profile> entry',
      '<min> <ora> * * 1-5 /home/htpc/bin/bt-scheduled <profile> exit',
      '<min> <ora> * * 1-5 /home/htpc/bin/bt-scheduled <profile> exit-fallback',
    ].join('\n'),
    notes: [
      'Verificare prima ogni fase con: bt-scheduled --check <profile> <phase>',
      'e con --dry-run per ogni fase.',
    ],
  },
  {
    title: 'Registrazione account↔profilo (guardrail, Fase 3)',
    body: 'bt-core/.venv/bin/python bin/watchtower_register_profile_accounts.py',
  },
  {
    title: 'Poller Watchtower — nessun passo aggiuntivo',
    notes: [
      'watchtower_poll_alpaca_orders.py (cron 12:00) e watchtower_replay_reconcile.py --catch-up (cron 12:30) scoprono i profili dinamicamente dal DB.',
      'Un nuovo profilo viene raccolto automaticamente dal primo cron successivo alla registrazione.',
    ],
  },
  {
    title: 'Baseline footprint (drift dell\'edge, requisito B)',
    optional: true,
    body: 'bt-core/.venv/bin/python bin/watchtower_compute_footprint_drift.py --profile <profile>',
    notes: [
      'Calcola il profilo statistico della strategia (win rate, gain medio/trade, distribuzione PnL) su due finestre — prima e dopo la data di attivazione — a parità di STRATARGS correnti, e salva un verdetto di drift.',
      'NON è schedulato da nessun cron: va lanciato a mano (o aggiunto al crontab come job settimanale). Finché non lo si esegue, l\'indicatore "Baseline footprint" in Stato live resta grigio.',
      'Ha senso solo dopo qualche settimana di storia post-attivazione: con campione post piccolo il verdetto è a bassa confidenza. Non blocca l\'attivazione del profilo.',
    ],
  },
  {
    title: 'Backfill storico pregresso',
    optional: true,
    body: 'bt-core/.venv/bin/python bin/watchtower_backfill_profile_params.py',
    notes: [
      'Solo se il profilo ha uno storico pregresso da recuperare.',
    ],
  },
]

export default {
  name: 'ScheduledProfileConfiguration',
  data() {
    return {
      checklist: CHECKLIST,
      knownProfiles: [],
      filteredOptions: [],
      selectedProfile: null,
      profileText: '',
      overview: null,
      loading: false,
      loadError: '',
      _debounce: null,
      baselineOptions: [],
      selectedBaselineId: null,
      drift: null,
      driftLoading: false,
      recentWindowDays: 10,
      driftHistory: [],
      driftHistoryLoading: false,
      driftHistoryColumns: [
        { name: 'checked_at', label: 'Eseguito il', field: 'checked_at', align: 'left', sortable: true },
        { name: 'baseline', label: 'Baseline', field: row => row.baseline_id != null ? `${row.baseline_label || 'baseline'} (#${row.baseline_id})` : 'non associata', align: 'left' },
        { name: 'status', label: 'Esito', field: 'status', align: 'left', sortable: true },
        { name: 'score', label: 'Score', field: row => row.score == null ? '—' : Number(row.score).toFixed(3), align: 'right' },
        { name: 'relation', label: 'Riferimento', field: 'relation', align: 'left', sortable: true },
      ],
    }
  },
  computed: {
    profile() {
      return (this.profileText || '').trim()
    },
    selectedBaselineCompatibility() {
      return this.baselineOptions.find((option) => option.value === this.selectedBaselineId)?.compatibility || null
    },
    indicators() {
      const o = this.overview || {}
      const openAlerts = (o.open_guardrail_alerts || []).length
      const recCount = (o.reconciliation_results || []).length
      const lastRec = this.lastReconciliation
      return [
        {
          key: 'params',
          label: 'Parametri registrati',
          ok: o.current_version != null,
          icon: o.current_version != null ? 'check_circle' : 'cancel',
          color: o.current_version != null ? 'positive' : 'negative',
          detail: o.current_version
            ? `In vigore dal ${this.dateOnly(o.current_version.effective_from_date)}`
            : 'Nessuna versione in profile_param_versions per questo profilo.',
        },
        {
          key: 'account',
          label: 'Account collegato',
          ok: o.registry != null,
          icon: o.registry != null ? 'check_circle' : 'cancel',
          color: o.registry != null ? 'positive' : 'negative',
          detail: o.registry
            ? `${o.registry.display_name || o.registry.assigned_strategy || 'registrato'} (${o.registry.paper ? 'paper' : 'LIVE'})`
            : 'Nessuna riga nel registro account. Esegui watchtower_register_profile_accounts.py.',
        },
        {
          key: 'reconciliation',
          label: 'Prima riconciliazione avvenuta',
          ok: recCount > 0,
          icon: recCount > 0 ? 'check_circle' : 'cancel',
          color: recCount > 0 ? 'positive' : 'negative',
          detail: recCount > 0
            ? `${recCount} riconciliazione/i registrate — ultima ${this.dateOnly(lastRec?.trading_date)}: ${this.reconciliationVerdict}. Dettaglio sotto.`
            : 'Nessuna riconciliazione: attesa dopo il primo cron eseguito e settled.',
        },
        {
          key: 'footprint',
          label: 'Footprint pre/post attivazione',
          optional: true,
          ok: (o.footprints || []).length > 0,
          icon: (o.footprints || []).length > 0 ? 'check_circle' : 'radio_button_unchecked',
          color: (o.footprints || []).length > 0 ? 'positive' : 'grey-5',
          detail: (o.footprints || []).length > 0
            ? `${(o.footprints || []).length} footprint disponibili${o.latest_drift_check ? ` — verdetto drift: ${o.latest_drift_check.status || 'n/d'}` : ''}.`
            : 'Nessun footprint pre/post: lo script watchtower_compute_footprint_drift.py non è schedulato, va lanciato a mano (step 7). Diverso dalla baseline gestita qui sotto. Non blocca l\'attivazione.',
        },
        {
          key: 'guardrail',
          label: 'Alert guardrail aperti',
          ok: openAlerts === 0,
          icon: openAlerts === 0 ? 'check_circle' : 'warning',
          color: openAlerts === 0 ? 'positive' : 'negative',
          detail: openAlerts === 0
            ? 'Nessun alert guardrail aperto.'
            : `${openAlerts} alert aperti — possibile contaminazione tra strategie sullo stesso account.`,
        },
      ]
    },
    blockingDone() {
      // Bloccanti: parametri, account, prima riconciliazione + nessun alert guardrail aperto.
      return this.indicators
        .filter((i) => !i.optional)
        .every((i) => i.ok)
    },
    lastReconciliation() {
      const rows = this.overview?.reconciliation_results || []
      return rows.length ? rows[0] : null
    },
    reconciliationVerdict() {
      const r = this.lastReconciliation
      if (!r) return '—'
      if (r.status === 'error') return 'replay fallito'
      const counts = r.summary?.counts || {}
      const hard = Object.keys(counts).filter((k) => k !== 'matched' && k !== 'sizing_divergence')
      if (!hard.length) return 'pulito'
      const n = hard.reduce((a, k) => a + counts[k], 0)
      return `${n} divergenza/e`
    },
    // Traduce l'ultima riconciliazione in righe leggibili: natura della
    // discrepanza per categoria + simboli, slippage prezzo, scarto volumi.
    reconciliationBreakdown() {
      const r = this.lastReconciliation
      if (!r) return []
      if (r.status === 'error') {
        return [{ tone: 'negative', text: `Replay del backtest fallito per il ${this.dateOnly(r.trading_date)}: ${r.error || 'errore sconosciuto'}.` }]
      }
      const diffs = r.diffs || []
      const lines = []

      // 1) Divergenze "hard" raggruppate per categoria.
      const groups = {}
      for (const d of diffs) {
        if (!d.category || d.category === 'matched') continue
        ;(groups[d.category] = groups[d.category] || []).push(d.symbol)
      }
      for (const [cat, syms] of Object.entries(groups)) {
        lines.push({
          tone: 'negative',
          text: `${syms.length} · ${this.diffCategoryLabel(cat)} — ${syms.filter(Boolean).join(', ') || 'simbolo n/d'}`,
        })
      }

      // 2) Slippage prezzo di ingresso (sui matched).
      const edges = diffs
        .filter((d) => d.category === 'matched' && d.entry_edge_bps != null)
        .map((d) => Number(d.entry_edge_bps))
      if (edges.length) {
        const avg = edges.reduce((a, b) => a + b, 0) / edges.length
        const worst = edges.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
        lines.push({
          tone: Math.abs(avg) >= 15 ? 'warning' : 'info',
          text: `Slippage ingresso reale vs backtest: media ${this.bps(avg)}, max ${this.bps(worst)} su ${edges.length} ordini combacianti.`,
        })
      }

      // 3) Scarto volumi (sizing_divergence) — flag soft.
      const sized = diffs.filter((d) => d.sizing_ratio_live_over_bt != null)
      const diverging = sized.filter((d) => d.sizing_divergence)
      if (diverging.length) {
        const ratios = sized.map((d) => Number(d.sizing_ratio_live_over_bt))
        lines.push({
          tone: 'info',
          text: `Volumi: ${diverging.length} titoli con qty reale/backtest fuori banda 0.85–1.15 (ratio osservati ${Math.min(...ratios)}–${Math.max(...ratios)}). Artefatto noto dell'equity compounding nel replay, non un errore di esecuzione.`,
        })
      }

      if (!lines.length) {
        lines.push({ tone: 'positive', text: 'Nessuna divergenza: tutti gli ordini reali combaciano con il backtest.' })
      }
      return lines
    },
  },
  async mounted() {
    await this.loadProfiles()
  },
  beforeUnmount() {
    if (this._debounce) clearTimeout(this._debounce)
  },
  methods: {
    async loadProfiles() {
      try {
        const { data } = await api.get('/dyn/obs/watchtower/cron/profiles')
        this.knownProfiles = (data || []).map((p) => p.profile).filter(Boolean)
      } catch (err) {
        // L'autocomplete è un aiuto, non un requisito: un fallimento qui non blocca la pagina.
        this.knownProfiles = []
      }
    },
    filterProfiles(val, update) {
      update(() => {
        const needle = (val || '').toLowerCase()
        this.filteredOptions = needle
          ? this.knownProfiles.filter((p) => p.toLowerCase().includes(needle))
          : this.knownProfiles.slice()
      })
    },
    onInputValue(val) {
      this.profileText = val || ''
      this.scheduleLoad()
    },
    onSelect(val) {
      this.profileText = val || ''
      this.loadStatus()
    },
    onClear() {
      this.profileText = ''
      this.overview = null
      this.loadError = ''
      this.driftHistory = []
    },
    scheduleLoad() {
      if (this._debounce) clearTimeout(this._debounce)
      this._debounce = setTimeout(() => this.loadStatus(), 500)
    },
    async loadStatus() {
      const p = this.profile
      if (!p) {
        this.overview = null
        return
      }
      this.loading = true
      this.loadError = ''
      try {
        const { data } = await api.get(`/dyn/obs/watchtower/cron/${encodeURIComponent(p)}/overview`)
        // Guardia: se nel frattempo l'utente ha continuato a digitare, ignora la risposta stale.
        if (p === this.profile) this.overview = data
      } catch (err) {
        if (p === this.profile) {
          this.loadError = `Impossibile leggere lo stato per "${p}": ${err?.message || err}`
          this.overview = null
        }
      } finally {
        if (p === this.profile) this.loading = false
      }
      this.selectedBaselineId = null
      this.drift = null
      this.loadBaselineOptions()
      this.loadDriftHistory()
    },
    async loadDriftHistory() {
      const p = this.profile
      if (!p) { this.driftHistory = []; return }
      this.driftHistoryLoading = true
      try {
        const { data } = await api.get(
          `/dyn/obs/watchtower/cron/${encodeURIComponent(p)}/baseline-drift-checks`,
          { params: { limit: 5000 } },
        )
        if (p === this.profile) this.driftHistory = data || []
      } catch (e) {
        if (p === this.profile) this.driftHistory = []
      } finally {
        if (p === this.profile) this.driftHistoryLoading = false
      }
    },
    async loadBaselineOptions() {
      const p = this.profile
      if (!p) { this.baselineOptions = []; return }
      try {
        const { data } = await api.get(`/dyn/obs/watchtower/cron/${encodeURIComponent(p)}/baselines`)
        if (p !== this.profile) return
        const rows = [...(data || [])].sort((a, b) => {
          const aRank = a.compatibility?.is_default ? 0 : (a.compatibility?.status === 'compatible' ? 1 : 2)
          const bRank = b.compatibility?.is_default ? 0 : (b.compatibility?.status === 'compatible' ? 1 : 2)
          return aRank - bRank
        })
        this.baselineOptions = rows.map((b) => {
          const status = b.compatibility?.status || 'unknown'
          const statusLabel = { compatible: 'allineata', different: 'diversa', unknown: 'legacy' }[status] || status
          return {
            label: `${b.label} · ${statusLabel} (${b.window_start}→${b.window_end}, ${b.sample_size} trade)`,
            value: b.id,
            compatibility: b.compatibility || { status: 'unknown', differences: ['provenance_missing'] },
          }
        })
        const defaultBaseline = this.baselineOptions.find((option) => option.compatibility?.is_default)
        this.selectedBaselineId = defaultBaseline?.value || null
      } catch (e) { this.baselineOptions = [] }
    },
    baselineCompatibilityMessage(compatibility) {
      const differences = compatibility?.differences || []
      if (compatibility?.status === 'unknown') {
        return 'Baseline senza provenienza completa o contesto corrente non risolvibile: confronto solo diagnostico.'
      }
      const labels = {
        strategy: 'strategia', params_hash: 'parametri', ticker: 'universo ticker', provider: 'provider',
        alpaca_feed: 'feed dati', timeframe: 'timeframe', margin_leverage: 'leva', commission: 'commissioni',
        code_commit: 'commit applicazione', core_commit: 'commit bt-core',
        code_checkout_dirty: 'checkout applicazione non pulito', core_checkout_dirty: 'checkout bt-core non pulito',
      }
      const changed = differences.map((key) => labels[key] || key).join(', ')
      return `Baseline non allineata (${changed || 'configurazione diversa'}): confronto solo diagnostico, nessuna azione automatica.`
    },
    async checkDrift() {
      if (!this.selectedBaselineId) { this.drift = null; return }
      this.driftLoading = true
      try {
        const { data } = await api.get(
          `/dyn/obs/watchtower/cron/${encodeURIComponent(this.profile)}/baselines/${this.selectedBaselineId}/drift`,
          { params: { recent_window_days: this.recentWindowDays } },
        )
        this.drift = data
      } catch (e) {
        this.drift = { error: e?.response?.data?.error || e?.message || 'errore' }
      } finally { this.driftLoading = false }
    },
    driftHeadlineIt() {
      if (!this.drift) return ''
      if (this.drift.error) return `Errore: ${this.drift.error}`
      if (this.drift.status === 'warning') return 'Possibile regime sfavorevole: il backtest recente si discosta dalla baseline.'
      if (this.drift.status === 'missing_baseline') return 'Baseline senza campione sufficiente.'
      if (this.drift.status === 'insufficient_recent_data') return this.drift.note || 'Finestra recente senza trade: confronto non calcolabile.'
      return 'Backtest recente statisticamente coerente con la baseline.'
    },
    scheduledDriftStatusClass(status) {
      if (status === 'error') return 'text-negative'
      if (status === 'warning' || status === 'no_compatible_baseline') return 'text-orange-9'
      return 'text-positive'
    },
    scheduledDriftStatusColor(status) {
      if (status === 'error') return 'negative'
      if (status === 'warning' || status === 'no_compatible_baseline') return 'orange-8'
      if (status === 'insufficient_recent_data') return 'grey-7'
      return 'positive'
    },
    driftRelationLabel(relation) {
      return { current: 'corrente', historical: 'storico', unassociated: 'non associato' }[relation] || relation
    },
    driftHeadlineClass() {
      const s = this.drift && this.drift.status
      if (s === 'warning') return 'text-orange-9'
      if (s === 'insufficient_recent_data') return 'text-grey-8'
      return 'text-positive'
    },
    render(tpl) {
      const value = this.profile || '<profile>'
      return String(tpl).split('<profile>').join(value)
    },
    async copy(text) {
      try {
        await copyToClipboard(text)
        Notify.create({ type: 'positive', message: 'Copiato negli appunti', timeout: 1200 })
      } catch (err) {
        Notify.create({ type: 'negative', message: `Copia non riuscita: ${err?.message || err}` })
      }
    },
    dateOnly(value) {
      if (!value) return '—'
      return String(value).slice(0, 10)
    },
    dateTime(value) {
      if (!value) return '—'
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('it-IT')
    },
    bps(value) {
      const v = Number(value)
      return `${v >= 0 ? '+' : ''}${v.toFixed(1)} bps`
    },
    diffCategoryLabel(category) {
      const cat = String(category || '')
      if (cat.startsWith('live_order_not_filled:')) {
        const status = cat.split(':')[1] || 'sconosciuto'
        return `ordine inviato ma non eseguito (stato Alpaca: ${status})`
      }
      const map = {
        never_submitted: 'atteso dal backtest, nessun ordine reale inviato (ingresso mancato)',
        partial_fill: 'ordine reale eseguito solo in parte (fill parziale broker-side)',
        extra_live_order: 'ordine reale su un titolo non previsto dal backtest (possibile divergenza segnale/dati)',
        matched: 'combacia con il backtest',
      }
      return map[cat] || cat
    },
  },
}
</script>

<style scoped>
.path-code,
.template-block pre {
  font-family: 'Roboto Mono', 'Courier New', monospace;
}
.path-code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  word-break: break-all;
}
.template-block {
  position: relative;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 10px 12px;
}
.template-block pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.template-copy {
  position: absolute;
  top: 4px;
  right: 4px;
}
</style>
