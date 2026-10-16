<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h5">Archivio benchmark</div>
        <div class="text-grey-7">
          Rendimenti storici riutilizzabili nei backtest. Salva un run come
          benchmark, importa un CSV oppure abilita il Buy&Hold giornaliero delle
          liste selezionate.
        </div>
      </div>
      <q-btn
        flat
        icon="refresh"
        label="Aggiorna"
        @click="load"
        :loading="loading"
      />
    </div>
    <q-banner v-if="error" class="bg-red-1 text-red-9 q-mb-md" rounded>{{
      error
    }}</q-banner>
    <q-card flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Liste da usare per benchmark</div>
        <div class="text-caption text-grey-7 q-mb-md">
          Solo le liste abilitate vengono mantenute. Ogni giorno: download
          incrementale → Buy&Hold equiponderato a quote fisse, senza leva o
          ribilanciamento. Orario Europe/Rome; default 01:15, dopo la chiusura
          USA. CSV e run salvati non vengono aggiornati.
        </div>
        <div class="row q-col-gutter-sm items-start">
          <q-select
            class="col-12 col-md-4"
            outlined
            dense
            label="Lista ticker per benchmark"
            v-model="managed.ticker"
            :options="lists"
            emit-value
            map-options
          />
          <q-select
            class="col-6 col-md-2"
            outlined
            dense
            label="Provider benchmark"
            v-model="managed.provider"
            :options="['yahoo', 'yahoo_adj', 'alpaca']"
          />
          <q-select
            v-if="managed.provider === 'alpaca'"
            class="col-6 col-md-2"
            outlined
            dense
            label="Feed benchmark"
            v-model="managed.alpaca_feed"
            :options="['sip', 'iex']"
          />
          <q-input
            class="col-6 col-md-2"
            outlined
            dense
            type="date"
            stack-label
            label="Storico da"
            v-model="managed.fromdate"
          />
          <q-input
            class="col-3 col-md-1"
            outlined
            dense
            type="number"
            label="Ora"
            v-model.number="managed.hour"
            min="0"
            max="23"
          />
          <q-input
            class="col-3 col-md-1"
            outlined
            dense
            type="number"
            label="Minuti"
            v-model.number="managed.minute"
            min="0"
            max="59"
          />
          <div class="col-12">
            <q-checkbox
              v-model="managed.enabled"
              label="Usa per benchmark · aggiornamento giornaliero"
            /><q-btn
              color="primary"
              :label="managed.enabled ? 'Salva e calcola' : 'Salva configurazione'"
              icon="playlist_add_check"
              :disable="!managed.ticker"
              :loading="savingDefinition"
              @click="saveDefinition"
            />
          </div>
        </div>
        <q-list v-if="definitions.length" separator class="q-mt-md">
          <q-item v-for="definition in definitions" :key="definition.id">
            <q-item-section
              ><q-item-label>{{ definition.label }}</q-item-label
              ><q-item-label caption
                >{{ definition.ticker }} · {{ definition.provider
                }}{{
                  definition.provider === "alpaca"
                    ? " / " + definition.alpaca_feed
                    : ""
                }}
                · {{ String(definition.hour).padStart(2, "0") }}:{{
                  String(definition.minute).padStart(2, "0")
                }}
                Europe/Rome</q-item-label
              >
              <q-item-label caption v-if="definition.job"
                >{{ definition.job.status }} · {{ definition.job.phase }}
                <span class="text-negative">{{
                  definition.job.error
                }}</span></q-item-label
              >
              <q-item-label
                caption
                class="text-negative"
                v-if="definition.last_error"
                >{{ definition.last_error }}</q-item-label
              >
            </q-item-section>
            <q-item-section side
              ><div class="row items-center">
                <q-toggle
                  :model-value="definition.enabled"
                  :aria-label="'Usa per benchmark ' + definition.label"
                  @update:model-value="
                    (enabled) => toggleDefinition(definition, enabled)
                  "
                /><q-btn
                  flat
                  round
                  icon="refresh"
                  :disable="
                    ['queued', 'running'].includes(definition.job?.status)
                  "
                  aria-label="Aggiorna benchmark ora"
                  @click="refreshDefinition(definition)"
                  ><q-tooltip>Scarica e ricalcola ora</q-tooltip></q-btn
                ><q-btn
                  v-if="definition.last_job_id"
                  flat
                  round
                  icon="description"
                  aria-label="Log benchmark"
                  @click="openJobLog(definition.last_job_id)"
                  ><q-tooltip>Log del processo</q-tooltip></q-btn
                >
              </div></q-item-section
            >
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
    <q-card flat bordered class="q-mb-md"
      ><q-card-section class="row q-col-gutter-md items-start">
        <q-input
          class="col-12 col-md-4"
          outlined
          dense
          label="Nome del benchmark"
          v-model="label"
        />
        <q-file
          class="col-12 col-md-5"
          outlined
          dense
          accept=".csv,text/csv"
          label="CSV: date, return"
          v-model="file"
          hint="Rendimenti frazionari: 0.01 = +1%; massimo 10 MB. Date uniche e crescenti."
        />
        <div class="col-auto">
          <q-btn
            color="primary"
            label="Importa"
            icon="upload_file"
            :disable="!label || !file"
            :loading="uploading"
            @click="upload"
          />
        </div> </q-card-section
    ></q-card>
    <div class="row items-center q-mb-md">
      <q-input
        class="col"
        outlined
        dense
        label="Cerca benchmark"
        v-model="search"
        clearable
      /><q-toggle v-model="showHidden" label="Mostra archiviati" />
    </div>
    <q-table
      flat
      bordered
      :rows="visibleRows"
      :columns="columns"
      row-key="name"
      :filter="search"
      :loading="loading"
      :pagination="{ rowsPerPage: 25 }"
    >
      <template #body-cell-source="p"
        ><q-td :props="p">{{
          p.row.source_type === "buyhold"
            ? "Buy&Hold lista · giornaliero"
            : p.row.source_type === "run"
              ? "Run · statico"
              : "CSV · statico"
        }}</q-td></template
      >
      <template #body-cell-actions="p"
        ><q-td :props="p"
          ><q-btn
            flat
            dense
            no-caps
            color="primary"
            label="Curva e dati"
            icon="show_chart"
            @click="open(p.row)"
            :disable="!p.row.available"
          /><q-btn
            flat
            dense
            icon="download"
            :href="download(p.row)"
            :disable="!p.row.available"
          /><q-btn flat dense icon="edit" @click="rename(p.row)"
            ><q-tooltip>Rinomina</q-tooltip></q-btn
          ><q-btn
            flat
            dense
            :icon="p.row.hidden ? 'unarchive' : 'archive'"
            @click="update(p.row, { hidden: !p.row.hidden })"
            ><q-tooltip>{{
              p.row.hidden ? "Ripristina" : "Archivia senza eliminare il CSV"
            }}</q-tooltip></q-btn
          ></q-td
        ></template
      >
    </q-table>
    <q-dialog v-model="dialog"
      ><q-card style="width: 1000px; max-width: 95vw"
        ><q-bar
          ><div>{{ selected?.label }}</div>
          <q-space /><q-btn flat dense icon="close" v-close-popup /></q-bar
        ><q-card-section
          ><equity-curve :points="points" />
          <div class="q-mt-md">
            {{ observations }} osservazioni · rendimento cumulato
            {{ totalReturn }}
          </div>
          <div v-if="selected?.source_job_id" class="text-caption text-grey-7">
            Run sorgente: {{ selected.source_job_id }}
          </div></q-card-section
        ></q-card
      ></q-dialog
    >
    <q-dialog v-model="logDialog"
      ><q-card style="width: 1000px; max-width: 95vw"
        ><q-bar
          ><div>Log benchmark</div>
          <q-space /><q-btn
            flat
            round
            dense
            icon="refresh"
            @click="openJobLog(logJobId)" /><q-btn
            flat
            round
            dense
            icon="close"
            v-close-popup /></q-bar
        ><q-card-section>
          <pre
            style="
              white-space: pre-wrap;
              overflow-wrap: anywhere;
              max-height: 70vh;
              overflow: auto;
            "
            >{{ jobLog }}</pre>
        </q-card-section></q-card
      ></q-dialog
    >
  </q-page>
</template>
<script>
import { api } from "boot/axios";
import { constants } from "boot/constants";
import EquityCurve from "../components/EquityCurve.vue";
export default {
  components: { EquityCurve },
  data() {
    return {
      rows: [],
      search: "",
      showHidden: false,
      error: "",
      loading: false,
      uploading: false,
      label: "",
      file: null,
      dialog: false,
      selected: null,
      points: [],
      observations: 0,
      lists: [],
      definitions: [],
      timer: null,
      savingDefinition: false,
      managed: {
        ticker: null,
        provider: "yahoo_adj",
        alpaca_feed: "sip",
        fromdate: "2000-01-01",
        hour: 1,
        minute: 15,
        enabled: true,
      },
      logDialog: false,
      logJobId: null,
      jobLog: "",
      columns: [
        {
          name: "label",
          label: "Benchmark",
          field: "label",
          align: "left",
          sortable: true,
        },
        { name: "name", label: "Identificativo", field: "name", align: "left" },
        { name: "source", label: "Provenienza", align: "left" },
        {
          name: "last_date",
          label: "Dati fino al",
          field: (r) => r.last_date || r.coverage_error || "Non calcolato",
          align: "left",
          sortable: true,
        },
        {
          name: "stale_days",
          label: "Obsolescenza (giorni)",
          field: "stale_days",
          format: (v) => (v == null ? "—" : v),
          align: "right",
          sortable: true,
        },
        {
          name: "updated_at",
          label: "Aggiornamento",
          field: (r) =>
            r.updated_at ? new Date(r.updated_at).toLocaleString("it-IT") : "—",
          align: "left",
        },
        { name: "actions", label: "Azioni", align: "right" },
      ],
    };
  },
  computed: {
    visibleRows() {
      return this.rows.filter((r) => this.showHidden || !r.hidden);
    },
    totalReturn() {
      return this.points.length
        ? `${((this.points[this.points.length - 1].value - 1) * 100).toFixed(2)}%`
        : "—";
    },
  },
  mounted() {
    this.load();
    this.timer = window.setInterval(() => this.load(), 10000);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    async saveDefinition() {
      this.savingDefinition = true;
      try {
        const { data } = await api.post(
          "/dyn/simulations/benchmark-definitions",
          this.managed,
        );
        if (data.enabled)
          await api.post(
            `/dyn/simulations/benchmark-definitions/${data.id}/refresh`,
          );
        await this.load();
        this.$q.notify({
          type: "positive",
          message: data.enabled
            ? "Lista abilitata e calcolo accodato"
            : "Configurazione salvata, aggiornamento disattivato",
        });
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.savingDefinition = false;
      }
    },
    async toggleDefinition(row, enabled) {
      try {
        await api.post("/dyn/simulations/benchmark-definitions", {
          ...row,
          enabled,
        });
        await this.load();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async refreshDefinition(row) {
      try {
        await api.post(
          `/dyn/simulations/benchmark-definitions/${row.id}/refresh`,
        );
        await this.load();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async openJobLog(id) {
      try {
        this.logJobId = id;
        this.jobLog = (
          await api.get(`/dyn/simulations/jobs/${id}/log`)
        ).data.output;
        this.logDialog = true;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    message(e) {
      return e.response?.data?.error || e.message;
    },
    async load() {
      if (this.loading) return;
      this.loading = true;
      try {
        const [rows, definitions, catalog] = await Promise.all([
          api.get("/dyn/simulations/benchmarks"),
          api.get("/dyn/simulations/benchmark-definitions"),
          this.lists.length
            ? Promise.resolve(null)
            : api.get("/dyn/simulations/catalog"),
        ]);
        this.rows = rows.data;
        this.definitions = definitions.data;
        if (catalog) this.lists = catalog.data.ticker_lists;
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.loading = false;
      }
    },
    download(row) {
      return `${constants.API_BASE_URL}/dyn/simulations/benchmarks/${encodeURIComponent(row.name)}/download`;
    },
    async open(row) {
      try {
        const { data } = await api.get(
          "/dyn/simulations/benchmarks/" + encodeURIComponent(row.name),
        );
        this.selected = row;
        this.points = data.points;
        this.observations = data.observations;
        this.dialog = true;
      } catch (e) {
        this.error = this.message(e);
      }
    },
    rename(row) {
      this.$q
        .dialog({
          title: "Nome benchmark",
          prompt: { model: row.label, type: "text" },
          cancel: true,
        })
        .onOk((label) => this.update(row, { label }));
    },
    async update(row, changes) {
      try {
        await api.patch(
          "/dyn/simulations/benchmarks/" + encodeURIComponent(row.name),
          changes,
        );
        await this.load();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async upload() {
      this.uploading = true;
      this.error = "";
      try {
        const data = new FormData();
        data.append("file", this.file);
        data.append("label", this.label);
        await api.post("/dyn/simulations/benchmarks", data);
        this.file = null;
        this.label = "";
        await this.load();
        this.$q.notify({ type: "positive", message: "Benchmark importato" });
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.uploading = false;
      }
    },
  },
};
</script>
