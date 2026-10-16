<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="text-h5">Performance strategie</div>
      <q-space />
      <q-btn
        flat
        icon="refresh"
        label="Aggiorna"
        :loading="loading"
        @click="load"
      />
      <q-btn
        color="primary"
        icon="science"
        label="Nuovo backtest"
        to="/ExecuteStrategy"
      />
    </div>
    <div class="text-grey-7 q-mb-md">
      Una scheda per ogni run completato: nessun risultato sostituisce i
      precedenti. Preferiti in alto; cestino reversibile. Ultimi 200 job più i
      preferiti.
    </div>
    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{
      error
    }}</q-banner>
    <div class="row items-center q-gutter-md q-mb-md">
      <q-input
        v-model="search"
        outlined
        dense
        clearable
        label="Cerca strategia o nome del run"
        style="width: 450px; max-width: 100%"
        ><template #prepend><q-icon name="search" /></template></q-input
      ><q-toggle v-model="showTrash" label="Cestino" />
    </div>
    <div v-if="active" class="text-primary q-mb-md">
      {{ active }} simulazioni in coda o in esecuzione ·
      <router-link to="/ExecuteStrategy">Apri Backtesting</router-link>
    </div>
    <div v-if="!cards.length && !loading" class="text-grey-7">
      Nessun risultato completato per questa selezione. Avvia un backtest per
      popolare le card.
    </div>
    <div class="row q-col-gutter-md">
      <div
        v-for="run in cards"
        :key="run.id"
        class="col-12 col-sm-6 col-lg-4 col-xl-3"
      >
        <q-card flat bordered class="full-height">
          <q-card-section class="bg-grey-1">
            <div class="row no-wrap items-start">
              <div
                class="col text-subtitle1 text-weight-bold"
                style="overflow-wrap: anywhere"
              >
                {{
                  run.archive?.label ||
                  config(run).label ||
                  config(run).strategy
                }}
              </div>
              <q-btn
                flat
                round
                dense
                :icon="run.archive?.pinned ? pinFilled : pinOutlined"
                :color="run.archive?.pinned ? 'primary' : 'grey'"
                :aria-label="
                  run.archive?.pinned ? 'Rimuovi pin' : 'Fissa in alto'
                "
                @click="update(run, { pinned: !run.archive?.pinned })"
                ><q-tooltip>{{
                  run.archive?.pinned ? "Rimuovi pin" : "Fissa in alto"
                }}</q-tooltip></q-btn
              >
              <q-btn
                flat
                round
                dense
                :icon="
                  run.archive?.hidden ? 'restore_from_trash' : 'delete_outline'
                "
                :aria-label="
                  run.archive?.hidden ? 'Ripristina run' : 'Sposta nel cestino'
                "
                @click="trash(run)"
                ><q-tooltip>{{
                  run.archive?.hidden ? "Ripristina run" : "Sposta nel cestino"
                }}</q-tooltip></q-btn
              >
            </div>
            <div class="text-caption text-grey-7">
              {{ config(run).strategy }} · {{ run.id.slice(0, 8) }}
            </div>
            <div class="text-caption q-mt-xs">
              <q-icon name="date_range" /> {{ config(run).fromdate }} →
              {{ config(run).todate }}
            </div>
          </q-card-section>
          <q-card-section>
            <div class="text-caption text-grey-7">
              Rendimento composto del periodo
            </div>
            <div
              class="text-h4"
              :class="tone(run.result?.performance?.total_return_pct)"
            >
              {{ percent(run.result?.performance?.total_return_pct) }}
            </div>
            <div class="row q-mt-md q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7">Drawdown massimo</div>
                <div class="text-h6 text-negative">
                  {{ percent(run.result?.performance?.max_drawdown_pct) }}
                </div>
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-7">Trade chiusi</div>
                <div class="text-h6">
                  {{ run.result?.performance?.trades ?? "—" }}
                </div>
              </div>
            </div>
            <div class="row q-mt-sm q-col-gutter-sm">
              <div class="col-6">
                <div class="text-caption text-grey-7">Capitale iniziale</div>
                {{ number(run.result?.performance?.initial_equity) }}
              </div>
              <div class="col-6">
                <div class="text-caption text-grey-7">Capitale finale</div>
                {{ number(run.result?.performance?.final_equity) }}
              </div>
            </div>
            <div class="text-caption text-grey-7 q-mt-md">
              {{ config(run).provider }} · {{ config(run).timeframe }} · leva
              broker {{ config(run).broker?.margin_leverage ?? "—" }}×
            </div>
            <div class="text-caption text-grey-7">
              {{ config(run).ticker }} ·
              {{ run.result?.performance?.sessions ?? "—" }} sessioni
            </div>
            <div class="text-caption text-grey-7">
              Eseguito: {{ date(run.finished_at || run.created_at) }}
            </div>
          </q-card-section>
          <q-separator />
          <q-card-actions>
            <q-btn
              flat
              color="primary"
              icon="insights"
              label="Risultati e parametri"
              :to="{ path: '/ExecuteStrategy', query: { run: run.id } }"
            />
            <q-btn
              v-if="run.result?.artifacts?.includes('stats.html')"
              flat
              color="secondary"
              icon="description"
              label="Stats"
              :href="report(run)"
              target="_blank"
              rel="noopener"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
<script>
import { api } from "boot/axios";
import { constants } from "boot/constants";
import { matPushPin } from "@quasar/extras/material-icons";
import { outlinedPushPin } from "@quasar/extras/material-icons-outlined";
export default {
  data() {
    return {
      pinFilled: matPushPin,
      pinOutlined: outlinedPushPin,
      jobs: [],
      search: "",
      showTrash: false,
      loading: false,
      error: "",
      timer: null,
    };
  },
  computed: {
    active() {
      return this.jobs.filter(
        (r) =>
          r.kind === "simulation" && ["queued", "running"].includes(r.status),
      ).length;
    },
    cards() {
      const query = (this.search || "").toLowerCase();
      return this.jobs
        .filter(
          (r) =>
            r.kind === "simulation" &&
            r.status === "completed" &&
            Boolean(r.archive?.hidden) === this.showTrash,
        )
        .filter((r) =>
          [
            this.config(r).strategy,
            r.archive?.label,
            this.config(r).label,
            r.id,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.archive?.pinned)) -
              Number(Boolean(a.archive?.pinned)) ||
            String(b.created_at).localeCompare(String(a.created_at)),
        );
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
    trash(run) {
      if (run.archive?.hidden) return this.update(run, { hidden: false });
      this.$q
        .dialog({
          title: "Sposta nel cestino",
          message:
            "Il run scompare dalla dashboard ma risultati e report restano recuperabili dal Cestino.",
          cancel: true,
        })
        .onOk(() => this.update(run, { hidden: true }));
    },
    async update(run, patch) {
      try {
        await api.patch(
          `/dyn/simulations/jobs/${encodeURIComponent(run.id)}`,
          patch,
        );
        await this.load();
      } catch (e) {
        this.error = e.response?.data?.error || e.message;
      }
    },
    config(run) {
      return run.request_snapshot?.configuration || {};
    },
    percent(value) {
      return value == null ? "—" : `${Number(value).toFixed(2)}%`;
    },
    number(value) {
      return value == null
        ? "—"
        : Number(value).toLocaleString("it-IT", { maximumFractionDigits: 2 });
    },
    tone(value) {
      return value == null
        ? "text-grey"
        : Number(value) < 0
          ? "text-negative"
          : "text-positive";
    },
    date(value) {
      return value ? new Date(value).toLocaleString("it-IT") : "—";
    },
    report(run) {
      return `${constants.API_BASE_URL}/dyn/simulations/jobs/${encodeURIComponent(run.id)}/artifacts/stats.html`;
    },
    async load() {
      if (this.loading) return;
      this.loading = true;
      try {
        this.jobs = (await api.get("/dyn/simulations/jobs")).data;
        this.error = "";
      } catch (e) {
        this.error = e.response?.data?.error || e.message;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
