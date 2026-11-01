<template>
  <div :class="embedded ? '' : 'q-pa-md'">
    <div class="row items-center q-gutter-sm q-mb-md">
      <q-btn v-if="historyGroupKey" flat round icon="arrow_back" aria-label="Torna alla dashboard" @click="closeHistory" />
      <div>
        <div :class="embedded ? 'text-h6' : 'text-h5'">{{ historyGroupKey ? `Storico — ${historyTitle}` : "Laboratorio schedulato" }}</div>
        <div v-if="historyGroupKey" class="text-caption text-grey-7">Ultime 200 esecuzioni della schedulazione, dalla più recente, e run di origine.</div>
      </div>
      <q-space />
      <q-btn v-if="embedded" flat round color="primary" icon="list" aria-label="Vedi tutti i backtest schedulati" to="/Laboratory/Schedules"><q-tooltip>Vedi tutti</q-tooltip></q-btn>
      <q-btn flat :round="embedded" icon="refresh" :label="embedded ? undefined : 'Aggiorna'" aria-label="Aggiorna" :loading="loading" @click="load" />
      <q-btn v-if="historyGroupKey" flat icon="close" label="Chiudi storico" @click="closeHistory" />
      <q-btn v-if="!embedded" color="primary" icon="science" label="Apri laboratorio" to="/ExecuteStrategy" />
    </div>

    <div v-if="!historyGroupKey && !embedded" class="text-grey-7 q-mb-md">Una scheda per schedulazione, con l’ultima esecuzione e lo storico nel dettaglio.</div>
    <q-banner v-if="error" class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>

    <div v-if="!historyGroupKey && !embedded" class="row items-center q-gutter-md q-mb-md">
      <q-input v-model="search" outlined dense clearable label="Cerca strategia o nome del run"
        style="width: 450px; max-width: 100%">
        <template #prepend><q-icon name="search" /></template>
      </q-input>

    </div>

    <div v-if="active && !embedded" class="text-primary q-mb-md">
      {{ active }} simulazioni in coda o in esecuzione ·
      <router-link to="/ExecuteStrategy">Apri Backtesting</router-link>
    </div>
    <div v-if="!cards.length && !loading" class="text-grey-7">
      Nessuna schedulazione per questa selezione. Aggiungi un preferito dalla pagina Backtest schedulati.
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="run in cards" :key="run.id" :class="embedded ? 'col-12' : 'col-12 col-sm-6 col-lg-4 col-xl-3'">
        <div class="run-card-shell" :class="{ 'run-card-shell--stacked': !historyGroupKey && historyCount(run) > 1 }">
          <q-card flat bordered class="full-height run-card">
            <q-card-section class="bg-grey-1">
              <div class="row no-wrap items-start">
                <div class="col text-subtitle1 text-weight-bold" style="overflow-wrap: anywhere">
                  {{ runTitle(run) }}
                </div>
                <DashboardFavorite kind="schedule" :id="scheduleForRun(run)?.id || ''" />
              </div>
              <div class="row items-center q-gutter-xs">
                <div class="text-caption text-grey-7">{{ config(run).strategy }} · {{ run.id.slice(0, 8) }}</div>
                <q-badge v-if="scheduleForRun(run)" outline
                  :color="scheduleForRun(run).enabled ? 'positive' : 'orange-8'">
                  {{ scheduleForRun(run).enabled ? "Schedulato" : "In pausa" }}
                </q-badge>
              </div>
              <div class="text-caption q-mt-xs">Ultimo esito: <b>{{ run.status }}</b></div>
              <div v-if="run.error || scheduleForRun(run)?.last_error" class="text-negative text-caption">{{ run.error || scheduleForRun(run)?.last_error }}</div>
              <div class="text-caption">Prossimo avvio: {{ date(scheduleForRun(run)?.next_run_at) }}</div>
              <div class="text-caption q-mt-xs">
                <q-icon name="date_range" /> {{ config(run).fromdate }} → {{ config(run).todate }}
              </div>
            </q-card-section>

            <q-card-section>
              <div class="text-caption text-grey-7">Rendimento composto del periodo</div>
              <div class="text-h4" :class="tone(run.result?.performance?.total_return_pct)">
                {{ percent(run.result?.performance?.total_return_pct) }}
              </div>
              <div class="row q-mt-md q-col-gutter-sm">
                <div class="col-6">
                  <div class="text-caption text-grey-7">Drawdown massimo</div>
                  <div class="text-h6 text-negative">{{ percent(run.result?.performance?.max_drawdown_pct) }}</div>
                </div>
                <div class="col-6">
                  <div class="text-caption text-grey-7">Trade chiusi</div>
                  <div class="text-h6">{{ run.result?.performance?.trades ?? "—" }}</div>
                </div>
              </div>
              <div class="row q-mt-sm q-col-gutter-sm">
                <div class="col-6"><div class="text-caption text-grey-7">Capitale iniziale</div>{{ number(run.result?.performance?.initial_equity) }}</div>
                <div class="col-6"><div class="text-caption text-grey-7">Capitale finale</div>{{ number(run.result?.performance?.final_equity) }}</div>
              </div>
              <div class="text-caption text-grey-7 q-mt-md">
                {{ config(run).provider }} · {{ config(run).timeframe }} · leva broker {{ config(run).broker?.margin_leverage ?? "—" }}×
              </div>
              <div class="text-caption text-grey-7">
                {{ config(run).ticker }} · {{ run.result?.performance?.sessions ?? "—" }} sessioni
              </div>
              <div class="text-caption text-grey-7">Eseguito: {{ date(run.finished_at || run.created_at) }}</div>
            </q-card-section>

            <q-separator />
            <q-card-actions>
              <q-btn v-if="!run.placeholder" flat color="primary" icon="insights" label="Risultati e parametri"
                :to="{ path: '/ExecuteStrategy', query: { run: run.id } }" />
              <q-btn v-if="run.result?.artifacts?.includes('stats.html')" flat color="secondary"
                icon="description" label="Stats" :href="report(run)" target="_blank" rel="noopener" />
              <q-btn flat color="primary" icon="schedule" label="Schedula" @click="openSchedule(run)" />
              <q-btn v-if="!historyGroupKey && historyCount(run) > 1" flat color="primary" icon="layers"
                :label="`Storico (${historyCount(run)})`" @click="openHistory(run)" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>

    <q-dialog v-model="scheduleDialog" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="row items-start">
          <div>
            <div class="text-h6">Schedulazione — {{ scheduleRun ? runTitle(scheduleRun) : "" }}</div>
            <div class="text-caption text-grey-7">
              Ogni esecuzione mantiene la data iniziale e imposta la data finale al giorno corrente.
              Il nuovo risultato diventa la card principale; i precedenti restano nello storico.
            </div>
          </div>
          <q-space />
          <q-badge v-if="scheduleRow" :color="scheduleRow.enabled ? 'positive' : 'orange-8'">
            {{ scheduleRow.enabled ? "Attiva" : "In pausa" }}
          </q-badge>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-input v-model="scheduleTime" type="time" outlined dense label="Ora giornaliera · Europe/Rome"
            :rules="[value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || 'Ora non valida']" />
          <q-toggle v-model="scheduleEnabled" label="Pianificazione attiva" />
          <div class="text-body2 q-mt-md">
            Periodo: <b>{{ config(scheduleRun).fromdate }}</b> → <b>oggi</b>
          </div>
          <template v-if="scheduleRow">
            <div class="text-caption text-grey-7 q-mt-sm">Prossima esecuzione: {{ date(scheduleRow.next_run_at) }}</div>
            <div class="text-caption text-grey-7">Ultimo avvio: {{ date(scheduleRow.last_triggered_at) }}</div>
            <div v-if="scheduleRow.last_error" class="text-caption text-negative q-mt-xs">{{ scheduleRow.last_error }}</div>
          </template>
        </q-card-section>
        <q-card-actions align="between">
          <q-btn v-if="scheduleRow" flat color="negative" icon="delete" label="Rimuovi"
            :loading="scheduleSaving" @click="removeSchedule" />
          <q-space v-else />
          <div>
            <q-btn flat label="Annulla" :disable="scheduleSaving" v-close-popup />
            <q-btn color="primary" icon="save" label="Salva" :loading="scheduleSaving" @click="saveSchedule" />
          </div>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import { api } from "boot/axios";
import { constants } from "boot/constants";
import DashboardFavorite from '../components/DashboardFavorite.vue';
import { loadDashboardFavorites, isDashboardFavorite } from '../utils/dashboardFavorites';
import { scheduleForRun, newestRuns } from '../utils/scheduledRuns.mjs';

export default {
  components: { DashboardFavorite },
  props: { embedded: Boolean, favoritesOnly: Boolean },
  data() {
    return {

      jobs: [],
      schedules: [],
      search: "",
      showTrash: false,
      loading: false,
      error: "",
      timer: null,
      historyGroupKey: "",
      historyTitle: "",
      scheduleDialog: false,
      scheduleRun: null,
      scheduleRow: null,
      scheduleTime: "20:00",
      scheduleEnabled: true,
      scheduleSaving: false,
    };
  },
  computed: {
    active() {
      return this.jobs.filter((run) => run.kind === "simulation" && ["queued", "running"].includes(run.status)).length;
    },
    visibleRuns() {
      return newestRuns(this.jobs.filter(run => run.kind === 'simulation' && !run.archive?.deleted_at));
    },
    runGroups() {
      const query = (this.search || '').toLowerCase();
      return this.schedules.filter(row => !this.favoritesOnly || isDashboardFavorite('schedule', row.id))
        .filter(row => [row.label, row.configuration?.strategy].join(' ').toLowerCase().includes(query))
        .map(row => {
          const runs = this.visibleRuns.filter(run => this.scheduleForRun(run)?.id === row.id);
          return { key: row.id, title: row.label, runs: runs.length ? runs : [{
            id: row.id, placeholder: true, status: 'In attesa della prima esecuzione',
            request_snapshot: { schedule_id: row.id, configuration: row.configuration },
          }] };
        });
    },
    cards() {
      if (this.historyGroupKey) return this.runGroups.find(group => group.key === this.historyGroupKey)?.runs || [];
      return this.runGroups.map(group => group.runs[0]);
    },
  },
  mounted() {
    this.historyGroupKey = String(this.$route.query.history || "");
    this.load();
    this.timer = window.setInterval(() => this.load(), 10000);
  },
  beforeUnmount() {
    window.clearInterval(this.timer);
  },
  methods: {
    config(run) {
      return run?.request_snapshot?.configuration || {};
    },
    runTitle(run) {
      return String(this.scheduleForRun(run)?.label || run?.archive?.label || this.config(run).label || this.config(run).strategy || "Run senza titolo");
    },
    groupKey(run) {
      return this.scheduleForRun(run)?.id || run.id;
    },
    historyCount(run) {
      return this.runGroups.find((group) => group.key === this.groupKey(run))?.runs.length || 1;
    },
    openHistory(run) {
      this.historyGroupKey = this.groupKey(run);
      this.load();
      this.historyTitle = this.runTitle(run);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    closeHistory() {
      this.historyGroupKey = "";
      this.historyTitle = "";
      this.load();
    },
    scheduleForRun(run) {
      return scheduleForRun(run, this.schedules);
    },
    openSchedule(run) {
      const row = this.scheduleForRun(run);
      this.scheduleRun = run;
      this.scheduleRow = row;
      this.scheduleTime = row ? `${String(row.hour).padStart(2, "0")}:${String(row.minute).padStart(2, "0")}` : "20:00";
      this.scheduleEnabled = row?.enabled !== false;
      this.scheduleDialog = true;
    },
    async saveSchedule() {
      if (!this.scheduleRun || !/^([01]\d|2[0-3]):[0-5]\d$/.test(this.scheduleTime)) return;
      this.scheduleSaving = true;
      try {
        const [hour, minute] = this.scheduleTime.split(":").map(Number);
        if (this.scheduleRow) {
          await api.patch(`/dyn/simulations/schedules/${encodeURIComponent(this.scheduleRow.id)}`, {
            hour, minute, enabled: this.scheduleEnabled, label: this.runTitle(this.scheduleRun),
          });
        } else {
          await api.post("/dyn/simulations/schedules", {
            configuration: { ...this.config(this.scheduleRun), label: this.runTitle(this.scheduleRun) },
            source_job_id: this.scheduleRun.id,
            label: this.runTitle(this.scheduleRun),
            hour, minute, enabled: this.scheduleEnabled,
          });
        }
        this.scheduleDialog = false;
        await this.load();
        this.$q.notify({ type: "positive", message: "Schedulazione salvata" });
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
      } finally {
        this.scheduleSaving = false;
      }
    },
    async removeSchedule() {
      if (!this.scheduleRow) return;
      this.$q.dialog({
        title: "Rimuovi schedulazione",
        message: "I run già prodotti restano nello storico. Vuoi rimuovere soltanto la pianificazione?",
        cancel: true,
      }).onOk(async () => {
        this.scheduleSaving = true;
        try {
          await api.delete(`/dyn/simulations/schedules/${encodeURIComponent(this.scheduleRow.id)}`);
          this.scheduleDialog = false;
          await this.load();
          this.$q.notify({ type: "positive", message: "Schedulazione rimossa" });
        } catch (error) {
          this.error = error.response?.data?.error || error.message;
        } finally {
          this.scheduleSaving = false;
        }
      });
    },
    percent(value) {
      return value == null ? "—" : `${Number(value).toFixed(2)}%`;
    },
    number(value) {
      return value == null ? "—" : Number(value).toLocaleString("it-IT", { maximumFractionDigits: 2 });
    },
    tone(value) {
      return value == null ? "text-grey" : Number(value) < 0 ? "text-negative" : "text-positive";
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
        const [jobs, schedules] = await Promise.all([
          api.get("/dyn/simulations/jobs", { params: this.historyGroupKey ? { schedule_id: this.historyGroupKey } : {} }),
          api.get("/dyn/simulations/schedules"),
          loadDashboardFavorites(true),
        ]);
        this.jobs = jobs.data;
        this.schedules = schedules.data;
        if (this.historyGroupKey) this.historyTitle = this.schedules.find(row => row.id === this.historyGroupKey)?.label || "";
        if (this.historyGroupKey && !this.runGroups.some((group) => group.key === this.historyGroupKey)) this.closeHistory();
        this.error = "";
      } catch (error) {
        this.error = error.response?.data?.error || error.message;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.run-card-shell {
  position: relative;
  height: 100%;
}
.run-card-shell--stacked {
  margin: 0 8px 10px 0;
}
.run-card-shell--stacked::before,
.run-card-shell--stacked::after {
  content: "";
  position: absolute;
  inset: 7px -7px -7px 7px;
  border: 1px solid #d7d7d7;
  border-radius: 4px;
  background: white;
}
.run-card-shell--stacked::before {
  inset: 4px -4px -4px 4px;
  z-index: 1;
}
.run-card-shell--stacked::after {
  z-index: 0;
}
.run-card {
  position: relative;
  z-index: 2;
}
</style>
