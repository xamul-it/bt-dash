<template>
  <q-page class="q-pa-md studio-page">
    <div class="studio-navigation">
    <div class="row items-center q-mb-md q-col-gutter-sm">
      <div class="col">
        <div class="text-h5">Laboratorio Backtesting</div>
        <div class="text-grey-7">
          Configura, simula e confronta. Tutte le esecuzioni utilizzano
          BackBroker su dati storici.
        </div>
      </div>
      <div class="col-auto">
        <q-btn color="primary" icon="add" label="Nuovo run" @click="newRun" />
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
    }}<template #action><q-btn flat label="Chiudi" @click="error = ''" /></template></q-banner>
    <q-tabs
      v-model="tab"
      align="left"
      active-color="primary"
      class="bg-white rounded-borders q-mb-md"
    >
      <q-tab name="runs" label="Risultati e archivio" icon="analytics" />
    </q-tabs>
    </div>
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
                class="col-12 col-md-6"
                outlined
                dense
                label="Benchmark"
                hint="Opzionale. Lascia vuoto per eseguire senza benchmark."
                clearable
                v-model="form.benchmark"
                :options="benchmarkOptions"
                :loading="loadingBenchmarks"
                @filter="loadBenchmarkOptions"
                emit-value
                map-options
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
              default-opened
              class="q-mt-md"
            >
              <MarkdownNotes class="q-pa-md" :text="schema.description" />
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
            <q-toggle
              v-model="showUnusedParameters"
              label="Mostra parametri unused"
              dense
              class="q-mb-md"
            />
            <div v-if="schemaLoading" class="q-pa-md">
              <q-spinner /> Caricamento parametri…
            </div>
            <div v-else>
              <section v-for="group in visibleParameterGroups" :key="group.class_name" class="q-mb-md">
                <div class="text-subtitle2 q-mb-md">{{ group.class_name }}</div>
                <div v-for="section in group.sections" :key="section.prefix" class="q-mb-md studio-parameter-section">
                  <div v-if="section.title" class="row items-center q-mb-sm text-weight-medium">
                    <span>{{ section.title }}</span>
                    <ParameterHelp :name="`${group.class_name} · ${section.title}`" :text="section.description" />
                  </div>
                <div class="row q-col-gutter-md">
              <div
                v-for="parameter in section.parameters"
                :key="parameter.name"
                class="col-12 col-md-6"
              >
                <q-select
                  v-if="parameter.type === 'bool'"
                  outlined
                  dense
                  :label="parameter.unused ? `${parameter.label} · unused` : parameter.label"
                  :readonly="parameter.unused"
                  :class="{ 'studio-parameter-unused': parameter.unused }"
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
                >
                  <template #append>
                    <ParameterHelp :name="parameter.name" :text="parameter.description" />
                  </template>
                </q-select>
                <q-input
                  v-else
                  outlined
                  dense
                  :label="parameter.unused ? `${parameter.label} · unused` : parameter.label"
                  :readonly="parameter.unused"
                  :class="{ 'studio-parameter-unused': parameter.unused }"
                  :model-value="parameterInputs[parameter.name] ?? ''"
                  @update:model-value="(v) => setParameter(parameter.name, v)"
                  :hint="`Default: ${JSON.stringify(parameter.default)} · ${parameterType(parameter.type)}`"
                  :clearable="!parameter.unused"
                >
                  <template #append>
                    <ParameterHelp :name="parameter.name" :text="parameter.description" />
                  </template>
                </q-input>
              </div>
            </div>
                </div>
              </section>
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
        >
        <q-select
          class="col-12 col-sm-3 col-md-2"
          outlined
          dense
          clearable
          v-model="leverageFilter"
          :options="leverageOptions"
          label="Leva"
        />
        <q-toggle v-model="showScheduleHistory" label="Mostra storico schedulazioni" /><q-toggle v-model="pinnedOnly" label="Solo preferiti" /><q-toggle
          v-model="showHidden"
          label="Mostra archiviati"
        />
      </div>
      <div class="row items-center q-gutter-sm q-mb-sm"><q-btn color="primary" icon="compare_arrows" label="Confronta parametri" :disable="comparisonSelection.length !== 2" @click="comparisonOpen = true" /><span>{{ comparisonSelection.length }}/2 run selezionati</span><q-btn v-if="comparisonSelection.length" flat label="Azzera selezione" @click="comparisonSelection = []" /></div>
      <q-table
        selection="multiple"
        v-model:selected="comparisonSelection"
        flat
        bordered
        class="studio-runs"
        :grid="$q.screen.lt.sm"
        :rows="filteredRuns"
        :columns="runColumns"
        row-key="id"
        :pagination="{ rowsPerPage: 25 }"
        :loading="loading"
        no-data-label="Nessuna simulazione. Crea il primo run con il pulsante Nuovo run."
      >
        <template #header-selection><span class="text-caption">Confronta</span></template>
        <template #body-selection="p"><span class="row inline items-center no-wrap"><q-checkbox :model-value="p.selected" :disable="!p.selected && comparisonSelection.length >= 2" :aria-label="`Seleziona ${runLabel(p.row)} per confronto`" @update:model-value="p.selected = $event" /><span v-if="p.selected" class="comparison-number" :aria-label="`Run ${comparisonNumber(p.row)} del confronto`">{{ comparisonNumber(p.row) }}</span></span></template>
        <template #body-cell-label="p"
          ><q-td :props="p"
            ><div class="row items-center no-wrap q-gutter-xs">
              <span>{{ runLabel(p.row) }}</span>
              <q-btn v-if="p.row.archive?.notes?.trim()" flat round dense size="sm"
                icon="info_outline" color="primary" aria-label="Note del run">
                <q-tooltip class="bg-white text-dark shadow-3 q-pa-md" style="max-width: 420px; max-height: 60vh; overflow: auto">
                  <MarkdownNotes :text="p.row.archive.notes" />
                </q-tooltip>
                <q-menu><div class="q-pa-md" style="width: 420px; max-width: 85vw; max-height: 60vh; overflow: auto">
                  <MarkdownNotes :text="p.row.archive.notes" />
                </div></q-menu>
              </q-btn>
            </div>
            <div class="text-caption text-grey-7">
              {{
                p.row.request_snapshot?.configuration?.strategy ||
                "Aggiornamento dati"
              }}
              <ParameterHelp name="Override del run" :text="runOverrides(p.row)" />
              · {{ p.row.request_snapshot?.configuration?.provider }}
            </div></q-td
          ></template
        >
        <template #body-cell-created="p">
          <q-td :props="p"><div>{{ dateTime(p.row.created_at).split(",")[0] }}</div><div class="text-caption">{{ dateTime(p.row.created_at).split(",").slice(1).join(",").trim() }}</div></q-td>
        </template>
        <template #body-cell-period="p">
          <q-td :props="p"><div>{{ p.row.request_snapshot?.configuration?.fromdate || '—' }}</div><div>{{ p.row.request_snapshot?.configuration?.todate || '—' }}</div></q-td>
        </template>
        <template #body-cell-status="p"
          ><q-td :props="p"
            ><q-icon name="circle" size="16px" :color="statusColor(p.row.status)" :aria-label="statusLabel(p.row.status)" tabindex="0"><q-tooltip>{{ statusLabel(p.row.status) }}<template v-if="p.row.error"> · {{ p.row.error }}</template></q-tooltip></q-icon></q-td
          ></template
        >
        <template #body-cell-actions="p"
          ><q-td :props="p"
            ><q-btn
              flat
              dense
              round
              aria-label="Apri"
              icon="visibility"
              @click="openRun(p.row)"><q-tooltip>Apri</q-tooltip></q-btn><q-btn
              flat
              dense
              round
              icon="content_copy"
              aria-label="Duplica configurazione"
              @click="cloneRun(p.row)"
              ><q-tooltip>Duplica configurazione</q-tooltip></q-btn
            ><q-btn
              v-if="p.row.done"
              flat
              dense
              round
              :icon="p.row.archive?.pinned ? 'star' : 'star_border'"
              :aria-label="p.row.archive?.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
              @click="
                archiveRun(p.row, { pinned: !p.row.archive?.pinned })
              "><q-tooltip>{{ p.row.archive?.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti' }}</q-tooltip></q-btn>
            <q-btn v-if="p.row.done" flat dense round
              :icon="p.row.archive?.hidden ? 'unarchive' : 'archive'"
              :aria-label="p.row.archive?.hidden ? 'Ripristina' : 'Archivia'"
              @click="archiveRun(p.row, { hidden: !p.row.archive?.hidden })">
              <q-tooltip>{{ p.row.archive?.hidden ? 'Ripristina' : 'Archivia' }}</q-tooltip></q-btn>
            <q-btn v-if="scheduleForRun(p.row)" flat dense round icon="layers" aria-label="Storico schedulazione"
              :to="{ path: '/Laboratory/Schedules', query: { history: scheduleForRun(p.row).id } }"><q-tooltip>Storico schedulazione</q-tooltip></q-btn>
            <q-btn v-if="p.row.request_snapshot?.configuration?.strategy" flat dense round icon="schedule" aria-label="Schedula" @click="openSchedule(p.row)"><q-tooltip>Schedula</q-tooltip></q-btn>
            <q-btn v-if="p.row.done" flat dense round color="negative" icon="delete_outline"
              aria-label="Cancella" @click="deleteRun(p.row)"><q-tooltip>Cancella</q-tooltip></q-btn>
            </q-td
        ></template>
        <template #item="p">
          <div class="col-12 q-mb-sm">
            <q-card flat bordered class="q-pa-md studio-run-card">
              <div class="row items-center no-wrap q-gutter-sm">
                <span class="row inline items-center no-wrap"><q-checkbox :model-value="p.selected" :disable="!p.selected && comparisonSelection.length >= 2" :aria-label="`Seleziona ${runLabel(p.row)} per confronto`" @update:model-value="p.selected = $event" /><span v-if="p.selected" class="comparison-number" :aria-label="`Run ${comparisonNumber(p.row)} del confronto`">{{ comparisonNumber(p.row) }}</span></span><div class="col text-weight-bold" style="overflow-wrap: anywhere">{{ runLabel(p.row) }}</div>
                <q-icon name="circle" size="16px" :color="statusColor(p.row.status)" :aria-label="statusLabel(p.row.status)" tabindex="0"><q-tooltip>{{ statusLabel(p.row.status) }} {{ p.row.error || '' }}</q-tooltip></q-icon>
              </div>
              <div class="text-caption text-grey-7" style="overflow-wrap: anywhere">{{ p.row.request_snapshot?.configuration?.strategy }} <ParameterHelp name="Override del run" :text="runOverrides(p.row)" /></div>
              <div class="row q-my-sm text-caption">
                <div class="col-6">Avvio<div>{{ dateTime(p.row.created_at).split(',')[0] }}</div><div>{{ dateTime(p.row.created_at).split(',').slice(1).join(',').trim() }}</div></div>
                <div class="col-6">Periodo simulato<div>{{ p.row.request_snapshot?.configuration?.fromdate || '—' }}</div><div>{{ p.row.request_snapshot?.configuration?.todate || '—' }}</div></div>
              </div>
              <div class="text-caption q-mb-sm">Rendimento {{ percent(p.row.result?.performance?.total_return_pct) }} · Sharpe {{ formatTradeNumber(p.row.result?.performance?.sharpe, 3) }} · Sortino {{ formatTradeNumber(p.row.result?.performance?.sortino, 3) }} · Volatilità {{ percent(p.row.result?.performance?.volatility_pct) }} · Volatilità + {{ percent(p.row.result?.performance?.volatility_positive_pct) }} · Volatilità − {{ percent(p.row.result?.performance?.volatility_negative_pct) }} · Medio/trade {{ percent(p.row.result?.performance?.average_trade_return_pct) }} · Max DD {{ percent(p.row.result?.performance?.max_drawdown_pct) }} · Leva {{ p.row.request_snapshot?.configuration?.broker?.margin_leverage ?? "—" }}</div>
              <div class="row justify-end">
              <q-btn v-if="p.row.archive?.notes?.trim()" flat round dense size="sm"
                icon="info_outline" color="primary" aria-label="Note del run">
                <q-tooltip class="bg-white text-dark shadow-3 q-pa-md" style="max-width: 420px; max-height: 60vh; overflow: auto">
                  <MarkdownNotes :text="p.row.archive.notes" />
                </q-tooltip>
                <q-menu><div class="q-pa-md" style="width: 420px; max-width: 85vw; max-height: 60vh; overflow: auto">
                  <MarkdownNotes :text="p.row.archive.notes" />
                </div></q-menu>
              </q-btn>
              <q-btn
              flat
              dense
              round
              aria-label="Apri"
              icon="visibility"
              @click="openRun(p.row)"><q-tooltip>Apri</q-tooltip></q-btn><q-btn
              flat
              dense
              round
              icon="content_copy"
              aria-label="Duplica configurazione"
              @click="cloneRun(p.row)"
              ><q-tooltip>Duplica configurazione</q-tooltip></q-btn
            ><q-btn
              v-if="p.row.done"
              flat
              dense
              round
              :icon="p.row.archive?.pinned ? 'star' : 'star_border'"
              :aria-label="p.row.archive?.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
              @click="
                archiveRun(p.row, { pinned: !p.row.archive?.pinned })
              "><q-tooltip>{{ p.row.archive?.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti' }}</q-tooltip></q-btn>
            <q-btn v-if="p.row.done" flat dense round
              :icon="p.row.archive?.hidden ? 'unarchive' : 'archive'"
              :aria-label="p.row.archive?.hidden ? 'Ripristina' : 'Archivia'"
              @click="archiveRun(p.row, { hidden: !p.row.archive?.hidden })">
              <q-tooltip>{{ p.row.archive?.hidden ? 'Ripristina' : 'Archivia' }}</q-tooltip></q-btn>
            <q-btn v-if="scheduleForRun(p.row)" flat dense round icon="layers" aria-label="Storico schedulazione"
              :to="{ path: '/Laboratory/Schedules', query: { history: scheduleForRun(p.row).id } }"><q-tooltip>Storico schedulazione</q-tooltip></q-btn>
            <q-btn v-if="p.row.request_snapshot?.configuration?.strategy" flat dense round icon="schedule" aria-label="Schedula" @click="openSchedule(p.row)"><q-tooltip>Schedula</q-tooltip></q-btn>
            <q-btn v-if="p.row.done" flat dense round color="negative" icon="delete_outline"
              aria-label="Cancella" @click="deleteRun(p.row)"><q-tooltip>Cancella</q-tooltip></q-btn>

              </div>
            </q-card>
          </div>
        </template>
      </q-table>
    </template>
    <q-dialog v-model="scheduleDialog" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-card-section class="row items-start">
          <div>
            <div class="text-h6">Schedulazione — {{ scheduleRun ? runLabel(scheduleRun) : "" }}</div>
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
          <div v-if="scheduleRow" class="row items-center"><DashboardFavorite kind="schedule" :id="scheduleRow.id" />Preferito nella dashboard</div>
          <div v-else class="text-caption">Dopo il salvataggio puoi aggiungerla ai preferiti da Laboratorio → Backtest schedulati.</div>
          <div class="text-body2 q-mt-md">
            Periodo: <b>{{ scheduleRun?.request_snapshot?.configuration?.fromdate }}</b> → <b>oggi</b>
          </div>
          <template v-if="scheduleRow">
            <div class="text-caption text-grey-7 q-mt-sm">Prossima esecuzione: {{ dateTime(scheduleRow.next_run_at) }}</div>
            <div class="text-caption text-grey-7">Ultimo avvio: {{ dateTime(scheduleRow.last_triggered_at) }}</div>
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
    <q-dialog v-model="detailOpen" maximized
      ><q-card v-if="selectedRun">
        <q-bar
          ><div>{{ runLabel(selectedRun) }}</div>
          <q-space /><q-btn flat dense icon="add" label="Nuovo run" @click="newRun" /><q-btn
            flat
            dense
            icon="refresh"
            @click="refreshDetail" /><q-btn
            flat
            dense
            icon="close"
            aria-label="Chiudi dettaglio run"
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
          </div>
          <div v-if="selectedRun.done && selectedRun.kind === 'simulation'" class="row items-center q-gutter-sm q-mt-sm">
            <span class="text-caption">Metriche: {{ metricsCacheLabel(selectedRun.metrics_cache) }}</span>
            <q-btn flat dense icon="cached" label="Ricalcola metriche" :disable="selectedRun.metrics_cache?.status === 'updating'" @click="refreshMetrics" />
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
          <equity-curve
            :points="equityPoints"
            :comparison-points="benchmarkPoints"
            :drawdown-points="drawdownPoints"
          />
          <div v-if="selectedRun.result?.benchmark" class="text-caption text-grey-7 q-mt-sm">
            Benchmark: <q-btn flat dense no-caps color="primary" :label="selectedBenchmarkLabel" @click="benchmarkOpen = true" />
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
              @click="statsOpen = true"
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
                  : 'Archivia'
              "
              @click="
                archiveRun(selectedRun, {
                  hidden: !selectedRun.archive?.hidden,
                })
              "
            />
          </div>
          <div v-if="selectedRun.archive?.notes" class="q-mt-md">
            <MarkdownNotes :text="selectedRun.archive.notes" />
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
          <RunDiagnostics v-if="selectedRun" :key="selectedRun.id" :run="selectedRun" :endpoint="simulationEndpoint" />
          <div v-if="!selectedRun.done" class="text-grey-7 q-mt-md">
            Calcolo in corso: risultati e report compariranno al termine. Il
            monitoraggio continua riaprendo la pagina.
          </div>
        </q-card-section>
        <q-card-section v-if="detailTab === 'trades'"
          ><div class="row items-center justify-between q-gutter-sm q-mb-sm">
            <div class="text-caption text-grey-7">
              Per le strategie minute, la durata mostra ore:minuti e tra
              parentesi il conteggio delle barre.
            </div>
            <q-btn
              outline
              dense
              no-caps
              color="primary"
              icon="table_view"
              label="Esporta Excel"
              :loading="exportingTrades"
              :disable="!tradeTotal"
              @click="exportTrades"
            />
          </div>
          <q-table
            class="trade-table"
            flat
            bordered
            :grid="$q.screen.lt.md"
            :rows="tradeRows"
            :columns="tradeColumns"
            row-key="_index"
            :pagination="{ rowsPerPage: 0 }"
            hide-bottom>
            <template #item="p"><div class="col-12 col-sm-6 q-pa-xs"><q-card flat bordered class="q-pa-sm"><div class="row q-col-gutter-sm"><div v-for="column in p.cols" :key="column.name" class="col-6 trade-value"><div class="text-caption text-grey-7">{{ column.label }}</div><div>{{ column.value }}</div></div></div></q-card></div></template>
          </q-table>
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
          ><div v-for="group in runParameterGroups" :key="group.label" class="q-mb-md">
            <div class="text-subtitle1 q-mb-sm">{{ group.label }}</div>
            <div class="row q-col-gutter-sm"><div v-for="field in group.fields" :key="field.key" class="col-12 col-sm-6 col-lg-4 trade-value"><span class="text-grey-7">{{ field.key }}</span><div>{{ displayValue(field.value) }}</div></div></div>
          </div>
          <q-expansion-item label="Configurazione raw e risultati effettivi">
          <div class="text-subtitle2">
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
          </q-expansion-item>
        </q-card-section>
        <q-card-section v-if="detailTab === 'log'"
          ><q-btn flat label="Aggiorna log" icon="refresh" @click="loadLog" />
          <pre class="studio-pre">{{
            logText || "Nessun output disponibile"
          }}</pre>
        </q-card-section>
      </q-card></q-dialog
    >
    <q-dialog v-model="comparisonOpen"><q-card style="width: 1100px; max-width: 96vw"><q-bar><div>Differenze parametri</div><q-space /><q-btn flat icon="close" aria-label="Chiudi confronto" v-close-popup /></q-bar><q-card-section>
      <div class="text-subtitle2">Volatilità annua</div>
      <div class="text-caption q-mb-sm">Le componenti + e − sono calcolate rispetto a zero su tutte le giornate e annualizzate; non si sommano alla volatilità complessiva.</div>
      <q-markup-table flat bordered class="q-mb-md"><thead><tr><th>Metrica</th><th>Run 1</th><th>Run 2</th></tr></thead><tbody><tr v-for="metric in [['Complessiva', 'volatility_pct'], ['Positiva', 'volatility_positive_pct'], ['Negativa', 'volatility_negative_pct']]" :key="metric[1]"><td>{{ metric[0] }}</td><td v-for="selected in comparisonSelection" :key="selected.id">{{ percent((jobs.find(r => r.id === selected.id) || selected).result?.performance?.[metric[1]]) }}</td></tr></tbody></q-markup-table>
      <q-markup-table flat bordered wrap-cells class="comparison-table"><thead><tr><th>Campo</th><th><span class="comparison-number q-mr-xs">1</span>{{ runLabel(comparisonSelection[0] || {}) }}</th><th><span class="comparison-number q-mr-xs">2</span>{{ runLabel(comparisonSelection[1] || {}) }}</th></tr></thead><tbody><tr v-for="row in comparisonRows" :key="row.key" class="bg-amber-2 text-dark"><td>{{ row.key }}</td><td>{{ row.left }}</td><td>{{ row.right }}</td></tr></tbody></q-markup-table>
      <div v-if="!comparisonRows.length" class="q-pa-md">Nessuna differenza nei parametri salvati.</div>
    </q-card-section></q-card></q-dialog>
    <q-dialog v-model="statsOpen" maximized><q-card class="column no-wrap"><q-bar><div>Report stats</div><q-space /><q-btn flat icon="close" aria-label="Chiudi report" v-close-popup /></q-bar><iframe v-if="statsOpen && selectedRun" :src="artifactUrl('stats.html')" title="Report statistiche" sandbox="allow-scripts allow-same-origin" style="border: 0; width: 100%; flex: 1" /></q-card></q-dialog>
    <q-dialog v-model="benchmarkOpen"><q-card style="width: 720px; max-width: 95vw"><q-bar><div>{{ selectedBenchmarkLabel }}</div><q-space /><q-btn flat icon="close" v-close-popup /></q-bar><q-card-section><equity-curve :points="benchmarkPoints" /><pre class="studio-pre">{{ JSON.stringify(selectedRun?.result?.benchmark, null, 2) }}</pre></q-card-section></q-card></q-dialog>
    <q-dialog v-model="notesDialog" persistent>
      <q-card style="width: 760px; max-width: 95vw">
        <q-card-section class="text-h6">Nome e note</q-card-section>
        <q-card-section class="q-pt-none q-gutter-md">
          <q-input v-model="notesForm.label" outlined dense label="Nome simulazione" maxlength="160" />
          <q-input v-model="notesForm.notes" outlined type="textarea" label="Note (Markdown)"
            hint="Supporta titoli, grassetto, elenchi, link e tabelle." maxlength="2000" counter autogrow />
          <div v-if="notesForm.notes.trim()">
            <div class="text-caption text-grey-7 q-mb-sm">Anteprima</div>
            <MarkdownNotes :text="notesForm.notes" />
          </div>
          <div v-if="notesError" class="text-negative" role="alert">{{ notesError }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Annulla" :disable="savingNotes" v-close-popup />
          <q-btn color="primary" label="Salva" :loading="savingNotes" @click="saveRunNotes" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import DashboardFavorite from '../components/DashboardFavorite.vue';
import { scheduleForRun, latestScheduledRuns } from '../utils/scheduledRuns.mjs';

import RunDiagnostics from "../components/RunDiagnostics.vue";
import { api } from "boot/axios";
import { constants } from "boot/constants";
import EquityCurve from "../components/EquityCurve.vue";
import ParameterHelp from "../components/ParameterHelp.vue";
import MarkdownNotes from "../components/MarkdownNotes.vue";
import { strategyDocumentation, parameterSections } from "../utils/strategyDocumentation.mjs";

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
  components: { DashboardFavorite, EquityCurve, ParameterHelp, MarkdownNotes, RunDiagnostics },
  props: { initialTab: { type: String, default: "runs" } },
  data() {
    return {
      tab: this.initialTab,
      catalog: {},
      loadingBenchmarks: false,
      strategyOptions: [],
      schema: {},
      form: defaults(),
      preset: null,
      parameterInputs: {},
      parameterSearch: "",
      showAllParameters: false,
      showUnusedParameters: false,
      schemaVersion: 0,
      schemaLoading: false,
      error: "",
      networkError: "",
      comparisonSelection: [], comparisonOpen: false,
      statsOpen: false, benchmarkOpen: false,
      loading: false,
      validating: false,
      submitting: false,
      validation: null,
      jobs: [],
      schedules: [],
      showScheduleHistory: false,
      timer: null,
      polling: false,
      search: "",
      leverageFilter: null,
      pinnedOnly: false,
      showHidden: false,
      scheduleTime: "20:00",
      scheduleDialog: false,
      scheduleRun: null,
      scheduleRow: null,
      scheduleEnabled: true,
      scheduleSaving: false,
      notesDialog: false,
      notesForm: { id: null, label: "", notes: "" },
      notesError: "",
      savingNotes: false,
      detailOpen: false,
      detailTab: "summary",
      selectedRun: null,
      equityPoints: [],
      benchmarkPoints: [],
      drawdownPoints: [],
      logText: "",
      tradeRows: [],
      tradePage: 1,
      tradeTotal: 0,
      exportingTrades: false,
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
          field: (r) => r.created_at ? new Date(r.created_at).getTime() : null,
          sortable: true,
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
          field: (r) => r.result?.performance?.total_return_pct ?? null,
          format: (value) => this.percent(value),
          sortable: true,
          align: "right",
        },
        {
          name: "max_drawdown",
          label: "Max DD",
          field: (r) => r.result?.performance?.max_drawdown_pct ?? null,
          format: (value) => this.percent(value),
          align: "right",
          sortable: true,
        },
        { name: "sharpe", label: "Sharpe", field: r => r.result?.performance?.sharpe ?? null,
          format: value => this.formatTradeNumber(value, 3), align: "right", sortable: true },
        { name: "sortino", label: "Sortino", field: r => r.result?.performance?.sortino ?? null,
          format: value => this.formatTradeNumber(value, 3), align: "right", sortable: true },
        { name: "volatility", label: "Volatilità annua", field: r => r.result?.performance?.volatility_pct ?? null,
          format: value => this.percent(value), align: "right", sortable: true },
        { name: "volatility_positive", label: "Volatilità annua +", field: r => r.result?.performance?.volatility_positive_pct ?? null,
          format: value => this.percent(value), align: "right", sortable: true },
        { name: "volatility_negative", label: "Volatilità annua −", field: r => r.result?.performance?.volatility_negative_pct ?? null,
          format: value => this.percent(value), align: "right", sortable: true },
        { name: "average_trade_return", label: "Rendimento medio / trade", field: r => r.result?.performance?.average_trade_return_pct ?? null,
          format: value => this.percent(value), align: "right", sortable: true },
        { name: "actions", label: "Azioni", align: "right" },
      ],
    };
  },
  computed: {
    simulationEndpoint() { return endpoint; },
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
    comparisonRows() {
      const config = row => {
        const { label, notes, ...values } = row?.request_snapshot?.configuration || {};
        return this.flattenConfig(values);
      };
      const left = config(this.jobs.find(r => r.id === this.comparisonSelection[0]?.id));
      const right = config(this.jobs.find(r => r.id === this.comparisonSelection[1]?.id));
      return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key])).map(key => ({ key, left: this.displayValue(left[key]), right: this.displayValue(right[key]) }));
    },
    runParameterGroups() {
      const config = this.selectedRun?.request_snapshot?.configuration || {};
      const { parameters = {}, broker = {}, ...general } = config;
      return [{ label: 'Strategia e dati', values: general }, { label: 'Broker e costi', values: broker }, { label: 'Parametri strategia · override richiesti', values: parameters }].map(g => ({ label: g.label, fields: Object.entries(g.values).map(([key, value]) => ({ key, value })) }));
    },
    selectedBenchmarkLabel() {
      const b = this.selectedRun?.result?.benchmark || {};
      const name = b.source_name || this.selectedRun?.request_snapshot?.configuration?.benchmark;
      return b.automatic ? 'Buy&Hold automatico · equiponderato' : (this.catalog.benchmarks || []).find(item => item.name === name)?.label || b.label || name || 'Benchmark';
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
            (this.showUnusedParameters || !p.unused) &&
            (!this.parameterSearch ||
            p.name.toLowerCase().includes(this.parameterSearch.toLowerCase())),
        );
      return !this.parameterSearch && !this.showAllParameters
        ? p.slice(0, 12)
        : p;
    },
    visibleParameterGroups() {
      const names = new Set(this.visibleParameters.map(p => p.name));
      const groups = this.schema.parameter_groups?.length ? this.schema.parameter_groups : [{ class_name: this.form.strategy, parameters: this.schema.parameters || [] }];
      return groups.map(group => {
        // Group before filtering so searches and the initial limit keep their section.
        const sections = parameterSections(group).map(section => ({ ...section,
          parameters: section.parameters.filter(p => names.has(p.name)),
        })).filter(section => section.parameters.length);
        return { ...group, sections };
      }).filter(group => group.sections.length);
    },
    leverageOptions() {
      return [...new Set(this.jobs
        .filter(r => r.kind === "simulation" && !r.archive?.deleted_at)
        .map(r => r.request_snapshot?.configuration?.broker?.margin_leverage)
        .filter(value => value != null && value !== "" && Number.isFinite(Number(value)))
        .map(Number))].sort((a, b) => a - b);
    },
    filteredRuns() {
      const runs = this.showScheduleHistory ? this.jobs : latestScheduledRuns(this.jobs, this.schedules);
      return runs.filter(
        (r) =>
          r.kind === "simulation" &&
          !r.archive?.deleted_at &&
          (this.showHidden || !r.archive?.hidden) &&
          (!this.pinnedOnly || r.archive?.pinned) &&
          (this.leverageFilter == null ||
            (r.request_snapshot?.configuration?.broker?.margin_leverage != null &&
              Number(r.request_snapshot.configuration.broker.margin_leverage) === this.leverageFilter)) &&
          JSON.stringify([
            this.runLabel(r),
            r.request_snapshot?.configuration?.strategy,
            r.status,
          ])
            .toLowerCase()
            .includes(this.search.toLowerCase()),
      );
    },
    tradeTimeframe() {
      return (
        this.selectedRun?.request_snapshot?.configuration?.timeframe || "daily"
      );
    },
    tradeColumns() {
      const keys = [
        ...new Set(this.tradeRows.flatMap((r) => Object.keys(r))),
      ].filter((k) => k !== "_index");
      const gainKey = ["pct_gain", "pnl_pct", "pnl_percent"].find((key) =>
        keys.includes(key),
      );
      const priority = [
        "asset",
        "entry_side",
        "open_datetime",
        "close_datetime",
        gainKey,
        "entry_signal_dt",
        "exit_signal_dt",
      ].filter(Boolean);
      const orderedKeys = [
        ...priority.filter((key) => keys.includes(key)),
        ...keys.filter(
          (key) => !priority.includes(key) && key !== "duration_bars",
        ),
        ...(keys.includes("duration_bars") ? ["duration_bars"] : []),
      ];
      const labels = {
        open_datetime: "Data ingresso",
        close_datetime: "Data uscita",
        pct_gain: "Gain %",
        pnl_pct: "Gain %",
        pnl_percent: "Gain %",
        entry_signal_dt: "Segnale ingresso",
        exit_signal_dt: "Segnale uscita",
        asset: "Ticker",
        duration_bars: "Durata (barre)",
        pnl: "P/L",
        pnlcomm: "P/L dopo commissioni",
        size: "Quantità",
        price: "Prezzo ingresso",
        value: "Valore posizione all’ingresso",
        entry_side: "Direzione",
        entry_delay_bars: "Ritardo ingresso (barre)",
        exit_delay_bars: "Ritardo uscita (barre)",
        entry_bucket_name: "Finestra ingresso",
        exit_bucket_name: "Finestra uscita",
        exit_reason: "Motivo uscita",
      };
      const numericKeys = new Set([
        "pct_gain",
        "pnl_pct",
        "pnl_percent",
        "duration_bars",
        "pnl",
        "pnlcomm",
        "size",
        "price",
        "value",
        "entry_delay_bars",
        "exit_delay_bars",
      ]);
      return orderedKeys.map((k) => ({
        name: k,
        label:
          labels[k] ||
          k.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase()),
        field: k,
        format: (value) => this.formatTradeValue(k, value),
        align: numericKeys.has(k) ? "right" : "left",
        classes: k === "asset" ? "text-weight-bold" : "",
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
        { label: "Volatilità annua", value: this.percent(p.volatility_pct) },
        { label: "Volatilità annua +", value: this.percent(p.volatility_positive_pct) },
        { label: "Volatilità annua −", value: this.percent(p.volatility_negative_pct) },
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
    comparisonNumber(row) {
      return this.comparisonSelection.findIndex(selected => selected.id === row.id) + 1;
    },
    newRun() { if (this.detailOpen && this.selectedRun) return this.cloneRun(this.selectedRun); this.detailOpen = false; this.form = defaults(); this.parameterInputs = {}; this.validation = null; this.tab = 'new'; this.loadSchema(); },
    displayValue(value) { return value === undefined ? 'Non presente' : typeof value === 'object' ? JSON.stringify(value) : String(value); },
    flattenConfig(value, prefix = '') {
      return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return item && typeof item === 'object' && !Array.isArray(item) ? Object.entries(this.flattenConfig(item, path)) : [[path, item]];
      }));
    },
    runOverrides(row) { return '### Override richiesti nel run\n```json\n' + JSON.stringify(row.request_snapshot?.configuration?.parameters || {}, null, 2) + '\n```'; },
    async loadBenchmarkOptions(_value, update) {
      await this.refreshBenchmarks();
      update(() => {});
    },
    async refreshBenchmarks() {
      if (this.loadingBenchmarks) return;
      this.loadingBenchmarks = true;
      try {
        const { data } = await api.get(endpoint + "/benchmarks");
        this.catalog.benchmarks = data;
      } catch (e) {
        this.error = this.message(e);
      } finally {
        this.loadingBenchmarks = false;
      }
    },
    message(e) {
      const message = e?.response?.data?.error || e.message || String(e);
      if (!e.response) this.networkError = message;
      return message;
    },
    percent(v) {
      return v == null ? "—" : `${Number(v).toFixed(2)}%`;
    },
    dateTime(v) {
      return v ? new Date(v).toLocaleString("it-IT") : "—";
    },
    formatTradeDate(value, timeframe = "daily") {
      if (value == null || value === "") return "—";
      const match = String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/,
      );
      if (!match) return String(value);
      const [, year, month, day, hour, minute, second] = match;
      const date = `${day}/${month}/${year}`;
      if (!hour || timeframe !== "minutes") return date;
      return `${date} ${hour}:${minute}${second && second !== "00" ? `:${second}` : ""}`;
    },
    formatTradeNumber(value, maximumFractionDigits = 2) {
      if (value == null || value === "") return "—";
      const number = Number(value);
      if (!Number.isFinite(number)) return String(value);
      return number.toLocaleString("it-IT", { maximumFractionDigits });
    },
    formatTradeDuration(value) {
      if (value == null || value === "") return "—";
      const totalMinutes = Math.max(0, Math.round(Number(value)));
      if (!Number.isFinite(totalMinutes)) return String(value);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const bars = `${totalMinutes} ${totalMinutes === 1 ? "barra" : "barre"}`;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} (${bars})`;
    },
    formatTradeValue(key, value) {
      if (value == null || value === "") return "—";
      if (
        [
          "open_datetime",
          "close_datetime",
          "entry_signal_dt",
          "exit_signal_dt",
        ].includes(key)
      ) {
        return this.formatTradeDate(value, this.tradeTimeframe);
      }
      if (["pct_gain", "pnl_pct", "pnl_percent"].includes(key)) {
        return `${this.formatTradeNumber(value, 2)}%`;
      }
      if (key === "duration_bars") return this.formatTradeDuration(value);
      if (["pnl", "pnlcomm", "price", "value"].includes(key)) {
        return this.formatTradeNumber(value, 2);
      }
      if (key === "size") return this.formatTradeNumber(value, 4);
      if (["entry_delay_bars", "exit_delay_bars"].includes(key)) {
        return this.formatTradeNumber(value, 0);
      }
      if (key === "entry_side") {
        return { long: "Long", short: "Short" }[value] || String(value);
      }
      if (typeof value === "number") return this.formatTradeNumber(value, 4);
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
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
        if (version === this.schemaVersion) this.schema = strategyDocumentation(data);
      } catch (e) {
        if (version === this.schemaVersion) this.error = this.message(e);
      } finally {
        if (version === this.schemaVersion) this.schemaLoading = false;
      }
    },
    setParameter(key, value) {
      if (this.schema.parameters?.find(parameter => parameter.name === key)?.unused) return;
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
        if (this.networkError && this.error === this.networkError) this.error = "";
        this.networkError = "";
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
        if (!e.response) this.networkError = this.error;
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
      this.benchmarkPoints = [];
      this.drawdownPoints = [];
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
    metricsCacheLabel(cache) {
      const labels = { ready: 'aggiornate', updating: 'in aggiornamento', missing: 'non disponibili', error: 'aggiornamento non riuscito' };
      return `${labels[cache?.status] || 'non disponibili'}${cache?.computed_at ? ` · ${this.dateTime(cache.computed_at)}` : ''}${cache?.error ? ` · ${cache.error}` : ''}`;
    },
    async refreshMetrics() {
      const id = this.selectedRun?.id;
      if (!id) return;
      try {
        await api.post(`${endpoint}/jobs/${id}/refresh-metrics`);
        await this.poll();
      } catch (e) {
        this.error = this.message(e);
      }
    },
    async loadEquity() {
      const id = this.selectedRun?.id;
      if (!id || !this.hasArtifact("returns.csv")) return;
      try {
        const { data } = await api.get(`${endpoint}/jobs/${id}/equity`);
        if (id === this.selectedRun?.id) {
          this.equityPoints = data.points;
          this.benchmarkPoints = data.benchmark_points || [];
          this.drawdownPoints = data.drawdown_points || [];
        }
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
    async exportTrades() {
      const id = this.selectedRun?.id;
      if (!id) return;
      this.exportingTrades = true;
      try {
        const response = await api.get(`${endpoint}/jobs/${id}/trades.xlsx`, {
          responseType: "blob",
        });
        const disposition = String(
          response.headers?.["content-disposition"] || "",
        );
        const filename =
          disposition
            .match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i)?.[1]
            ?.trim() || `trades-${id}.xlsx`;
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = decodeURIComponent(filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (e) {
        let message = this.message(e);
        if (e?.response?.data instanceof Blob) {
          try {
            const payload = JSON.parse(await e.response.data.text());
            message = payload.error || payload.message || message;
          } catch {
            // Keep the original HTTP error message.
          }
        }
        this.error = `Esportazione Excel non riuscita: ${message}`;
      } finally {
        this.exportingTrades = false;
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
    deleteRun(row) {
      this.$q.dialog({
        title: "Cancella run",
        message: `Cancellare il run “${this.runLabel(row)}”? Verrà rimosso anche dagli archivi.`,
        cancel: { label: "Annulla", flat: true },
        ok: { label: "Cancella", color: "negative" },
        persistent: true,
      }).onOk(async () => {
        try {
          await api.delete(`${endpoint}/jobs/${row.id}`);
          if (this.selectedRun?.id === row.id) this.detailOpen = false;
          await this.poll();
        } catch (e) {
          this.error = this.message(e);
        }
      });
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
      this.notesForm = { id: row.id, label: this.runLabel(row), notes: row.archive?.notes || "" };
      this.notesError = "";
      this.notesDialog = true;
    },
    async saveRunNotes() {
      this.savingNotes = true;
      this.notesError = "";
      const { id, label, notes } = this.notesForm;
      try {
        const { data } = await api.patch(`${endpoint}/jobs/${id}`, { label, notes });
        if (this.selectedRun?.id === id) this.selectedRun = data;
        this.jobs = this.jobs.map(row => row.id === id ? data : row);
        this.notesDialog = false;
      } catch (e) {
        this.notesError = this.message(e);
      } finally {
        this.savingNotes = false;
      }
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
            const { data } = await api.post(endpoint + "/benchmarks", { job_id: id, label });
            await this.refreshBenchmarks();
            this.form.benchmark = data.name;
            this.$q.notify({ type: "positive", message: "Benchmark salvato" });
          } catch (e) {
            this.error = this.message(e);
          }
        });
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
            hour, minute, enabled: this.scheduleEnabled, label: this.runLabel(this.scheduleRun),
          });
        } else {
          await api.post("/dyn/simulations/schedules", {
            configuration: { ...this.scheduleRun.request_snapshot.configuration, label: this.runLabel(this.scheduleRun) },
            source_job_id: this.scheduleRun.id,
            label: this.runLabel(this.scheduleRun),
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

  },
};
</script>
<style scoped>
.studio-page {
  max-width: 1600px;
  margin: auto;
}
.studio-navigation {
  position: sticky;
  top: 50px;
  z-index: 20;
  background: #f5f5f5;
  padding-top: 8px;
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
.studio-parameter-unused {
  background: #f3f3f3;
}
.studio-parameter-unused :deep(.q-field__native),
.studio-parameter-unused :deep(.q-field__label),
.studio-parameter-unused :deep(.q-field__bottom) {
  color: #757575;
}
.studio-error {
  max-width: 330px;
  white-space: normal;
}
.trade-table :deep(th),
.trade-table :deep(td) {
  white-space: nowrap;
}
</style>

<style scoped>
.studio-runs :deep(th:last-child), .studio-runs :deep(td:last-child) {
  position: sticky;
  right: 0;
  z-index: 1;
  background: white;
  box-shadow: -3px 0 5px #0000000d;
  min-width: 170px;
  white-space: normal;
}
.studio-runs :deep(td:nth-child(2)) { white-space: normal; overflow-wrap: anywhere; min-width: 160px; max-width: 280px; }
.studio-runs :deep(td:first-child), .studio-runs :deep(th:first-child) { width: 64px; min-width: 64px; }
.studio-runs :deep(td), .studio-runs :deep(th) { padding: 7px 8px; }
@media (max-width: 600px) {
  .studio-runs :deep(th:last-child), .studio-runs :deep(td:last-child) { min-width: 72px; width: 72px; max-width: 72px; }
}
</style>

<style scoped>
.comparison-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 1px solid currentColor;
  border-radius: 50%;
  color: var(--q-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.trade-value { overflow-wrap: anywhere; white-space: normal; }
.comparison-table td { overflow-wrap: anywhere; white-space: pre-wrap; max-width: 32vw; }
.trade-table :deep(td) { white-space: normal; overflow-wrap: anywhere; }
</style>
