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
        <div class="col-auto">
          <q-btn outline color="primary" icon="edit" label="Modifica simboli"
            :disable="!selectedList" @click="openMembers" />
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
    <q-dialog v-model="membersDialog"><q-card style="width: 600px; max-width: 95vw">
      <q-card-section class="text-h6">Simboli · {{ membersTicker }}</q-card-section>
      <q-card-section>
        <div class="text-caption q-mb-md">I simboli disabilitati restano nella lista e sono esclusi dai nuovi utilizzi.</div>
        <div class="row q-gutter-sm items-start">
          <q-input class="col" outlined dense label="Aggiungi simbolo" v-model="newSymbol" @keyup.enter="changeMember(newSymbol, 'add')" />
          <q-btn color="primary" label="Aggiungi" :loading="membersBusy" @click="changeMember(newSymbol, 'add')" />
        </div>
        <q-banner v-if="membersError" class="bg-red-1 text-negative q-mt-sm">{{ membersError }}</q-banner>
        <q-list separator class="q-mt-md" style="max-height: 50vh; overflow: auto">
          <q-item v-for="symbol in members.active" :key="'active-' + symbol">
            <q-item-section>{{ symbol }}</q-item-section><q-item-section side><q-btn flat dense color="negative" label="Disabilita" :disable="membersBusy" @click="changeMember(symbol, 'disable')" /></q-item-section>
          </q-item>
          <q-item v-for="symbol in members.inactive" :key="'inactive-' + symbol">
            <q-item-section class="text-grey-7">{{ symbol }} · disabilitato</q-item-section><q-item-section side><q-btn flat dense color="primary" label="Riattiva" :disable="membersBusy" @click="changeMember(symbol, 'enable')" /></q-item-section>
          </q-item>
        </q-list>
      </q-card-section><q-card-actions align="right"><q-btn flat label="Chiudi" v-close-popup /></q-card-actions>
    </q-card></q-dialog>
    <q-dialog v-model="barsDialog" maximized @show="showBarsChart"
      ><q-card
        ><q-bar
          ><div>{{ selectedSymbol }} · {{ selectedSource }}</div>
          <q-space /><q-btn flat dense icon="close" v-close-popup /></q-bar
        ><q-card-section
          ><div v-if="barsYahoo" class="row items-center q-gutter-sm q-mb-sm">
            <q-btn-toggle v-model="priceMode" toggle-color="primary" :options="[{label: 'Normale', value: 'normal'}, {label: 'Raw', value: 'raw', disable: !hasRaw}, {label: 'Adj', value: 'adjusted', disable: !hasAdjusted}]" />
          </div>
          <div v-if="barsYahoo" class="text-caption text-grey-8 q-mb-sm">{{ priceDescription }}</div>
          <div class="text-caption text-grey-8 q-mb-sm">
            <strong>Legenda:</strong> O apertura · H massimo · L minimo · C chiusura · Vol volume.
            Candele e barre volume verdi: chiusura almeno pari all’apertura; rosse: chiusura inferiore.
            <span v-if="barsYahoo"><span style="color: #7c3aed">● D</span>: variazione del fattore Adj/Raw desunta dai prezzi; la causa e l’importo dell’evento non sono disponibili.</span>
          </div>
          <financial-chart
            v-if="barsDialog && bars.length"
            ref="barsChart"
            mode="market"
            :bars="chartBars"
            :markers="adjustmentMarkers"
            @load-older="loadOlderBars"
            :timeframe="barsTimeframe"
            :height="460"
            :aria-label="`Grafico candlestick interattivo di ${selectedSymbol}`"
          />
          <div class="text-caption q-mb-md">
            Prezzo OHLC e volumi · {{ bars.length }} barre caricate · trascina o riduci lo zoom per caricare lo storico precedente
            <span v-if="barsLoading"> · Caricamento…</span><span v-else-if="!barsHasMore"> · Inizio storico raggiunto</span>
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
import FinancialChart from "../components/FinancialChart.vue";
export default {
  components: { FinancialChart },
  data() {
    return {
      lists: [],
      membersDialog: false,
      membersTicker: '',
      members: { active: [], inactive: [] },
      membersBusy: false,
      membersError: '',
      newSymbol: '',
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
      barsParams: null,
      barsLoading: false,
      barsHasMore: true,
      priceMode: "adjusted",
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
    selectedList() {
      return this.lists.some((list) => list.value === this.ticker);
    },
    refreshing() {
      return ["queued", "running"].includes(this.refreshJob?.status);
    },
    barsYahoo() { return ["yahoo", "yahoo_adj"].includes(this.barsParams?.provider); },
    hasRaw() { return this.barsParams?.provider === "yahoo" || this.bars.some((row) => row["Raw Close"] != null); },
    hasAdjusted() { return this.bars.some((row) => row["Adj Close"] != null) || this.barsParams?.provider === "yahoo_adj"; },
    priceDescription() {
      if (this.priceMode === "normal") return this.barsParams?.provider === "yahoo_adj"
        ? "Normale: colonne OHLC standard del file yahoo_adj, già aggiustate. Il volume è quello fornito da Yahoo."
        : "Normale: colonne OHLC standard del file Yahoo, senza l’aggiustamento Adj. Coincidono con Raw; possono già riflettere gli split applicati dal provider.";
      if (this.priceMode === "raw") return "Raw: OHLC originali scaricati da Yahoo prima dell’aggiustamento Adj; non sono necessariamente prezzi storici senza correzioni per split. Il volume è quello fornito da Yahoo.";
      return "Adj: OHLC aggiustati con il rapporto Adj Close / Close di Yahoo, che riflette gli aggiustamenti del provider, inclusi dividendi e altre operazioni societarie. Apertura, massimo e minimo sono calcolati con lo stesso fattore; il volume resta quello fornito da Yahoo.";
    },
    chartBars() {
      if (!this.barsYahoo || this.priceMode === "normal") return this.bars;
      return this.bars.map((row) => {
        const result = { ...row };
        const close = Number(row["Raw Close"] ?? row.Close);
        const adjusted = Number(row["Adj Close"]);
        const factor = close && Number.isFinite(adjusted) ? adjusted / close : null;
        for (const key of ["Open", "High", "Low", "Close"]) {
          const raw = row[`Raw ${key}`] ?? (this.barsParams.provider === "yahoo" ? row[key] : null);
          const adj = row[`Adj ${key}`] ?? (this.barsParams.provider === "yahoo_adj" ? row[key] : (raw != null && factor != null ? Number(raw) * factor : null));
          result[key] = this.priceMode === "raw" ? raw : adj;
        }
        return result;
      });
    },
    adjustmentMarkers() {
      if (!this.barsYahoo) return [];
      const markers = [];
      let previous = null;
      for (const row of this.bars) {
        const raw = Number(row["Raw Close"] ?? row.Close);
        const adj = Number(row["Adj Close"]);
        const factor = raw && Number.isFinite(adj) ? adj / raw : null;
        if (factor != null && previous != null && Math.abs(factor / previous - 1) > 0.0001) {
          const dateKey = Object.keys(row).find((k) => ["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(k.toLowerCase()));
          if (dateKey) markers.push({ time: row[dateKey], position: "aboveBar", color: "#7c3aed", shape: "circle", text: "D" });
        }
        previous = factor;
      }
      return markers;
    },
    barColumns() {
      return Object.keys(this.bars[0] || {})
        .filter((k) => k !== "_index")
        .sort((a, b) => {
          const rank = (key) => {
            const name = key.toLowerCase();
            if (["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(name)) return 0;
            if (name === "adj factor") return 1;
            return name.includes("volume") ? 3 : 2;
          };
          return rank(a) - rank(b);
        })
        .map((k) => ({
          name: k,
          label: k,
          field: k,
          align: "left",
          sortable: true,
          format: (v) => ["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(k.toLowerCase()) ? this.formatBarDate(v, this.barsTimeframe) : (typeof v === "number" ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: /volume/i.test(k) ? 0 : 4 }).format(v) : v ?? "—"),
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
    async openMembers() {
      this.membersTicker = this.ticker;
      this.membersError = '';
      this.newSymbol = '';
      try {
        this.members = (await api.get(`/dyn/simulations/ticker-lists/${encodeURIComponent(this.membersTicker)}/members`)).data;
        this.membersDialog = true;
      } catch (e) { this.error = this.message(e); }
    },
    async changeMember(symbol, action) {
      if (this.membersBusy) return;
      this.membersBusy = true;
      this.membersError = '';
      try {
        this.members = (await api.post(`/dyn/simulations/ticker-lists/${encodeURIComponent(this.membersTicker)}/members`, { symbol, action })).data;
        this.newSymbol = '';
        if (this.ticker === this.membersTicker) await this.load();
      } catch (e) { this.membersError = this.message(e); }
      finally { this.membersBusy = false; }
    },
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
        this.barsParams = params;
        this.barsHasMore = data.length === 500;
        this.priceMode = "normal";
        this.barsTimeframe = params.timeframe;
        this.selectedSymbol = row.symbol;
        this.selectedSource = `${params.provider} / ${params.timeframe}${params.provider === "alpaca" ? " / " + params.feed : ""}`;
        this.barsDialog = true;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async loadOlderBars() {
      if (this.barsLoading || !this.barsHasMore || !this.bars.length || !this.barsDialog) return;
      const first = this.bars[0];
      const dateKey = Object.keys(first).find((k) => ["date", "timestamp", "datetime", "index", "__index_level_0__"].includes(k.toLowerCase()));
      if (!dateKey) { this.barsHasMore = false; return; }
      this.barsLoading = true;
      const symbol = this.selectedSymbol;
      const params = this.barsParams;
      try {
        const { data } = await api.get(`/dyn/simulations/data/${encodeURIComponent(symbol)}/bars`, { params: { ...params, limit: 500, before: first[dateKey] } });
        if (this.selectedSymbol !== symbol || this.barsParams !== params || !this.barsDialog) return;
        this.barsHasMore = data.length === 500;
        this.bars = [...data.map((row, i) => ({ ...row, _index: -this.bars.length - i })), ...this.bars];
      } catch (e) { this.error = this.message(e); this.barsHasMore = false; }
      finally { this.barsLoading = false; }
    },
    showBarsChart() {
      this.$nextTick(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => this.$refs.barsChart?.refresh());
        });
      });
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
