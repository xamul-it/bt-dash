<template>
  <q-page class="q-pa-md studio-page">
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col">
        <div class="text-h5">Laboratorio Backtesting</div>
        <div class="text-grey-7">
          Configura, simula e confronta. Tutte le esecuzioni utilizzano
          BackBroker su dati storici.
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          flat
          icon="refresh"
          label="Aggiorna"
          :loading="loading"
          @click="load"
        />
      </div>
    </div>
    <q-banner v-if="error" rounded class="bg-red-1 text-red-9 q-mb-md">{{
      error
    }}</q-banner>
    <q-tabs
      v-model="tab"
      align="left"
      active-color="primary"
      class="bg-white rounded-borders q-mb-md"
    >
      <q-tab name="new" label="Nuova simulazione" icon="science" />
      <q-tab name="runs" label="Risultati e archivio" icon="analytics" />
      <q-tab
        name="schedules"
        label="Simulazioni giornaliere"
        icon="event_repeat"
      />
    </q-tabs>
    <div v-if="tab === 'new'" class="row q-col-gutter-md">
      <div class="col-12 col-lg-8">
        <q-card flat bordered class="q-mb-md"
          ><q-card-section>
            <div class="text-subtitle1 q-mb-md">1 · Strategia e dati</div>
            <div class="row q-col-gutter-md">
              <q-select
                class="col-12 col-md-8"
                outlined
                dense
                label="Strategia"
                v-model="form.strategy"
                :options="strategyOptions"
                emit-value
                map-options
                use-input
                @filter="filterStrategies"
                @update:model-value="loadSchema(true)"
              />
              <q-select
                class="col-12 col-md-4"
                outlined
                dense
                label="Importa configurazione profilo"
                :options="catalog.profiles || []"
                v-model="preset"
                @update:model-value="applyPreset"
                hint="Importa una copia per il backtest"
              />
              <q-input
                class="col-12"
                dense
                outlined
                label="Nome simulazione"
                v-model="form.label"
              />
              <q-select
                class="col-12 col-md-6"
                outlined
                dense
                label="Universo ticker"
                v-model="form.ticker"
                :options="catalog.ticker_lists || []"
                emit-value
                map-options
                use-input
                fill-input
                hide-selected
                input-debounce="0"
                new-value-mode="add-unique"
                hint="Lista oppure simboli separati da virgola, es. NVDA,AVGO,MU"
              />
              <q-select
                class="col-6 col-md-3"
                outlined
                dense
                label="Provider"
                v-model="form.provider"
                :options="catalog.providers || []"
              />
              <q-select
                v-if="form.provider === 'alpaca'"
                class="col-6 col-md-3"
                outlined
                dense
                label="Feed Alpaca"
                v-model="form.alpaca_feed"
                :options="['sip', 'iex']"
              />
              <q-select
                class="col-6 col-md-3"
                outlined
                dense
                label="Timeframe"
                v-model="form.timeframe"
                :options="catalog.timeframes || []"
              />
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="number"
                label="Compressione barre"
                v-model.number="form.compression"
                min="1"
              />
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="date"
                label="Data inizio"
                stack-label
                v-model="form.fromdate"
              />
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="date"
                label="Data fine"
                stack-label
                v-model="form.todate"
              />
            </div>
            <q-expansion-item
              v-if="schema.description"
              dense
              label="Descrizione della strategia"
              class="q-mt-md"
            >
              <pre class="studio-pre">{{ schema.description }}</pre>
            </q-expansion-item>
          </q-card-section></q-card
        >
        <q-card flat bordered class="q-mb-md"
          ><q-card-section>
            <div class="row items-center q-mb-md">
              <div class="col text-subtitle1">2 · Parametri strategia</div>
              <q-chip dense color="blue-1"
                >{{ Object.keys(parameterInputs).length }} override</q-chip
              >
            </div>
            <q-input
              outlined
              dense
              v-model="parameterSearch"
              label="Cerca parametro"
              clearable
              class="q-mb-md"
              ><template #prepend><q-icon name="search" /></template
            ></q-input>
            <div v-if="schemaLoading" class="q-pa-md">
              <q-spinner /> Caricamento parametri…
            </div>
            <div class="row q-col-gutter-md" v-else>
              <div
                v-for="parameter in visibleParameters"
                :key="parameter.name"
                class="col-12 col-md-6"
              >
                <q-select
                  v-if="parameter.type === 'bool'"
                  outlined
                  dense
                  :label="parameter.name"
                  :model-value="parameterInputs[parameter.name] ?? ''"
                  emit-value
                  map-options
                  :options="[
                    {
                      label: `Default (${parameter.default ? 'sì' : 'no'})`,
                      value: '',
                    },
                    { label: 'Sì', value: 'true' },
                    { label: 'No', value: 'false' },
                  ]"
                  @update:model-value="(v) => setParameter(parameter.name, v)"
                />
                <q-input
                  v-else
                  outlined
                  dense
                  :label="parameter.name"
                  :model-value="parameterInputs[parameter.name] ?? ''"
                  @update:model-value="(v) => setParameter(parameter.name, v)"
                  :hint="`Default: ${JSON.stringify(parameter.default)} · ${parameterType(parameter.type)}`"
                  clearable
                />
              </div>
            </div>
            <q-btn
              v-if="!parameterSearch && schema.parameters?.length > 12"
              flat
              no-caps
              class="q-mt-sm"
              color="primary"
              :label="
                showAllParameters
                  ? 'Mostra meno'
                  : `Mostra tutti (${schema.parameters.length})`
              "
              @click="showAllParameters = !showAllParameters"
            />
            <q-expansion-item
              label="Parametri avanzati key=value"
              dense
              class="q-mt-md"
            >
              <q-input
                type="textarea"
                outlined
                v-model="form.stratargs"
                autogrow
                hint="Es. max_exposure=2 hedge_enabled=False · gli avanzati prevalgono sugli override"
              />
            </q-expansion-item> </q-card-section
        ></q-card>
        <q-card flat bordered
          ><q-card-section>
            <div class="text-subtitle1 q-mb-md">
              3 · Capitale ed esecuzione BackBroker
            </div>
            <div class="row q-col-gutter-md">
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="number"
                label="Capitale iniziale"
                v-model.number="form.cash"
                min="1"
              />
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="number"
                label="Importo per operazione"
                v-model.number="form.amount"
                min="1"
              />
              <q-input
                class="col-6 col-md-3"
                outlined
                dense
                type="number"
                label="Leva massima broker"
                v-model.number="form.broker.margin_leverage"
                min="1"
                max="20"
                hint="Il sizing dipende dalla strategia"
              />
              <q-select
                class="col-6 col-md-3"
                outlined
                dense
                label="Commissioni"
                v-model="form.commission"
                :options="catalog.commissions || []"
              />
              <q-input
                class="col-6 col-md-4"
                outlined
                dense
                type="number"
                label="Interesse margin annuo (frazione)"
                v-model.number="form.broker.margin_rate"
                hint="0.10 = 10% · vuoto = non applicato"
                clearable
              />
              <q-input
                class="col-6 col-md-4"
                outlined
                dense
                type="number"
                label="Maintenance margin (frazione)"
                v-model.number="form.broker.maintenance_margin"
                min="0.01"
                max="1"
                step="0.01"
              />
              <q-input
                class="col-6 col-md-4"
                outlined
                dense
                type="number"
                label="Slippage (frazione)"
                v-model.number="form.broker.slippage"
                min="0"
                max="0.5"
                step="0.0001"
                hint="0.001 = 0.1%"
              />
              <q-select
                class="col-12"
                outlined
                dense
                label="Benchmark (vuoto = Buy&Hold degli stessi ticker)"
                hint="Automatico: stesso provider/feed e periodo, equiponderato, senza leva né ribilanciamento."
                clearable
                v-model="form.benchmark"
                :options="benchmarkOptions"
                emit-value
                map-options
              />
            </div>
            <q-expansion-item
              label="Opzioni esecuzione avanzate"
              dense
              class="q-mt-md"
            >
              <div class="row">
                <q-toggle
                  v-for="setting in brokerFlags"
                  :key="setting.key"
                  class="col-12 col-md-6"
                  v-model="form.broker[setting.key]"
                  :label="setting.label"
                />
              </div>
              <div class="text-caption text-grey-7">
                Cheat-on-close/open modifica il momento simulato di esecuzione.
                La strategia deve essere coerente con questa scelta.
              </div>
            </q-expansion-item>
          </q-card-section></q-card
        >
      </div>
      <div class="col-12 col-lg-4">
        <q-card flat bordered class="studio-summary"
          ><q-card-section>
            <div class="text-subtitle1">Prima dell’avvio</div>
            <div class="text-body2 q-my-md">
              Il run viene salvato con configurazione e log. Puoi chiudere la
              pagina e ritrovarlo nell’archivio.
            </div>
            <q-btn
              class="full-width q-mb-sm"
              outline
              color="primary"
              icon="fact_check"
              label="Verifica configurazione e dati"
              :loading="validating"
              :disable="schemaLoading"
              @click="validate"
            />
            <q-banner v-if="validation" class="bg-blue-1 q-my-sm" rounded>
              {{ validation.coverage.filter((r) => r.available).length }}/{{
                validation.coverage.length
              }}
              ticker con storico locale.
              <div
                v-if="validation.coverage.some((r) => !r.available)"
                class="text-orange-10"
              >
                Alcuni ticker non hanno dati: controlla la pagina Dati ticker.
              </div>
            </q-banner>
            <q-btn
              class="full-width"
              color="primary"
              icon="play_arrow"
              label="Avvia simulazione"
              :loading="submitting"
              :disable="!form.strategy || schemaLoading"
              @click="submit"
            />
            <q-separator class="q-my-md" />
            <q-btn
              flat
              no-caps
              color="primary"
              label="Apri dati ticker"
              to="/Configure"
              icon="candlestick_chart"
            />
            <q-btn
              flat
              no-caps
              color="primary"
              label="Archivio benchmark"
              to="/Benchmark"
              icon="library_books"
            /> </q-card-section
        ></q-card>
      </div>
    </div>
    <template v-if="tab === 'runs'">
      <div class="row q-col-gutter-md q-mb-md">
        <div
          v-for="card in archiveCards"
          :key="card.label"
          class="col-6 col-md-3"
        >
          <q-card flat bordered
            ><q-card-section
              ><div class="text-caption text-grey-7">{{ card.label }}</div>
              <div class="text-h5">{{ card.value }}</div></q-card-section
            ></q-card
          >
        </div>
      </div>
      <div class="row items-center q-col-gutter-md q-mb-md">
        <q-input
          class="col"
          outlined
          dense
          v-model="search"
          label="Cerca nome, strategia o stato"
          ><template #prepend><q-icon name="search" /></template></q-input
        ><q-toggle v-model="pinnedOnly" label="Solo preferiti" /><q-toggle
          v-model="showHidden"
          label="Mostra nascosti"
        />
      </div>
      <q-table
        flat
        bordered
        :rows="filteredRuns"
        :columns="runColumns"
        row-key="id"
        :pagination="{ rowsPerPage: 25 }"
        :loading="loading"
        no-data-label="Nessuna simulazione. Crea il primo run dalla scheda Nuova simulazione."
      >
        <template #body-cell-label="p"
          ><q-td :props="p"
            ><div>{{ runLabel(p.row) }}</div>
            <div class="text-caption text-grey-7">
              {{
                p.row.request_snapshot?.configuration?.strategy ||
                "Aggiornamento dati"
              }}
              · {{ p.row.request_snapshot?.configuration?.provider }}
            </div></q-td
          ></template
        >
        <template #body-cell-status="p"
          ><q-td :props="p"
            ><q-badge :color="statusColor(p.row.status)">{{
              statusLabel(p.row.status)
            }}</q-badge>
            <div
              v-if="p.row.error"
              class="text-caption text-negative studio-error"
            >
              {{ p.row.error }}
            </div></q-td
          ></template
        >
        <template #body-cell-actions="p"
          ><q-td :props="p"
            ><q-btn
              flat
              dense
              no-caps
              label="Apri"
              icon="visibility"
              @click="openRun(p.row)" /><q-btn
              flat
              dense
              round
              icon="content_copy"
              @click="cloneRun(p.row)"
              ><q-tooltip>Duplica configurazione</q-tooltip></q-btn
            ><q-btn
              v-if="p.row.done"
              flat
              dense
              round
              :icon="p.row.archive?.pinned ? 'star' : 'star_border'"
              @click="
                archiveRun(p.row, { pinned: !p.row.archive?.pinned })
              " /></q-td
        ></template>
      </q-table>
    </template>
    <template v-if="tab === 'schedules'">
      <q-banner class="bg-blue-1 q-mb-md" rounded
        >Simulazioni giornaliere su storico locale, fuso Europe/Rome.
        L’intervallo scorre mantenendo la durata della configurazione. Per dati
        nuovi, aggiorna lo storico separatamente.</q-banner
      >
      <q-card flat bordered class="q-mb-md"
        ><q-card-section class="row q-col-gutter-md items-center">
          <div class="col-12">
            Pianifica la configurazione della scheda Nuova simulazione
          </div>
          <q-input
            class="col"
            outlined
            dense
            v-model="scheduleLabel"
            label="Nome pianificazione"
          />
          <q-input
            class="col-auto"
            outlined
            dense
            type="time"
            v-model="scheduleTime"
            label="Ora Europe/Rome"
          />
          <q-btn
            class="col-auto"
            color="primary"
            label="Crea pianificazione"
            @click="createSchedule"
            :loading="submitting"
          /> </q-card-section
      ></q-card>
      <q-list bordered separator class="bg-white"
        ><q-item v-for="s in schedules" :key="s.id"
          ><q-item-section
            ><q-item-label>{{ s.label }}</q-item-label
            ><q-item-label caption
              >{{ String(s.hour).padStart(2, "0") }}:{{
                String(s.minute).padStart(2, "0")
              }}
              · {{ s.configuration.strategy }} · {{ s.rolling_days }} giorni di
              calendario</q-item-label
            ><q-item-label v-if="s.last_error" class="text-negative">{{
              s.last_error
            }}</q-item-label
            ><q-item-label v-if="s.last_job_id" caption
              >Ultimo run: {{ s.last_job_id }}</q-item-label
            ></q-item-section
          ><q-item-section side
            ><q-toggle
              :model-value="s.enabled"
              @update:model-value="(v) => toggleSchedule(s, v)"
              label="Attiva" /></q-item-section></q-item
      ></q-list>
    </template>
    <q-dialog v-model="detailOpen" maximized
      ><q-card v-if="selectedRun">
        <q-bar
          ><div>{{ runLabel(selectedRun) }}</div>
          <q-space /><q-btn
            flat
            dense
            icon="refresh"
            @click="refreshDetail" /><q-btn
            flat
            dense
            icon="close"
            v-close-popup
        /></q-bar>
        <q-card-section class="q-pb-none"
          ><q-badge :color="statusColor(selectedRun.status)">{{
            statusLabel(selectedRun.status)
          }}</q-badge
          ><span class="q-ml-sm text-grey-7"
            >{{ selectedRun.phase }} · heartbeat
            {{ dateTime(selectedRun.heartbeat_at) }}</span
          >
          <div v-if="selectedRun.error" class="text-negative q-mt-sm">
            {{ selectedRun.error }}
          </div></q-card-section
        >
        <q-banner v-if="error" class="bg-red-1 text-red-9 q-ma-md">{{
          error
        }}</q-banner>
        <q-tabs v-model="detailTab" align="left" active-color="primary"
          ><q-tab name="summary" label="Risultati" /><q-tab
            name="trades"
            label="Trade"
            @click="loadTrades" /><q-tab
            name="params"
            label="Parametri run" /><q-tab
            name="log"
            label="Log"
            @click="loadLog"
        /></q-tabs>
        <q-card-section v-if="detailTab === 'summary'">
          <div class="row q-col-gutter-md q-mb-md">
            <div
              v-for="m in performanceCards"
              :key="m.label"
              class="col-6 col-md-3"
            >
              <q-card flat bordered
                ><q-card-section
                  ><div class="text-caption text-grey-7">{{ m.label }}</div>
                  <div class="text-h6">{{ m.value }}</div></q-card-section
                ></q-card
              >
            </div>
          </div>
          <equity-curve :points="equityPoints" />
          <div v-if="selectedRun.result?.benchmark" class="text-caption text-grey-7 q-mt-sm">
            Benchmark: {{ selectedRun.result.benchmark.automatic ? 'Buy&Hold automatico · equiponderato · senza leva/ribilanciamento' : selectedRun.result.benchmark.source_name }}
            <span v-if="selectedRun.result.benchmark.first_date"> · {{ selectedRun.result.benchmark.first_date }} → {{ selectedRun.result.benchmark.last_date }}</span>
          </div>
          <div class="q-gutter-sm q-mt-md">
            <q-btn
              v-if="hasArtifact('stats.html')"
              color="primary"
              outline
              no-caps
              icon="open_in_new"
              label="stats.html"
              :href="artifactUrl('stats.html')"
              target="_blank"
              rel="noopener noreferrer"
            />
            <q-btn
              v-if="hasArtifact('returns.csv')"
              color="primary"
              outline
              no-caps
              label="Salva come benchmark"
              @click="saveAsBenchmark"
            />
            <q-btn
              v-if="selectedRun.done"
              flat
              color="primary"
              icon="edit"
              label="Nome e note"
              @click="editRun"
            />
            <q-btn
              v-if="selectedRun.done"
              flat
              color="grey"
              :label="
                selectedRun.archive?.hidden
                  ? 'Ripristina in elenco'
                  : 'Nascondi dall’elenco'
              "
              @click="
                archiveRun(selectedRun, {
                  hidden: !selectedRun.archive?.hidden,
                })
              "
            />
          </div>
          <div v-if="selectedRun.archive?.notes" class="q-mt-md">
            {{ selectedRun.archive.notes }}
          </div>
          <div class="q-mt-md text-subtitle2">Artefatti disponibili</div>
          <div class="q-gutter-sm">
            <q-btn
              v-for="file in selectedRun.result?.artifacts || []"
              :key="file"
              flat
              dense
              no-caps
              color="primary"
              :label="file"
              :href="artifactUrl(file) + '?download=1'"
              target="_blank"
              rel="noopener noreferrer"
            />
          </div>
          <div v-if="!selectedRun.done" class="text-grey-7 q-mt-md">
            Calcolo in corso: risultati e report compariranno al termine. Il
            monitoraggio continua riaprendo la pagina.
          </div>
        </q-card-section>
        <q-card-section v-if="detailTab === 'trades'"
          ><q-table
            flat
            bordered
            :rows="tradeRows"
            :columns="tradeColumns"
            row-key="_index"
            :pagination="{ rowsPerPage: 0 }"
            hide-bottom />
          <div class="row justify-between q-mt-sm">
            <q-btn
              flat
              label="Precedenti"
              :disable="tradePage <= 1"
              @click="
                tradePage--;
                loadTrades();
              "
            /><span>{{ tradeTotal }} trade · pagina {{ tradePage }}</span
            ><q-btn
              flat
              label="Successivi"
              :disable="tradePage * 50 >= tradeTotal"
              @click="
                tradePage++;
                loadTrades();
              "
            /></div
        ></q-card-section>
        <q-card-section v-if="detailTab === 'params'"
          ><div class="text-subtitle2">
            Configurazione richiesta (congelata)
          </div>
          <pre class="studio-pre">{{
            JSON.stringify(selectedRun.request_snapshot?.configuration, null, 2)
          }}</pre>
          <div class="text-subtitle2">Risultato e parametri effettivi</div>
          <pre class="studio-pre">{{
            JSON.stringify(
              selectedRun.result?.results || selectedRun.result,
              null,
              2,
            )
          }}</pre>
        </q-card-section>
        <q-card-section v-if="detailTab === 'log'"
          ><q-btn flat label="Aggiorna log" icon="refresh" @click="loadLog" />
          <pre class="studio-pre">{{
            logText || "Nessun output disponibile"
          }}</pre>
        </q-card-section>
      </q-card></q-dialog
    >
  </q-page>
</template>

<script>
import { api } from "boot/axios";
import { constants } from "boot/constants";
import EquityCurve from "../components/EquityCurve.vue";

const endpoint = "/dyn/simulations";
const defaults = () => ({
  label: "",
  strategy: "generic.BuyAndHold",
  ticker: "NVDA,AVGO,MU",
  provider: "yahoo_adj",
  alpaca_feed: "sip",
  timeframe: "daily",
  compression: 1,
  fromdate: new Date(new Date().setFullYear(new Date().getFullYear() - 3))
    .toISOString()
    .slice(0, 10),
  todate: new Date().toISOString().slice(0, 10),
  cash: 200000,
  amount: 10000,
  commission: "alpaca",
  benchmark: null,
  stratargs: "",
  parameters: {},
  broker: {
    margin_leverage: 1,
    margin_rate: null,
    maintenance_margin: 0.25,
    slippage: 0,
    broker_coc: true,
    broker_coo: false,
    broker_shortcash: true,
    broker_checksubmit: true,
    slip_open: true,
    slip_match: true,
    slip_out: false,
  },
});
export default {
  components: { EquityCurve },
  props: { initialTab: { type: String, default: "new" } },
  data() {
    return {
      tab: this.initialTab,
      catalog: {},
      strategyOptions: [],
      schema: {},
      form: defaults(),
      preset: null,
      parameterInputs: {},
      parameterSearch: "",
      showAllParameters: false,
      schemaVersion: 0,
      schemaLoading: false,
      error: "",
      loading: false,
      validating: false,
      submitting: false,
      validation: null,
      jobs: [],
      schedules: [],
      timer: null,
      polling: false,
      search: "",
      pinnedOnly: false,
      showHidden: false,
      scheduleTime: "20:00",
      scheduleLabel: "",
      detailOpen: false,
      detailTab: "summary",
      selectedRun: null,
      equityPoints: [],
      logText: "",
      tradeRows: [],
      tradePage: 1,
      tradeTotal: 0,
      brokerFlags: [
        { key: "broker_coc", label: "Cheat-on-close (COC)" },
        { key: "broker_coo", label: "Cheat-on-open (COO)" },
        { key: "broker_shortcash", label: "Short cash" },
        { key: "broker_checksubmit", label: "Controllo disponibilità ordini" },
        { key: "slip_open", label: "Slippage anche in apertura" },
        { key: "slip_match", label: "Limita slippage al range della barra" },
        { key: "slip_out", label: "Consenti slippage fuori range" },
      ],
      runColumns: [
        {
          name: "label",
          label: "Simulazione",
          field: (r) => this.runLabel(r),
          align: "left",
          sortable: true,
        },
        {
          name: "created",
          label: "Avvio",
          field: (r) => this.dateTime(r.created_at),
          align: "left",
        },
        {
          name: "period",
          label: "Periodo simulato",
          field: (r) =>
            `${r.request_snapshot?.configuration?.fromdate || "—"} → ${r.request_snapshot?.configuration?.todate || "—"}`,
          align: "left",
        },
        {
          name: "leverage",
          label: "Leva broker",
          field: (r) =>
            r.request_snapshot?.configuration?.broker?.margin_leverage ?? "—",
          align: "right",
        },
        { name: "status", label: "Stato", field: "status", align: "left" },
        {
          name: "return",
          label: "Rendimento",
          field: (r) => this.percent(r.result?.performance?.total_return_pct),
          align: "right",
        },
        { name: "actions", label: "Azioni", align: "right" },
      ],
    };
  },
  computed: {
    archiveCards() {
      const runs = this.jobs.filter(
        (r) => r.kind === "simulation" && !r.archive?.hidden,
      );
      return [
        {
          label: "Strategie simulate",
          value: new Set(
            runs.map((r) => r.request_snapshot?.configuration?.strategy),
          ).size,
        },
        {
          label: "Simulazioni completate",
          value: runs.filter((r) => r.status === "completed").length,
        },
        {
          label: "In coda o in esecuzione",
          value: runs.filter((r) => ["queued", "running"].includes(r.status))
            .length,
        },
        {
          label: "Da verificare",
          value: runs.filter((r) =>
            ["failed", "interrupted"].includes(r.status),
          ).length,
        },
      ];
    },
    benchmarkOptions() {
      return (this.catalog.benchmarks || [])
        .filter((b) => !b.hidden && b.available !== false)
        .map((b) => ({ label: b.label, value: b.name }));
    },
    visibleParameters() {
      const priority = [
        "max_exposure",
        "max_concurrent",
        "min_concurrent",
        "sizing_policy",
        "max_adv_participation",
        "period",
        "post_up_cooldown_threshold",
        "post_up_cooldown_days",
      ];
      let p = [...(this.schema.parameters || [])]
        .sort(
          (a, b) =>
            (priority.includes(a.name) ? priority.indexOf(a.name) : 100) -
            (priority.includes(b.name) ? priority.indexOf(b.name) : 100),
        )
        .filter(
          (p) =>
            !this.parameterSearch ||
            p.name.toLowerCase().includes(this.parameterSearch.toLowerCase()),
        );
      return !this.parameterSearch && !this.showAllParameters
        ? p.slice(0, 12)
        : p;
    },
    filteredRuns() {
      return this.jobs.filter(
        (r) =>
          (this.showHidden || !r.archive?.hidden) &&
          (!this.pinnedOnly || r.archive?.pinned) &&
          JSON.stringify([
            this.runLabel(r),
            r.request_snapshot?.configuration?.strategy,
            r.status,
          ])
            .toLowerCase()
            .includes(this.search.toLowerCase()),
      );
    },
    tradeColumns() {
      const keys = [...new Set(this.tradeRows.flatMap((r) => Object.keys(r)))]
        .filter((k) => k !== "_index")
        .slice(0, 16);
      return keys.map((k) => ({
        name: k,
        label: k,
        field: (r) => (typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]),
        align: "left",
        sortable: true,
      }));
    },
    performanceCards() {
      const p = this.selectedRun?.result?.performance || {};
      return [
        {
          label: "Rendimento su capitale",
          value: this.percent(p.total_return_pct),
        },
        { label: "Max drawdown", value: this.percent(p.max_drawdown_pct) },
        {
          label: "Equity finale",
          value:
            p.final_equity == null
              ? "—"
              : Number(p.final_equity).toLocaleString("it-IT", {
                  maximumFractionDigits: 2,
                }),
        },
        { label: "Trade", value: p.trades ?? "—" },
      ];
    },
  },
  watch: {
    initialTab(value) {
      this.tab = value;
    },
  },
  async mounted() {
    await this.load();
    if (this.$route.query.run) {
      this.tab = "runs";
      await this.openRun({ id: this.$route.query.run });
    }
    this.timer = window.setInterval(() => this.poll(), 3000);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    message(e) {
      return e?.response?.data?.error || e.message || String(e);
    },
    percent(v) {
      return v == null ? "—" : `${Number(v).toFixed(2)}%`;
    },
    dateTime(v) {
      return v ? new Date(v).toLocaleString("it-IT") : "—";
    },
    statusLabel(s) {
      return (
        {
          queued: "In coda",
          running: "In esecuzione",
          completed: "Completato",
          failed: "Errore",
          interrupted: "Interrotto",
        }[s] || s
      );
    },
    statusColor(s) {
      return (
        {
          completed: "positive",
          failed: "negative",
          interrupted: "orange",
          running: "primary",
          queued: "grey",
        }[s] || "grey"
      );
    },
    runLabel(r) {
      return (
        r.archive?.label ||
        r.request_snapshot?.configuration?.label ||
        r.request_snapshot?.configuration?.strategy ||
        r.kind
      );
    },
    async load() {
      this.loading = true;
      try {
        const { data } = await api.get(endpoint + "/catalog");
        this.catalog = data;
        this.strategyOptions = data.strategies;
        await Promise.all([this.loadSchema(false), this.poll()]);
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.loading = false;
      }
    },
    filterStrategies(value, update) {
      update(() => {
        this.strategyOptions = (this.catalog.strategies || []).filter((s) =>
          s.label.toLowerCase().includes((value || "").toLowerCase()),
        );
      });
    },
    async loadSchema(reset) {
      const version = ++this.schemaVersion;
      this.schemaLoading = true;
      if (reset) {
        this.parameterInputs = {};
        this.validation = null;
        this.form.stratargs = "";
      }
      try {
        const { data } = await api.get(endpoint + "/strategy", {
          params: { name: this.form.strategy },
        });
        if (version === this.schemaVersion) this.schema = data;
      } catch (e) {
        if (version === this.schemaVersion) this.error = this.message(e);
      } finally {
        if (version === this.schemaVersion) this.schemaLoading = false;
      }
    },
    setParameter(key, value) {
      if (value == null || value === "") delete this.parameterInputs[key];
      else this.parameterInputs[key] = value;
      this.validation = null;
    },
    parameterType(type) {
      return (
        {
          int: "numero intero",
          float: "numero",
          str: "testo",
          NoneType: "opzionale",
          list: "lista JSON",
          dict: "oggetto JSON",
        }[type] || type
      );
    },
    config() {
      const parameters = {};
      for (const [k, v] of Object.entries(this.parameterInputs)) {
        const schema = (this.schema.parameters || []).find((p) => p.name === k);
        if (schema?.type === "str") parameters[k] = v;
        else {
          try {
            parameters[k] = JSON.parse(v);
          } catch {
            if (schema?.type === "NoneType" && !/^[\[\{]/.test(v))
              parameters[k] = v;
            else
              throw new Error(
                `${k}: usare un valore JSON valido, es. 3, true, null o [1,2]`,
              );
          }
        }
      }
      return { ...this.form, parameters, mode: "backtest" };
    },
    async applyPreset() {
      try {
        const { data } = await api.get(
          endpoint + "/preset/" + encodeURIComponent(this.preset),
        );
        this.form = {
          ...defaults(),
          ...data,
          broker: { ...defaults().broker, ...data.broker },
        };
        await this.loadSchema(true);
        this.parameterInputs = Object.fromEntries(
          Object.entries(data.parameters || {}).map(([k, v]) => [
            k,
            typeof v === "string" ? v : JSON.stringify(v),
          ]),
        );
        this.form.stratargs = "";
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async validate() {
      this.validating = true;
      this.error = "";
      try {
        this.validation = (
          await api.post(endpoint + "/validate", this.config())
        ).data;
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.validating = false;
      }
    },
    async submit() {
      this.submitting = true;
      this.error = "";
      try {
        const { data } = await api.post(endpoint + "/jobs", this.config());
        this.tab = "runs";
        await this.poll();
        await this.openRun(data);
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.submitting = false;
      }
    },
    async poll() {
      if (this.polling) return;
      this.polling = true;
      try {
        const [jobs, schedules] = await Promise.all([
          api.get(endpoint + "/jobs"),
          api.get(endpoint + "/schedules"),
        ]);
        this.jobs = jobs.data;
        this.schedules = schedules.data;
        if (this.detailOpen && this.selectedRun) {
          const id = this.selectedRun.id;
          const fresh = (await api.get(`${endpoint}/jobs/${id}`)).data;
          if (id === this.selectedRun?.id) {
            const completed = !this.selectedRun.done && fresh.done;
            this.selectedRun = fresh;
            if (completed) await this.loadEquity();
            if (this.detailTab === "log") await this.loadLog();
          }
        }
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.polling = false;
      }
    },
    async openRun(row) {
      this.selectedRun = row;
      this.detailTab = "summary";
      this.detailOpen = true;
      this.tradePage = 1;
      this.tradeRows = [];
      this.equityPoints = [];
      this.logText = "";
      try {
        const { data } = await api.get(`${endpoint}/jobs/${row.id}`);
        if (row.id === this.selectedRun?.id) this.selectedRun = data;
        await this.loadEquity();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async refreshDetail() {
      await this.poll();
      await this.loadEquity();
    },
    async loadEquity() {
      const id = this.selectedRun?.id;
      if (!id || !this.hasArtifact("returns.csv")) return;
      try {
        const { data } = await api.get(`${endpoint}/jobs/${id}/equity`);
        if (id === this.selectedRun?.id) this.equityPoints = data.points;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async loadLog() {
      const id = this.selectedRun?.id;
      if (!id) return;
      try {
        const { data } = await api.get(`${endpoint}/jobs/${id}/log`);
        if (id === this.selectedRun?.id) this.logText = data.output;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async loadTrades() {
      const id = this.selectedRun?.id;
      if (!id || !this.hasArtifact("trades.json")) return;
      try {
        const { data } = await api.get(`${endpoint}/jobs/${id}/trades`, {
          params: { page: this.tradePage, limit: 50 },
        });
        if (id === this.selectedRun?.id) {
          this.tradeRows = data.rows.map((r, i) => ({ ...r, _index: i }));
          this.tradeTotal = data.total;
        }
      } catch (e) {
        this.error = this.message(e);
      }
    },
    hasArtifact(file) {
      return (this.selectedRun?.result?.artifacts || []).includes(file);
    },
    artifactUrl(file) {
      return `${constants.API_BASE_URL}${endpoint}/jobs/${this.selectedRun.id}/artifacts/${encodeURIComponent(file)}`;
    },
    async cloneRun(row) {
      const config = row.request_snapshot?.configuration;
      if (!config?.strategy) return;
      this.form = {
        ...defaults(),
        ...config,
        broker: { ...defaults().broker, ...config.broker },
      };
      await this.loadSchema(false);
      this.parameterInputs = Object.fromEntries(
        Object.entries(config.parameters || {}).map(([k, v]) => [
          k,
          typeof v === "string" ? v : JSON.stringify(v),
        ]),
      );
      this.form.stratargs = "";
      this.tab = "new";
      this.detailOpen = false;
      this.validation = null;
    },
    async archiveRun(row, patch) {
      try {
        await api.patch(`${endpoint}/jobs/${row.id}`, patch);
        await this.poll();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    editRun() {
      const row = this.selectedRun;
      this.$q
        .dialog({
          title: "Nome simulazione",
          prompt: { model: this.runLabel(row), type: "text" },
          cancel: true,
        })
        .onOk((label) => {
          this.$q
            .dialog({
              title: "Note",
              prompt: { model: row.archive?.notes || "", type: "textarea" },
              cancel: true,
            })
            .onOk((notes) => this.archiveRun(row, { label, notes }));
        });
    },
    saveAsBenchmark() {
      const id = this.selectedRun.id;
      this.$q
        .dialog({
          title: "Salva benchmark",
          message:
            "Archivia i rendimenti di questo run con un nome riconoscibile.",
          prompt: { model: this.runLabel(this.selectedRun), type: "text" },
          cancel: true,
        })
        .onOk(async (label) => {
          try {
            await api.post(endpoint + "/benchmarks", { job_id: id, label });
            this.catalog.benchmarks = (
              await api.get(endpoint + "/benchmarks")
            ).data;
            this.$q.notify({ type: "positive", message: "Benchmark salvato" });
          } catch (e) {
            this.error = this.message(e);
          }
        });
    },
    async createSchedule() {
      this.submitting = true;
      try {
        const [hour, minute] = this.scheduleTime.split(":").map(Number);
        await api.post(endpoint + "/schedules", {
          configuration: this.config(),
          label: this.scheduleLabel,
          hour,
          minute,
          enabled: true,
        });
        await this.poll();
        this.$q.notify({
          type: "positive",
          message: "Pianificazione giornaliera creata",
        });
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.submitting = false;
      }
    },
    async toggleSchedule(s, enabled) {
      try {
        await api.patch(endpoint + "/schedules/" + s.id, { enabled });
        await this.poll();
      } catch (e) {
        this.error = this.message(e);
      }
    },
  },
};
</script>
<style scoped>
.studio-page {
  max-width: 1600px;
  margin: auto;
}
.studio-summary {
  position: sticky;
  top: 80px;
}
.studio-pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 55vh;
  overflow: auto;
  background: #f3f6fa;
  padding: 16px;
  border-radius: 8px;
}
.studio-error {
  max-width: 330px;
  white-space: normal;
}
</style>
