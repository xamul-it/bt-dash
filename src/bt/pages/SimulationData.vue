<template>
  <q-page class="q-pa-md">
    <div class="row items-center"><div class="col text-h5">Dati ticker</div><q-btn flat to="/TickerLists" icon="list" label="Liste ticker" /></div>
    <div class="text-grey-7 q-mb-md">
      Esplora gli storici realmente presenti su disco, con provider, feed,
      copertura e barre OHLCV.
    </div>
    <q-banner v-if="error" class="bg-red-1 text-red-9 q-mb-md" rounded>{{
      error
    }}</q-banner>
    <q-card flat bordered class="q-mb-md"
      ><q-card-section class="row q-col-gutter-md items-start">
        <q-select
          class="col-12 col-md-5"
          outlined
          dense
          label="Lista o ticker separati da virgola"
          v-model="ticker"
          :options="lists"
          emit-value
          map-options
          use-input
          fill-input
          hide-selected
          input-debounce="0"
          new-value-mode="add-unique"
        />
        <q-select
          class="col-6 col-md-2"
          outlined
          dense
          label="Provider"
          v-model="provider"
          :options="['yahoo', 'yahoo_adj', 'alpaca']"
        />
        <q-select
          class="col-6 col-md-2"
          outlined
          dense
          label="Barre sorgenti"
          v-model="timeframe"
          :options="['daily', 'minutes']"
        />
        <q-select
          v-if="provider === 'alpaca'"
          class="col-6 col-md-2"
          outlined
          dense
          label="Feed Alpaca"
          v-model="feed"
          :options="['sip', 'iex']"
        />
        <div class="col-auto">
          <q-btn
            color="primary"
            label="Esplora"
            icon="search"
            :loading="loading"
            @click="load"
          />
        </div>
        <q-input
          class="col-6 col-md-3"
          outlined
          dense
          type="date"
          v-model="fromdate"
          label="Scarica da"
          stack-label
        />
        <div class="col-auto">
          <q-btn
            outline
            color="primary"
            label="Aggiorna storico"
            icon="cloud_download"
            :disable="refreshing"
            @click="confirmRefresh"
          />
        </div>
        <div class="col-12 text-caption text-grey-7">
          Yahoo: prezzi non aggiustati · Yahoo Adj: prezzi aggiustati · Alpaca:
          feed SIP/IEX separati. Il download è incrementale e non azzera i file
          esistenti.
        </div>
      </q-card-section></q-card
    >
    <q-banner v-if="refreshJob" class="bg-blue-1 q-mb-md" rounded>
      Aggiornamento: {{ refreshJob.status }} · {{ refreshJob.phase }}
      <div v-if="refreshJob.error" class="text-negative">
        {{ refreshJob.error }}
      </div>
      <q-btn flat no-caps label="Log" icon="description" @click="openLog" />
    </q-banner>
    <q-table
      flat
      bordered
      :rows="rows"
      :columns="columns"
      row-key="symbol"
      :loading="loading"
      :pagination="{ rowsPerPage: 25 }"
      no-data-label="Seleziona una lista o un ticker e premi Esplora."
    >
      <template #body-cell-available="p"
        ><q-td :props="p"
          ><q-icon name="circle" size="14px"
            :color="p.row.error ? 'negative' : p.row.available ? 'positive' : 'orange'"
            :aria-label="p.row.error ? 'Errore lettura' : p.row.available ? 'Disponibile' : 'Assente'"
          ><q-tooltip>{{ p.row.error || (p.row.available ? 'Disponibile' : 'Assente') }}</q-tooltip></q-icon></q-td
        ></template
      >
      <template #body-cell-format="p">
        <q-td :props="p"><q-icon :name="p.row.format === 'parquet' ? 'view_column' : p.row.format === 'csv' ? 'table_view' : 'help_outline'" size="20px" :aria-label="p.row.format || 'Formato sconosciuto'"><q-tooltip>{{ p.row.format || 'Formato sconosciuto' }}</q-tooltip></q-icon></q-td>
      </template>
      <template #body-cell-actions="p"
        ><q-td :props="p"
          ><q-btn
            flat
            dense
            label="Barre e grafico"
            icon="candlestick_chart"
            :disable="!p.row.available"
            @click="openBars(p.row)" /></q-td
      ></template>
    </q-table>
    <div class="row items-center q-gutter-md text-caption text-grey-7 q-mt-sm">
      <span><q-icon name="view_column" /> Parquet</span><span><q-icon name="table_view" /> CSV</span>
      <span><q-icon name="circle" color="positive" /> Disponibile</span><span><q-icon name="circle" color="orange" /> Assente</span><span><q-icon name="circle" color="negative" /> Errore di lettura</span>
    </div>
    <q-dialog v-model="barsDialog" maximized
      ><q-card
        ><q-bar
          ><div>{{ selectedSymbol }} · {{ selectedSource }}</div>
          <q-space /><q-btn flat dense icon="close" v-close-popup /></q-bar
        ><q-card-section
          ><equity-curve :points="pricePoints" />
          <div class="text-caption q-mb-md">
            Prezzo di chiusura normalizzato sulla prima barra visualizzata ·
            ultime {{ bars.length }} barre
          </div>
          <q-table
            flat
            bordered
            :rows="bars"
            :columns="barColumns"
            row-key="_index"
            :pagination="{ rowsPerPage: 25 }" /></q-card-section></q-card
    ></q-dialog>
    <q-dialog v-model="logDialog"
      ><q-card style="width: 1000px; max-width: 95vw"
        ><q-bar
          ><div>Log aggiornamento dati</div>
          <q-space /><q-btn flat dense icon="refresh" @click="openLog" /><q-btn
            flat
            dense
            icon="close"
            v-close-popup /></q-bar
        ><q-card-section>
          <pre
            style="
              white-space: pre-wrap;
              word-break: break-word;
              max-height: 65vh;
              overflow: auto;
            "
            >{{ log }}</pre>
        </q-card-section></q-card
      ></q-dialog
    >
  </q-page>
</template>
<script>
import { api } from "boot/axios";
import EquityCurve from "../components/EquityCurve.vue";
export default {
  components: { EquityCurve },
  data() {
    return {
      lists: [],
      ticker: "NVDA,AVGO,MU",
      provider: "yahoo_adj",
      timeframe: "daily",
      feed: "sip",
      fromdate: "2000-01-01",
      rows: [],
      loading: false,
      error: "",
      refreshJob: null,
      timer: null,
      polling: false,
      barsDialog: false,
      bars: [],
      selectedSymbol: "",
      selectedSource: "",
      loadedTimeframe: "daily",
      barsTimeframe: "daily",
      logDialog: false,
      log: "",
      columns: [
        {
          name: "symbol",
          label: "Ticker",
          field: "symbol",
          align: "left",
          sortable: true,
        },
        {
          name: "available",
          label: "Stato",
          field: "available",
          align: "left",
        },
        { name: "format", label: "Formato", field: "format", align: "left" },
        { name: "bars", label: "Barre", field: "bars", align: "right" },
        {
          name: "first_bar",
          label: "Prima barra",
          field: "first_bar",
          format: (v) => this.formatBarDate(v, this.loadedTimeframe),
          align: "left",
        },
        {
          name: "last_bar",
          label: "Ultima barra",
          field: "last_bar",
          format: (v) => this.formatBarDate(v, this.loadedTimeframe),
          align: "left",
        },
        {
          name: "updated_at",
          label: "File aggiornato",
          field: (r) =>
            r.updated_at ? (this.loadedTimeframe === "daily" ? new Date(r.updated_at).toLocaleDateString("it-IT") : new Date(r.updated_at).toLocaleString("it-IT")) : "—",
          align: "left",
        },
        { name: "actions", label: "Azioni", align: "right" },
      ],
    };
  },
  computed: {
    refreshing() {
      return ["queued", "running"].includes(this.refreshJob?.status);
    },
    barColumns() {
      return Object.keys(this.bars[0] || {})
        .filter((k) => k !== "_index")
        .map((k) => ({
          name: k,
          label: k,
          field: k,
          align: "left",
          sortable: true,
          format: (v) => ["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(k.toLowerCase()) ? this.formatBarDate(v, this.barsTimeframe) : v,
        }));
    },
    pricePoints() {
      const key = Object.keys(this.bars[0] || {}).find(
        (k) => k.toLowerCase() === "close",
      );
      const dateKey = Object.keys(this.bars[0] || {}).find((k) =>
        ["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(k.toLowerCase()),
      );
      if (!key || !this.bars[0]?.[key]) return [];
      const first = Number(this.bars[0][key]);
      return this.bars.map((r) => ({
        date: this.formatBarDate(r[dateKey], this.barsTimeframe),
        value: Number(r[key]) / first,
      }));
    },
  },
  async mounted() {
    try {
      const query = this.$route.query;
      if (typeof query.ticker === 'string') this.ticker = query.ticker;
      if (['yahoo', 'yahoo_adj', 'alpaca'].includes(query.provider)) this.provider = query.provider;
      if (['sip', 'iex'].includes(query.feed)) this.feed = query.feed;
      this.lists = (
        await api.get("/dyn/simulations/catalog")
      ).data.ticker_lists;
      await this.load();
      await this.poll();
      this.timer = window.setInterval(() => this.poll(), 3000);
    } catch (e) {
      this.error = this.message(e);
    }
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    formatBarDate(value, timeframe) {
      if (value == null || value === "") return "—";
      const text = String(value);
      return timeframe === "daily" ? text.slice(0, 10) : text.replace("T", " ");
    },
    message(e) {
      return e.response?.data?.error || e.message;
    },
    params() {
      return {
        ticker: this.ticker,
        provider: this.provider,
        timeframe: this.timeframe,
        feed: this.feed,
      };
    },
    async load() {
      this.loading = true;
      this.error = "";
      try {
        const params = this.params();
        this.rows = (
          await api.get("/dyn/simulations/data", { params })
        ).data;
        this.loadedTimeframe = params.timeframe;
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.loading = false;
      }
    },
    async openBars(row) {
      try {
        const params = this.params();
        const { data } = await api.get(
          `/dyn/simulations/data/${encodeURIComponent(row.symbol)}/bars`,
          { params: { ...params, limit: 500 } },
        );
        this.bars = data.map((r, i) => ({ ...r, _index: i }));
        this.barsTimeframe = params.timeframe;
        this.selectedSymbol = row.symbol;
        this.selectedSource = `${params.provider} / ${params.timeframe}${params.provider === "alpaca" ? " / " + params.feed : ""}`;
        this.barsDialog = true;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    confirmRefresh() {
      this.$q
        .dialog({
          title: "Aggiorna dati storici",
          message: `Scaricare ${this.ticker} da ${this.provider}${this.provider === "alpaca" ? " / " + this.feed : ""}, barre ${this.timeframe}, dal ${this.fromdate}?`,
          cancel: true,
        })
        .onOk(async () => {
          try {
            this.refreshJob = (
              await api.post("/dyn/simulations/data/refresh", {
                ...this.params(),
                alpaca_feed: this.feed,
                fromdate: this.fromdate,
              })
            ).data;
          } catch (e) {
            this.error = this.message(e);
          }
        });
    },
    async poll() {
      if (this.polling) return;
      this.polling = true;
      try {
        const { data } = await api.get("/dyn/simulations/jobs");
        const next = data.find((r) => r.kind === "market_data_refresh");
        const finished = this.refreshing && next?.done;
        this.refreshJob = next || null;
        if (finished) await this.load();
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.polling = false;
      }
    },
    async openLog() {
      if (!this.refreshJob) return;
      try {
        this.log = (
          await api.get(`/dyn/simulations/jobs/${this.refreshJob.id}/log`)
        ).data.output;
        this.logDialog = true;
      } catch (e) {
        this.error = this.message(e);
      }
    },
  },
};
</script>
