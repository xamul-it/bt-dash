<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h5">Archivio benchmark</div>
        <div class="text-grey-7">
          Rendimenti storici riutilizzabili nei backtest. Salva un run come
          benchmark oppure importa un CSV.
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
          p.row.source_job_id ? "Salvato da simulazione" : "Archivio CSV"
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
          /><q-btn flat dense icon="download" :href="download(p.row)" /><q-btn
            flat
            dense
            icon="edit"
            @click="rename(p.row)"
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
          name: "updated_at",
          label: "Aggiornamento",
          field: (r) => new Date(r.updated_at).toLocaleString("it-IT"),
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
  },
  methods: {
    message(e) {
      return e.response?.data?.error || e.message;
    },
    async load() {
      this.loading = true;
      try {
        this.rows = (await api.get("/dyn/simulations/benchmarks")).data;
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
