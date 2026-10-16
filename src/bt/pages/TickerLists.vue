<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-gutter-sm q-mb-md">
      <div class="col"><div class="text-h5">Liste ticker</div>
        <div class="text-grey-7">Organizza i simboli, il download giornaliero e i benchmark.</div></div>
      <q-btn color="primary" icon="add" label="Nuova lista" @click="edit()" />
      <q-btn flat icon="refresh" aria-label="Aggiorna elenco" :loading="loading" @click="load" />
    </div>
    <q-banner v-if="error" rounded class="bg-red-1 text-negative q-mb-md">{{ error }}</q-banner>
    <q-banner rounded class="bg-blue-1 q-mb-md">
      Il batch scarica una sola volta i simboli condivisi dalle liste allo stesso orario, per sorgente.
      L'ultimo download completato indica l'elaborazione della lista; i singoli ticker possono avere dati più recenti grazie ad altre liste.
    </q-banner>
    <div class="row q-col-gutter-md q-mb-md items-center">
      <q-input class="col-12 col-md-4" outlined dense clearable label="Cerca lista" v-model="search" />
      <q-input class="col-12 col-md-4" outlined dense clearable label="Simbolo esatto presente nelle liste" v-model="symbol" debounce="300" @update:model-value="load" />
      <q-toggle class="col-auto" label="Archiviate" v-model="archived" @update:model-value="load" />
    </div>
    <q-table flat bordered :rows="rows" :columns="archived ? archivedColumns : columns" row-key="ticker"
      :filter="search" :loading="loading" :pagination="{ rowsPerPage: 25, sortBy: 'label' }" no-data-label="Nessuna lista trovata">
      <template #body-cell-label="p"><q-td :props="p">
        <q-btn v-if="!archived" flat no-caps color="primary" :label="p.row.label" @click="open(p.row)" />
        <span v-else>{{ p.row.label }}</span>
        <div class="text-caption text-grey-7">{{ p.row.ticker }}</div>
        <div v-if="p.row.error" class="text-negative">{{ p.row.error }}</div>
      </q-td></template>
      <template #body-cell-sources="p"><q-td :props="p">
        <div v-for="s in p.row.sources" :key="s.provider + s.alpaca_feed">{{ sourceLabel(s) }}</div>
        <span v-if="!p.row.sources.length" class="text-grey-6">Da configurare</span>
      </q-td></template>
      <template #body-cell-download="p"><q-td :props="p"><q-toggle :model-value="p.row.download_enabled"
        :disable="busy || !!p.row.error" :aria-label="'Download giornaliero ' + p.row.label"
        @update:model-value="v => toggle(p.row, 'download_enabled', v)" /></q-td></template>
      <template #body-cell-benchmark="p"><q-td :props="p"><q-toggle :model-value="p.row.benchmark_enabled"
        :disable="busy || !!p.row.error" :aria-label="'Benchmark ' + p.row.label"
        @update:model-value="v => toggle(p.row, 'benchmark_enabled', v)" /></q-td></template>
      <template #body-cell-status="p"><q-td :props="p">
        <q-badge :color="statusColor(p.row)">{{ statusLabel(p.row) }}</q-badge>
        <div v-if="p.row.last_batch?.finished_at" class="text-caption">Ultimo batch: {{ date(p.row.last_batch.finished_at) }}</div>
        <div v-for="s in p.row.last_batch?.sources || []" :key="s.provider + s.alpaca_feed" class="text-caption">
          <span v-if="s.error || s.failed_symbols?.length" class="text-negative">{{ sourceLabel(s) }}: {{ s.error || 'Download incompleto' }}
            {{ s.failed_symbols?.length ? ' · ' + s.failed_symbols.join(', ') : '' }}</span>
        </div>
        <div v-if="p.row.job?.error && p.row.last_batch?.job_id !== p.row.job.id" class="text-negative text-caption">{{ p.row.job.error }}</div>
      </q-td></template>
      <template #body-cell-actions="p"><q-td :props="p" class="text-no-wrap">
        <template v-if="!archived">
          <q-btn flat round icon="edit" aria-label="Modifica lista" @click="edit(p.row)" />
          <q-btn flat round icon="cloud_download" aria-label="Esegui batch ora" :disable="busy || !p.row.download_enabled || ['queued','running'].includes(p.row.job?.status)" @click="refresh(p.row)"><q-tooltip>Scarica e calcola i benchmark abilitati</q-tooltip></q-btn>
          <q-btn v-if="p.row.job" flat round icon="description" aria-label="Log del batch" @click="openLog(p.row)" />
          <q-btn flat round icon="archive" aria-label="Archivia lista" :disable="busy" @click="archive(p.row)" />
        </template>
        <q-btn v-else flat icon="restore" label="Ripristina" :disable="busy" @click="restore(p.row)" />
      </q-td></template>
    </q-table>
    <q-dialog v-model="dialog" persistent><q-card style="width: 680px; max-width: 95vw">
      <q-card-section class="text-h6">{{ creating ? 'Nuova lista' : 'Modifica lista' }}</q-card-section>
      <q-card-section class="q-gutter-md">
        <q-input outlined dense label="Identificativo file" v-model="form.ticker" :disable="!creating" hint="Ad esempio: tecnologia.json" />
        <q-input outlined dense label="Nome lista" v-model="form.label" />
        <q-file outlined dense v-model="file" accept=".csv,.txt,.json" :label="creating ? 'Carica simboli (obbligatorio)' : 'Sostituisci simboli (facoltativo)'" hint="CSV con colonna symbol/ticker, TXT con un simbolo per riga o elenco JSON. Massimo 1 MB." />
        <q-select outlined dense multiple v-model="form.providers" :options="['yahoo','yahoo_adj','alpaca']" label="Sorgenti" hint="Yahoo e Yahoo Adj condividono il download; mantengono serie dati distinte." />
        <q-select v-if="form.providers.includes('alpaca')" outlined dense v-model="form.alpaca_feed" :options="['sip','iex']" label="Feed Alpaca" />
        <q-toggle v-model="form.download_enabled" label="Download giornaliero" @update:model-value="v => { if (!v) form.benchmark_enabled = false; }" />
        <q-toggle v-model="form.benchmark_enabled" label="Calcola benchmark dopo il download" @update:model-value="v => { if (v) form.download_enabled = true; }" />
        <div class="row q-col-gutter-sm">
          <q-input class="col-6" outlined dense type="date" stack-label label="Storico da" v-model="form.fromdate" />
          <q-input class="col-3" outlined dense type="number" label="Ora" v-model.number="form.hour" min="0" max="23" />
          <q-input class="col-3" outlined dense type="number" label="Minuti" v-model.number="form.minute" min="0" max="59" />
        </div>
        <div class="text-caption text-grey-7">Orario Europe/Rome. Salvare la configurazione programma il prossimo batch; puoi anche avviarlo dall'elenco.</div>
        <q-banner v-if="dialogError" class="bg-red-1 text-negative">{{ dialogError }}</q-banner>
      </q-card-section>
      <q-card-actions align="right"><q-btn flat label="Annulla" :disable="busy" v-close-popup /><q-btn color="primary" label="Salva" :loading="busy" @click="save" /></q-card-actions>
    </q-card></q-dialog>
    <q-dialog v-model="logDialog"><q-card style="width: 950px; max-width: 95vw"><q-bar>Log batch<q-space /><q-btn flat dense icon="close" v-close-popup /></q-bar>
      <q-card-section><pre style="white-space: pre-wrap; overflow: auto; max-height: 70vh">{{ log }}</pre></q-card-section>
    </q-card></q-dialog>
    <q-dialog v-model="archiveDialog"><q-card><q-card-section class="text-h6">Archivia {{ selected?.label }}?</q-card-section>
      <q-card-section>La lista sarà rimossa dalle selezioni e dalle schedulazioni. I dati scaricati vengono conservati. Puoi ripristinarla dall'elenco Archiviate.</q-card-section>
      <q-card-actions align="right"><q-btn flat label="Annulla" v-close-popup /><q-btn color="primary" label="Archivia" :loading="busy" @click="confirmArchive" /></q-card-actions>
    </q-card></q-dialog>
  </q-page>
</template>

<script>
import { api } from 'boot/axios';
const columns = [
  { name: 'label', label: 'Lista', field: 'label', align: 'left', sortable: true },
  { name: 'count', label: 'Simboli', field: 'count', sortable: true },
  { name: 'sources', label: 'Sorgenti', align: 'left' },
  { name: 'download', label: 'Download giornaliero', align: 'center' },
  { name: 'benchmark', label: 'Benchmark', align: 'center' },
  { name: 'last_success_at', label: 'Ultimo download completato', field: 'last_success_at', align: 'left', sortable: true, format: v => v ? new Date(v).toLocaleString('it-IT') : 'Mai registrato' },
  { name: 'status', label: 'Esito', align: 'left' },
  { name: 'actions', label: 'Azioni', align: 'right' },
];
export default {
  data() { return { rows: [], search: '', symbol: '', archived: false, columns,
    archivedColumns: [columns[0], columns[7]], loading: false, busy: false, error: '',
    dialog: false, creating: false, form: {}, file: null, dialogError: '', timer: null,
    archiveDialog: false, selected: null, logDialog: false, log: '' }; },
  mounted() { this.load(); this.timer = window.setInterval(() => { if (!this.loading && !this.dialog) this.load(); }, 10000); },
  beforeUnmount() { window.clearInterval(this.timer); },
  methods: {
    message(e) { return e.response?.data?.error || e.message; },
    date(v) { return v ? new Date(v).toLocaleString('it-IT') : '—'; },
    sourceLabel(s) { return s.provider + (s.provider === 'alpaca' ? ' / ' + s.alpaca_feed.toUpperCase() : ''); },
    statusLabel(r) { const active = ['queued','running'].includes(r.job?.status);
      const ownResult = r.last_batch?.job_id === r.job?.id && ['completed','partial'].includes(r.last_batch?.status);
      const status = active ? r.job.status : ownResult ? r.last_batch.status : r.job?.status === 'failed' ? 'failed' : r.last_batch?.status;
      return ({ queued: 'In coda', running: 'In corso', completed: 'Completato', partial: 'Parziale', failed: 'Errore' })[status] || 'Mai eseguito'; },
    statusColor(r) { const s = this.statusLabel(r); return s === 'Completato' ? 'positive' : ['Errore','Parziale'].includes(s) ? 'negative' : 'grey-7'; },
    async load() { this.loading = true; try { this.rows = (await api.get('/dyn/simulations/ticker-lists', { params: { symbol: this.symbol || '', archived: this.archived ? '1' : '0' } })).data; this.error = ''; }
      catch (e) { this.error = this.message(e); } finally { this.loading = false; } },
    configuration(row) { const sources = row?.sources || []; const first = sources[0] || {};
      return { ticker: row?.ticker || '', label: row?.label || '', providers: [...new Set(sources.map(s => s.provider))].length ? [...new Set(sources.map(s => s.provider))] : ['yahoo_adj'],
        alpaca_feed: sources.find(s => s.provider === 'alpaca')?.alpaca_feed || 'sip',
        download_enabled: !!row?.download_enabled, benchmark_enabled: !!row?.benchmark_enabled,
        fromdate: first.fromdate || row?.fromdate || '2000-01-01', hour: first.hour ?? row?.hour ?? 1, minute: first.minute ?? row?.minute ?? 15 }; },
    edit(row) { this.creating = !row; this.form = this.configuration(row); this.file = null; this.dialogError = ''; this.dialog = true; },
    async save() { this.busy = true; this.dialogError = ''; try {
      if (this.creating && !this.file) throw new Error('Carica un file con i simboli');
      const configuration = { ...this.form, create: this.creating };
      if (this.file) { const body = new FormData(); body.append('configuration', JSON.stringify(configuration)); body.append('file', this.file); await api.post('/dyn/simulations/ticker-lists', body); }
      else await api.post('/dyn/simulations/ticker-lists', configuration);
      this.dialog = false; await this.load();
    } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; } },
    async toggle(row, key, value) { const payload = this.configuration(row); payload[key] = value;
      if (key === 'benchmark_enabled' && value) payload.download_enabled = true;
      if (key === 'download_enabled' && !value) payload.benchmark_enabled = false;
      this.busy = true; try { await api.post('/dyn/simulations/ticker-lists', payload); await this.load(); }
      catch(e) { this.error = this.message(e); } finally { this.busy = false; } },
    open(row) { const source = row.sources[0] || { provider: 'yahoo_adj', alpaca_feed: 'sip' };
      this.$router.push({ path: '/Configure', query: { ticker: row.ticker, provider: source.provider, feed: source.alpaca_feed } }); },
    async refresh(row) { this.busy = true; try { await api.post('/dyn/simulations/ticker-lists/refresh', { ticker: row.ticker }); await this.load(); }
      catch(e) { this.error = this.message(e); } finally { this.busy = false; } },
    async openLog(row) { try { this.log = (await api.get('/dyn/simulations/jobs/' + row.job.id + '/log')).data.output; this.logDialog = true; }
      catch(e) { this.error = this.message(e); } },
    archive(row) { this.selected = row; this.archiveDialog = true; },
    async confirmArchive() { this.busy = true; try { await api.post('/dyn/simulations/ticker-lists/' + encodeURIComponent(this.selected.ticker) + '/archive'); this.archiveDialog = false; await this.load(); }
      catch(e) { this.error = this.message(e); } finally { this.busy = false; } },
    async restore(row) { this.busy = true; try { await api.post('/dyn/simulations/ticker-lists/' + encodeURIComponent(row.ticker) + '/restore'); await this.load(); }
      catch(e) { this.error = this.message(e); } finally { this.busy = false; } },
  },
};
</script>
