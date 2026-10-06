<template>
  <q-page class="q-pa-md">
    <div class="watchtower-toolbar q-mb-md">
      <div class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h5">Watchtower</div>
          <div class="text-caption text-grey-7">Integrità esecutiva e coerenza statistica</div>
          <div class="text-caption text-grey-6" v-if="lastRefreshAt">
            Ultimo refresh: {{ formatDateTime(lastRefreshAt) }}
          </div>
          <div class="text-caption text-grey-6" v-if="watchtowerLatest?.created_at">
            Ultimo snapshot Watchtower: {{ formatDateTime(watchtowerLatest.created_at) }}
          </div>
        </div>
        <div class="col-auto row q-col-gutter-sm items-center">
          <div class="col-auto">
            <q-select
              v-model="selectedWindowOpen"
              :options="windowOptions"
              label="Finestra dati"
              dense
              outlined
              emit-value
              map-options
              style="min-width: 280px"
              @update:model-value="handleWindowChange"
            />
          </div>
          <div class="col-auto">
            <q-select
              v-model="selectedPortfolioKeyId"
              :options="portfolioOptions"
              label="Portfolio Alpaca"
              dense
              outlined
              emit-value
              map-options
              style="min-width: 260px"
              @update:model-value="refreshAll"
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="accent"
              icon="cloud_download"
              label="Sync Alpaca"
              :loading="isSyncingAlpaca"
              :disable="!selectedWindowOpen || isRefreshing || isRebuilding"
              @click="syncAlpacaWindow"
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="secondary"
              icon="build"
              label="Genera / Rigenera"
              :loading="isRebuilding"
              :disable="!selectedWindowOpen || isRefreshing"
              @click="rebuildWindow"
            />
          </div>
          <div class="col-auto">
            <q-btn
              color="primary"
              icon="table_view"
              label="Export Excel"
              :loading="isExportingBars"
              :disable="!selectedWindowOpen || isRefreshing"
              @click="exportBars"
            />
          </div>
          <div class="col-auto">
            <q-btn color="primary" icon="refresh" label="Refresh" :loading="isRefreshing" @click="refreshAll" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedPortfolioSummary" class="text-caption text-grey-7 q-mb-md">
      {{ selectedPortfolioSummary }}
    </div>

    <div v-if="isSyncingAlpaca || alpacaSyncStatus" class="q-mb-md">
      <q-card flat bordered>
        <q-card-section class="q-pb-sm">
          <div class="row items-center q-col-gutter-md">
            <div class="col">
              <div class="text-subtitle2">Sync Alpaca finestra {{ selectedWindowOpen }}</div>
              <div class="text-caption text-grey-7">{{ alpacaSyncLabel }}</div>
            </div>
            <div class="col-auto text-caption text-grey-7">
              {{ alpacaSyncProcessed }} / {{ alpacaSyncEstimatedTotal }}
            </div>
          </div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-linear-progress
            size="12px"
            rounded
            color="accent"
            track-color="grey-3"
            :value="alpacaSyncProgress"
          />
        </q-card-section>
      </q-card>
    </div>

    <q-card flat bordered class="q-mb-lg">
      <q-card-section>
        <div class="text-h6">Quadratura Conteggi</div>
        <div class="text-caption text-grey-7">
          SIM è la baseline. Il Δ è riportato su Paper come Paper − SIM, mentre Alpaca mostra il Δ rispetto a Paper.
        </div>
      </q-card-section>
      <q-card-section class="row q-col-gutter-md">
        <div class="col-12 col-lg-6">
          <div class="text-subtitle2 q-mb-sm">Aperture, Chiusure, Quadrature Asset</div>
          <div class="text-caption text-grey-7 q-mb-sm">
            A sinistra la lettura operativa completa della sessione, con separatori tra aperture, chiusure e asset.
          </div>
          <table class="quadratura-table full-width">
            <thead>
              <tr>
                <th class="col-label"></th>
                <th class="col-baseline">SIM</th>
                <th class="col-delta">PAPER</th>
                <th>ALPACA</th>
              </tr>
            </thead>
            <tbody>
              <tr class="quadrature-section-row">
                <th colspan="4">Aperture</th>
              </tr>
              <template v-for="row in openSummaryRows" :key="`open-${row.key}`">
                <tr>
                  <th>
                    <div class="row items-center no-wrap">
                      <span>{{ row.label }}</span>
                      <q-btn
                        v-if="row.key === 'non_executed' || row.key === 'open_executed'"
                        flat
                        dense
                        round
                        size="sm"
                        class="q-ml-xs"
                        :icon="row.key === 'non_executed' ? (openNonExecutedExpanded ? 'expand_less' : 'expand_more') : (openExecutedExpanded ? 'expand_less' : 'expand_more')"
                        @click.stop="row.key === 'non_executed' ? (openNonExecutedExpanded = !openNonExecutedExpanded) : (openExecutedExpanded = !openExecutedExpanded)"
                      />
                    </div>
                  </th>
                  <td class="col-baseline"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.sim)" @click="showMetricDetails('sim', row)" /></td>
                  <td :class="['col-delta', metricCellClass(row, row.paper, row.sim)]">
                    <q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.paper)" @click="showMetricDetails('paper', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.paper, row.sim)">{{ deltaLabel(row.paper, row.sim) }}</span>
                  </td>
                  <td :class="metricCellClass(row, row.alpaca, row.paper)">
                    <span v-if="row.alpaca !== null"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.alpaca)" @click="showMetricDetails('alpaca', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.alpaca, row.paper)">{{ deltaLabel(row.alpaca, row.paper) }}</span></span>
                    <span v-else class="text-grey-5">—</span>
                  </td>
                </tr>
                <tr v-if="row.key === 'non_executed' && openNonExecutedExpanded" v-for="detailRow in openDetailRows" :key="`open-detail-${detailRow.key}`" class="quadrature-subrow">
                  <th><span class="quadrature-subrow-label">{{ detailRow.label }}</span></th>
                  <td class="col-baseline"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.sim)" @click="showMetricDetails('sim', detailRow)" /></td>
                  <td class="col-delta">
                    <q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.paper)" @click="showMetricDetails('paper', detailRow)" />
                  </td>
                  <td>
                    <span v-if="detailRow.alpaca !== null"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.alpaca)" @click="showMetricDetails('alpaca', detailRow)" /></span>
                    <span v-else class="text-grey-5">—</span>
                  </td>
                </tr>
                <tr v-if="row.key === 'open_executed' && openExecutedExpanded" v-for="detailRow in openExecutedDetailRows" :key="`open-exec-${detailRow.key}`" class="quadrature-subrow">
                  <th><span class="quadrature-subrow-label">{{ detailRow.label }}</span></th>
                  <td class="col-baseline"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.sim)" @click="showMetricDetails('sim', detailRow)" /></td>
                  <td class="col-delta">
                    <q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.paper)" @click="showMetricDetails('paper', detailRow)" />
                  </td>
                  <td>
                    <span v-if="detailRow.alpaca !== null"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(detailRow.alpaca)" @click="showMetricDetails('alpaca', detailRow)" /></span>
                    <span v-else class="text-grey-5">—</span>
                  </td>
                </tr>
              </template>
              <tr class="quadrature-section-row">
                <th colspan="4">Chiusure</th>
              </tr>
              <tr v-for="row in closeSummaryRows" :key="`close-${row.key}`">
                <th>{{ row.label }}</th>
                <td class="col-baseline"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.sim)" @click="showMetricDetails('sim', row)" /></td>
                <td :class="['col-delta', metricCellClass(row, row.paper, row.sim)]">
                  <q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.paper)" @click="showMetricDetails('paper', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.paper, row.sim)">{{ deltaLabel(row.paper, row.sim) }}</span>
                </td>
                <td :class="metricCellClass(row, row.alpaca, row.paper)">
                  <span v-if="row.alpaca !== null"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(row.alpaca)" @click="showMetricDetails('alpaca', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.alpaca, row.paper)">{{ deltaLabel(row.alpaca, row.paper) }}</span></span>
                  <span v-else class="text-grey-5">—</span>
                </td>
              </tr>
              <tr class="quadrature-section-row">
                <th colspan="4">Quadrature Asset</th>
              </tr>
              <tr v-for="row in exposureRows" :key="`exposure-${row.key}`">
                <th>{{ row.label }}</th>
                <td class="col-baseline">
                  <q-btn v-if="hasMetricValue(row.sim)" flat dense no-caps class="metric-cell-btn" :label="String(formatExposureValue(row, row.sim))" @click="showMetricDetails('sim', row)" />
                  <span v-else class="text-grey-5">—</span>
                </td>
                <td :class="['col-delta', metricCellClass(row, row.paper, row.sim)]">
                  <template v-if="hasMetricValue(row.paper)">
                    <q-btn flat dense no-caps class="metric-cell-btn" :label="String(formatExposureValue(row, row.paper))" @click="showMetricDetails('paper', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.paper, row.sim)">{{ deltaLabel(row.paper, row.sim) }}</span>
                  </template>
                  <span v-else class="text-grey-5">—</span>
                </td>
                <td :class="metricCellClass(row, row.alpaca, row.paper)">
                  <span v-if="hasMetricValue(row.alpaca)"><q-btn flat dense no-caps class="metric-cell-btn" :label="String(formatExposureValue(row, row.alpaca))" @click="showMetricDetails('alpaca', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.alpaca, row.paper)">{{ deltaLabel(row.alpaca, row.paper) }}</span></span>
                  <span v-else class="text-grey-5">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="q-mt-sm text-caption">
            <span class="text-grey-7">Delta asset SIM vs PAPER:</span>
            <q-badge :color="assetDeltaColor" class="q-ml-sm">{{ assetDeltaSummary }}</q-badge>
            <q-btn flat dense size="sm" icon="info" class="q-ml-sm">
              <q-popup-proxy>
                <q-card flat bordered class="q-pa-sm asset-popup">
                  <div class="text-caption text-weight-medium q-mb-xs">Solo in SIM</div>
                  <div class="text-caption q-mb-sm">{{ simOnlySymbolsLabel }}</div>
                  <div class="text-caption text-weight-medium q-mb-xs">Solo in PAPER</div>
                  <div class="text-caption">{{ paperOnlySymbolsLabel }}</div>
                </q-card>
              </q-popup-proxy>
            </q-btn>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="text-subtitle2 q-mb-sm">Controlli Trade</div>
          <table class="quadratura-table">
            <thead>
              <tr>
                <th class="col-label"></th>
                <th class="col-baseline">SIM</th>
                <th class="col-delta">PAPER</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in quadratureRows" :key="row.key">
                <th>{{ row.label }}</th>
                <td class="col-baseline">
                  <q-btn flat dense no-caps class="metric-cell-btn" :label="String(formatQuadratureValue(row, row.sim))" @click="showMetricDetails('sim', row)" />
                </td>
                <td :class="['col-delta', metricCellClass(row, row.paper, row.sim)]">
                  <q-btn flat dense no-caps class="metric-cell-btn" :label="String(formatQuadratureValue(row, row.paper))" @click="showMetricDetails('paper', row)" /><span v-if="showRowDelta(row)" class="q-ml-xs delta-badge" :class="deltaSignClass(row.paper, row.sim)">{{ deltaLabel(row.paper, row.sim) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="text-h6">Coerenza Statistica</div>
        <div class="text-caption text-grey-7">
          Tre blocchi distinti: baseline storica, nuovi campioni della finestra selezionata, verifica di appartenenza statistica.
        </div>
      </q-card-section>

      <q-card-section>
        <q-card flat bordered class="coherence-panel">
          <q-card-section>
            <div class="text-subtitle2">Baseline</div>
            <div class="text-caption text-grey-7">
              Versione, ultimo calcolo e sorgenti usate per il confronto statistico.
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section v-if="baselineRecord" class="row q-col-gutter-sm">
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-7">Versione</div>
              <div class="text-body2">{{ baselineRecord.strategy_fingerprint }}</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-7">Match baseline</div>
              <div class="text-body2">{{ baselineMatchLabel }}</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-7">Calcolata</div>
              <div class="text-body2">{{ formatDateTime(baselineRecord.computed_at) }}</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="text-caption text-grey-7">Sample size</div>
              <div class="text-body2">{{ baselineRecord.sample_size ?? 0 }}</div>
            </div>
            <div class="col-6 col-md-6">
              <div class="text-caption text-grey-7">Params hash</div>
              <q-btn v-if="baselineRecord.params" flat dense no-caps color="primary" class="text-body2" label="Parametri"
                @click="copyParams(baselineRecord.params)">
                <q-tooltip>{{ JSON.stringify(baselineRecord.params, null, 2) }}</q-tooltip>
              </q-btn>
              <div v-else class="text-body2">NA</div>
            </div>
            <div class="col-12">
              <div class="text-caption text-grey-7">Source root</div>
              <div class="text-body2">{{ baselineRecord.source_meta?.source_root || 'non specificato' }}</div>
            </div>
            <div class="col-12">
              <div class="text-caption text-grey-7">Periodo baseline</div>
              <div class="text-body2">
                {{ formatDateTime(baselineRecord.source_meta?.source_period_start) }} →
                {{ formatDateTime(baselineRecord.source_meta?.source_period_end) }}
              </div>
            </div>
          </q-card-section>
          <q-card-section v-else>
            <q-banner dense rounded class="bg-grey-2 text-grey-8">
              {{ baselineStatusMessage }}
            </q-banner>
          </q-card-section>
          <q-card-section v-if="baselineRecord" class="row q-col-gutter-sm">
            <div class="col-6 col-md-4" v-for="card in baselineMetricCards" :key="card.label">
              <q-card flat bordered>
                <q-card-section>
                  <div class="text-caption text-grey-7">{{ card.label }}</div>
                  <div class="text-h6">{{ card.value }}</div>
                  <div v-if="card.caption" class="text-caption text-grey-7 q-mt-xs">{{ card.caption }}</div>
                </q-card-section>
              </q-card>
            </div>
          </q-card-section>
          <q-card-section v-if="baselineSideRows.length" class="row q-col-gutter-md">
            <div class="col-12 col-lg-6">
              <div class="text-subtitle2 q-mb-sm">Baseline per lato</div>
              <q-table flat dense :rows="baselineSideRows" :columns="baselineSideColumns" row-key="side" :pagination="{ rowsPerPage: 10 }" />
            </div>
            <div class="col-12 col-lg-6">
              <div class="text-subtitle2 q-mb-sm">Top symbol baseline</div>
              <q-table flat dense :rows="baselineSymbolRows" :columns="baselineSymbolColumns" row-key="symbol" :pagination="{ rowsPerPage: 10 }" />
            </div>
          </q-card-section>
          <q-card-section v-if="baselineDetailRows.length" class="row q-col-gutter-md">
            <div class="col-12 col-lg-6">
              <div class="text-subtitle2 q-mb-sm">Dettaglio baseline</div>
              <q-table flat dense :rows="baselineDetailRows" :columns="statDetailColumns" row-key="label" hide-pagination />
            </div>
            <div class="col-12 col-lg-6">
              <div class="text-subtitle2 q-mb-sm">Quantili baseline</div>
              <q-table flat dense :rows="baselineQuantileRows" :columns="quantileColumns" row-key="quantile" hide-pagination />
            </div>
          </q-card-section>
          <q-card-section v-if="baselineHistogramBars.length">
            <div class="text-subtitle2 q-mb-sm">Histogram baseline</div>
            <div class="histogram-grid">
              <div v-for="bar in baselineHistogramBars" :key="bar.key" class="histogram-bar-wrap">
                <div class="histogram-bar-label">{{ bar.label }}</div>
                <div class="histogram-bar-track">
                  <div class="histogram-bar-fill" :style="{ height: `${bar.height}%` }" />
                </div>
                <div class="histogram-bar-count">{{ bar.count }}</div>
              </div>
            </div>
            <div v-if="baselineQuantileRows.length" class="q-mt-md">
              <div class="text-caption text-grey-7 q-mb-sm">Quantili della baseline</div>
              <div class="quantile-inline-list">
                <div v-for="row in baselineQuantileRows" :key="`baseline-quantile-${row.quantile}`" class="quantile-inline-item">
                  <div class="text-body2 text-weight-medium">{{ row.quantile }}: {{ row.value }}</div>
                  <div class="text-caption text-grey-7">{{ row.meaning }}</div>
                </div>
              </div>
            </div>
          </q-card-section>
          <q-card-section v-if="baselineSourceManifestRows.length">
            <div class="text-subtitle2 q-mb-sm">Source manifest</div>
            <q-table flat dense :rows="baselineSourceManifestRows" :columns="baselineSourceManifestColumns" row-key="artifact_path" :pagination="{ rowsPerPage: 10 }" />
          </q-card-section>
          <q-separator />
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Calcolo baseline</div>
            <q-input v-model="baselineSourcePathsText" type="textarea" autogrow dense outlined label="Source paths" hint="Un path per riga. Ogni path può essere trades.json oppure una directory che lo contiene." />
            <q-input v-model="baselineSourceRoot" dense outlined label="Source root" class="q-mt-sm" />
            <div class="row q-col-gutter-sm q-mt-sm items-center">
              <div class="col-auto">
                <q-btn color="secondary" icon="analytics" label="Calcola baseline" :loading="isComputingBaseline" :disable="!canComputeBaseline || !baselineSourcePaths.length" @click="computeBaseline" />
              </div>
              <div class="col text-caption text-grey-7">
                Contesto: {{ baselineComputeContextLabel }}
              </div>
            </div>
            <div v-if="baselineJobStatus" class="q-mt-sm text-caption">
              Job baseline: <strong>{{ baselineJobStatus.status }}</strong>
              <span v-if="baselineJobStatus.error" class="text-negative"> · {{ baselineJobStatus.error }}</span>
            </div>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-section>
        <q-card flat bordered class="coherence-panel">
          <q-card-section>
            <div class="text-subtitle2">Statistiche Backtest / Simulazione + Paper / Live</div>
            <div class="text-caption text-grey-7">
              {{ selectedWindowSummary || 'Nessuna finestra selezionata' }}
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section class="row q-col-gutter-sm">
            <div class="col-6">
              <div class="text-caption text-grey-7">Run ID</div>
              <div class="text-body2 ellipsis">{{ coherenceRunId || 'NA' }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Fingerprint run</div>
              <div class="text-body2">{{ coherenceRunFingerprint || 'NA' }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Observed</div>
              <div class="text-body2">{{ coherenceSummary?.observed_mode || 'NA' }}</div>
            </div>
            <div class="col-6">
              <div class="text-caption text-grey-7">Reference</div>
              <div class="text-body2">{{ coherenceSummary?.reference_mode || 'NA' }}</div>
            </div>
          </q-card-section>
          <q-card-section class="row q-col-gutter-sm">
            <div class="col-12 col-md-6" v-for="sample in windowSampleCards" :key="sample.label">
              <q-card flat bordered>
                <q-card-section>
                  <div class="text-caption text-grey-7">{{ sample.label }}</div>
                  <div class="text-h6">{{ sample.tradeCount }}</div>
                  <div class="text-caption text-grey-7">trade nella finestra</div>
                  <div class="text-body2 q-mt-sm">Mean: {{ sample.mean }}</div>
                  <div class="text-body2">Median: {{ sample.median }}</div>
                  <div class="text-body2">Stddev: {{ sample.stddev }}</div>
                  <div class="text-body2">Win rate: {{ sample.winRate }}</div>
                  <div class="text-body2">Expectancy: {{ sample.expectancy }}</div>
                  <div class="text-body2">P/L totale %: {{ sample.pnlPercent }}</div>
                  <div class="text-body2">P/L totale: {{ sample.pnlTotal }}</div>
                  <div class="text-body2">Coverage: {{ sample.coverage }}</div>
                  <div class="text-caption text-grey-7 q-mt-sm">{{ sample.period }}</div>
                </q-card-section>
              </q-card>
            </div>
          </q-card-section>
          <q-card-section v-if="windowStatRows.length" class="row q-col-gutter-md">
            <div class="col-12 col-lg-6" v-for="sample in windowStatRows" :key="sample.label">
              <div class="text-subtitle2 q-mb-sm">{{ sample.label }}</div>
              <q-table flat dense :rows="sample.rows" :columns="statDetailColumns" row-key="label" hide-pagination />
            </div>
          </q-card-section>
          <q-card-section v-if="windowQuantileTables.length" class="row q-col-gutter-md">
            <div class="col-12 col-lg-6" v-for="sample in windowQuantileTables" :key="sample.label">
              <div class="text-subtitle2 q-mb-sm">Quantili {{ sample.label }}</div>
              <q-table flat dense :rows="sample.rows" :columns="quantileColumns" row-key="quantile" hide-pagination />
            </div>
          </q-card-section>
          <q-card-section v-if="windowSampleSideRows.length" class="row q-col-gutter-md">
            <div class="col-12">
              <div class="text-subtitle2 q-mb-sm">Breakdown finestra per lato</div>
              <q-table flat dense :rows="windowSampleSideRows" :columns="windowSampleSideColumns" row-key="key" :pagination="{ rowsPerPage: 10 }" />
            </div>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-section>
        <q-card flat bordered class="coherence-panel">
          <q-card-section>
            <div class="text-subtitle2">Confronto / Verifica Statistica</div>
            <div class="text-caption text-grey-7">
              Verifica di appartenenza alla distribuzione storica di baseline per `SIM/BACKTEST` e `PAPER/LIVE`, più confronto diagnostico tra i due nuovi campioni.
            </div>
          </q-card-section>
          <q-separator />
          <q-card-section v-if="comparisonSections.length" class="row q-col-gutter-md">
            <div class="col-12 col-lg-4" v-for="section in comparisonSections" :key="section.label">
              <div class="text-subtitle2 q-mb-sm">{{ section.label }}</div>
              <q-table flat dense :rows="section.rows" :columns="statDetailColumns" row-key="label" hide-pagination />
            </div>
          </q-card-section>
        </q-card>
      </q-card-section>

      <q-card-section v-if="coherenceDiagnosis.length">
        <div class="text-subtitle2 q-mb-sm">Diagnosi Guidata</div>
        <q-list bordered separator>
          <q-item v-for="item in coherenceDiagnosis" :key="`${item.title}-${item.message}`">
            <q-item-section avatar>
              <q-icon :name="coherenceSeverityIcon(item.severity)" :color="coherenceSeverityColor(item.severity)" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ item.title }}</q-item-label>
              <q-item-label caption>{{ item.message }}</q-item-label>
              <div v-if="item.indicators?.length" class="diagnosis-indicators q-mt-sm">
                <div v-for="indicator in item.indicators" :key="`${item.title}-${indicator.label}`" class="diagnosis-indicator">
                  <div class="text-caption text-grey-7">{{ indicator.label }}</div>
                  <div class="text-body2">{{ indicator.value }}</div>
                </div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section v-else class="text-caption text-grey-7">
        {{ coherenceSummary?.reason || factsheet?.reason || 'Coerenza statistica non disponibile per la finestra selezionata.' }}
      </q-card-section>
    </q-card>

    <q-card flat bordered class="q-mt-lg">
      <q-card-section>
        <div class="text-h6">Persisted Runs</div>
        <div class="text-caption text-grey-7">Storico run persistito su database</div>
      </q-card-section>
      <q-table
        :rows="runs"
        :columns="runColumns"
        row-key="run_id"
        flat
        :pagination="{ rowsPerPage: 20 }"
      >
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="statusColor(props.row.status)">{{ props.row.status }}</q-badge>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat dense icon="info" @click="showRun(props.row.run_id)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="showDialog">
      <q-card style="min-width: 70vw; max-width: 90vw;">
        <q-card-section class="row items-center">
          <div class="text-h6">Run Detail {{ selectedRun?.run_id }}</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <pre class="detail-pre">{{ prettySelected }}</pre>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showMetricDialog">
      <q-card style="min-width: 70vw; max-width: 90vw;">
        <q-card-section class="row items-center">
          <div>
            <div class="text-h6">{{ metricDialogTitle }}</div>
            <div class="text-caption text-grey-7">{{ metricDialogSubtitle }}</div>
          </div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="!metricDialogRows.length" class="text-caption text-grey-7">
            Nessun dettaglio disponibile per questo numero.
          </div>
          <q-table
            v-else
            :rows="metricDialogRows"
            :columns="metricDialogColumns"
            row-key="__row_id"
            flat
            :pagination="{ rowsPerPage: 15 }"
          />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { constants } from 'boot/constants'
import { Notify } from 'quasar'

export default defineComponent({
  name: 'WatchtowerPage',
  setup() {
    const runs = ref([])
    const watchtower = ref([])
    const watchtowerOverview = ref(null)
    const watchdog = ref([])
    const factsheet = ref(null)
    const coherenceSummary = ref(null)
    const baselineCatalog = ref([])
    const watchtowerWindows = ref([])
    const selectedWindowOpen = ref(null)
    const portfolioContexts = ref([])
    const selectedPortfolioKeyId = ref(null)
    const portfolioSession = ref(null)
    const selectedRun = ref(null)
    const showDialog = ref(false)
    const showMetricDialog = ref(false)
    const metricDialogState = ref({ title: '', subtitle: '', rows: [] })
    const openNonExecutedExpanded = ref(false)
    const openExecutedExpanded = ref(false)
    const isRefreshing = ref(false)
    const isRebuilding = ref(false)
    const isSyncingAlpaca = ref(false)
    const isExportingBars = ref(false)
    const alpacaSyncStatus = ref(null)
    const alpacaSyncPollTimer = ref(null)
    const lastRefreshAt = ref(null)
    const baselineSourcePathsText = ref('/home/htpc/backtrader/out/intraday/HMA/trades.json')
    const baselineSourceRoot = ref('/home/htpc/backtrader/out/intraday/HMA')
    const isComputingBaseline = ref(false)
    const baselineJobStatus = ref(null)

    const copyParams = async (params) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(params || {}, null, 2))
        Notify.create({ type: 'positive', message: 'Parametri copiati' })
      } catch {
        Notify.create({ type: 'negative', message: 'Copia non disponibile nel browser' })
      }
    }

    const runColumns = [
      { name: 'run_id', label: 'Run ID', field: 'run_id', align: 'left', sortable: true },
      { name: 'run_type', label: 'Type', field: 'run_type', align: 'left', sortable: true },
      { name: 'strategy', label: 'Strategy', field: 'strategy', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left', sortable: true },
      { name: 'strategy_fingerprint', label: 'Fingerprint', field: 'strategy_fingerprint', align: 'left' },
      { name: 'updated_at', label: 'Updated', field: 'updated_at', align: 'left', sortable: true },
      { name: 'actions', label: '', field: 'actions', align: 'center' }
    ]

    const groupColumns = [
      { name: 'key', label: 'Chiave', field: 'key', align: 'left' },
      { name: 'count', label: 'Count', field: 'count', align: 'right' }
    ]

    const integrityDetailColumns = [
      { name: 'symbol', label: 'Simbolo', field: 'symbol', align: 'left', sortable: true },
      { name: 'observed_action', label: 'Paper', field: 'observed_action', align: 'left', sortable: true },
      { name: 'observed_status', label: 'Stato', field: 'observed_status', align: 'left', sortable: true },
      { name: 'reference_action', label: 'Sim', field: 'reference_action', align: 'left', sortable: true },
      { name: 'reference_context_action', label: 'Contesto', field: 'reference_context_action', align: 'left', sortable: true },
      { name: 'diagnostic_label', label: 'Discrepanza', field: 'diagnostic_label', align: 'left', sortable: true },
      { name: 'observed_reason', label: 'Reason', field: 'observed_reason', align: 'left', sortable: true },
      { name: 'bar_start', label: 'Inizio barra', field: 'bar_start', align: 'left', sortable: true },
      { name: 'price', label: 'Prezzo', field: 'price', align: 'right' },
      { name: 'reference_examples', label: 'Riferimento', field: (row) => (row.reference_examples || []).join(' | '), align: 'left' },
      { name: 'occurrence_count', label: 'Occorrenze', field: 'occurrence_count', align: 'right' },
      { name: 'last_seen_at', label: 'Ultimo seen', field: 'last_seen_at', align: 'left' }
    ]

    const integrityHistoryColumns = [
      { name: 'created_at', label: 'At', field: 'created_at', align: 'left', sortable: true },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'warning_count', label: 'Warning', field: 'warning_count', align: 'right' },
      { name: 'matched_signal_ids', label: 'Matched', field: 'matched_signal_ids', align: 'right' },
      { name: 'observed_orders', label: 'Observed', field: 'observed_orders', align: 'right' },
      { name: 'reference_orders', label: 'Reference', field: 'reference_orders', align: 'right' }
    ]

    const watchdogColumns = [
      { name: 'run_id', label: 'Run ID', field: 'run_id', align: 'left' },
      { name: 'status', label: 'Status', field: 'status', align: 'left' },
      { name: 'confidence', label: 'Confidence', field: 'confidence', align: 'left' },
      { name: 'score', label: 'Score', field: 'score', align: 'left' },
      { name: 'checked_at', label: 'At', field: 'checked_at', align: 'left' }
    ]
    const factsheetColumns = [
      { name: 'group', label: 'Gruppo', field: (row) => factsheetGroupLabel(row.group), align: 'left' },
      { name: 'sample_size', label: 'N', field: 'sample_size', align: 'right' },
      { name: 'win_rate', label: 'Win %', field: 'win_rate', align: 'right' },
      { name: 'expectancy', label: 'Expected %', field: (row) => formatPercentValue(row.expectancy), align: 'right' },
      { name: 'median', label: 'Median %', field: (row) => formatPercentValue(row.median), align: 'right' },
      { name: 'avg_win', label: 'Avg Win %', field: (row) => formatPercentValue(row.avg_win), align: 'right' },
      { name: 'avg_loss', label: 'Avg Loss %', field: (row) => formatPercentValue(row.avg_loss), align: 'right' },
      { name: 'pnl_amount_total', label: 'PnL Tot', field: (row) => formatAmount(row.pnl_amount_total), align: 'right' },
      { name: 'profit_factor', label: 'PF', field: (row) => formatNumber(row.profit_factor, 2), align: 'right' },
      { name: 'skewness', label: 'Skew', field: (row) => formatNumber(row.skewness, 3), align: 'right' }
    ]
    const factsheetQuadratureColumns = [
      { name: 'mode', label: 'Lato', field: 'mode', align: 'left' },
      { name: 'open_submitted', label: 'Open inviate', field: 'open_submitted', align: 'right' },
      { name: 'open_completed', label: 'Open eseguite', field: 'open_completed', align: 'right' },
      { name: 'open_canceled_timeout', label: 'Open cancel timeout', field: 'open_canceled_timeout', align: 'right' },
      { name: 'open_canceled_signal_edge', label: 'Open cancel signal', field: 'open_canceled_signal_edge', align: 'right' },
      { name: 'open_rejected', label: 'Open rejected', field: 'open_rejected', align: 'right' },
      { name: 'open_margin', label: 'Open margin', field: 'open_margin', align: 'right' },
      { name: 'close_submitted', label: 'Close inviate', field: 'close_submitted', align: 'right' },
      { name: 'close_completed', label: 'Close eseguite', field: 'close_completed', align: 'right' },
      { name: 'close_canceled', label: 'Close canceled', field: 'close_canceled', align: 'right' },
      { name: 'close_rejected', label: 'Close rejected', field: 'close_rejected', align: 'right' },
      { name: 'close_margin', label: 'Close margin', field: 'close_margin', align: 'right' },
      { name: 'trade_reconstructed', label: 'Trade ricostruiti', field: 'trade_reconstructed', align: 'right' },
      { name: 'open_unmatched', label: 'Open non abbinabili', field: 'open_unmatched', align: 'right' },
      { name: 'close_multi_open', label: 'Close multi-open', field: 'close_multi_open', align: 'right' },
      { name: 'trade_ambiguous', label: 'Trade ambigui', field: 'trade_ambiguous', align: 'right' },
      { name: 'trade_non_reconstructed', label: 'Trade non ricostruiti', field: 'trade_non_reconstructed', align: 'right' },
      { name: 'final_inventory_nonzero_symbols', label: 'Inventory finale != 0', field: 'final_inventory_nonzero_symbols', align: 'right' },
      { name: 'open_close_delta', label: 'Delta open-close', field: 'open_close_delta', align: 'right' },
      { name: 'open_consecutive_2', label: '2 open consecutive', field: 'open_consecutive_2', align: 'right' },
      { name: 'open_consecutive_3', label: '3 open consecutive', field: 'open_consecutive_3', align: 'right' },
      { name: 'open_consecutive_max', label: 'Max open consecutive', field: 'open_consecutive_max', align: 'right' },
      { name: 'final_inventory_nonzero_sample', label: 'Sample inventory', field: 'final_inventory_nonzero_sample', align: 'left' }
    ]
    const baselineSideColumns = [
      { name: 'side', label: 'Lato', field: 'side', align: 'left' },
      { name: 'sample_size', label: 'N', field: 'sample_size', align: 'right' },
      { name: 'win_rate', label: 'Win %', field: (row) => formatPercentile(row.win_rate), align: 'right' },
      { name: 'expectancy', label: 'Expected %', field: (row) => formatPercentValue(row.expectancy), align: 'right' },
      { name: 'median', label: 'Median %', field: (row) => formatPercentValue(row.median), align: 'right' },
      { name: 'profit_factor', label: 'PF', field: (row) => formatNumber(row.profit_factor, 2), align: 'right' }
    ]
    const baselineSymbolColumns = [
      { name: 'symbol', label: 'Symbol', field: 'symbol', align: 'left' },
      { name: 'sample_size', label: 'N', field: 'sample_size', align: 'right' },
      { name: 'mean', label: 'Mean %', field: (row) => formatPercentValue(row.mean), align: 'right' },
      { name: 'win_rate', label: 'Win %', field: (row) => formatPercentile(row.win_rate), align: 'right' },
      { name: 'sum', label: 'Tot %', field: (row) => formatPercentValue(row.sum), align: 'right' }
    ]
    const windowSampleSideColumns = [
      { name: 'label', label: 'Campione', field: 'label', align: 'left' },
      { name: 'side', label: 'Lato', field: 'side', align: 'left' },
      { name: 'sample_size', label: 'N', field: 'sample_size', align: 'right' },
      { name: 'win_rate', label: 'Win %', field: (row) => formatPercentile(row.win_rate), align: 'right' },
      { name: 'expectancy', label: 'Expected %', field: (row) => formatPercentValue(row.expectancy), align: 'right' },
      { name: 'median', label: 'Median %', field: (row) => formatPercentValue(row.median), align: 'right' }
    ]
    const statDetailColumns = [
      { name: 'label', label: 'Metrica', field: 'label', align: 'left' },
      { name: 'value', label: 'Valore', field: 'value', align: 'right' }
    ]
    const quantileColumns = [
      { name: 'quantile', label: 'Quantile', field: 'quantile', align: 'left' },
      { name: 'meaning', label: 'Significato', field: 'meaning', align: 'left' },
      { name: 'value', label: 'Valore', field: 'value', align: 'right' }
    ]
    const baselineSourceManifestColumns = [
      { name: 'artifact_path', label: 'Artifact', field: 'artifact_path', align: 'left' },
      { name: 'trade_count', label: 'Trade', field: 'trade_count', align: 'right' },
      { name: 'closed_at_min', label: 'Da', field: 'closed_at_min', align: 'left' },
      { name: 'closed_at_max', label: 'A', field: 'closed_at_max', align: 'left' }
    ]
    const metricDialogColumns = computed(() => {
      const sample = metricDialogState.value.rows?.[0] || {}
      return Object.keys(sample)
        .filter((key) => key !== '__row_id')
        .map((key) => ({
          name: key,
          label: key.replace(/_/g, ' '),
          field: key,
          align: typeof sample[key] === 'number' ? 'right' : 'left'
        }))
    })
    const metricDialogTitle = computed(() => metricDialogState.value.title || 'Dettaglio')
    const metricDialogSubtitle = computed(() => metricDialogState.value.subtitle || '')
    const metricDialogRows = computed(() => (
      (metricDialogState.value.rows || []).map((row, index) => ({ __row_id: index, ...row }))
    ))

    const prettySelected = computed(() => JSON.stringify(selectedRun.value || {}, null, 2))
    const windowOptions = computed(() => (
      watchtowerWindows.value.map((window) => ({
        label: formatWindowOption(window),
        value: window.window_open
      }))
    ))
    const selectedWindowMeta = computed(() => (
      watchtowerWindows.value.find((window) => window.window_open === selectedWindowOpen.value) || null
    ))
    const selectedWindowSummary = computed(() => (
      selectedWindowMeta.value ? formatWindowSummary(selectedWindowMeta.value) : ''
    ))
    const portfolioOptions = computed(() => (
      ((portfolioContexts.value || []).map((row) => ({
        label: `${row.display_name || row.portfolio_key_id} · ${row.chain_run_count || 0} run`,
        value: row.portfolio_key_id
      })))
    ))
    const selectedPortfolioContext = computed(() => (
      (portfolioContexts.value || []).find((row) => row.portfolio_key_id === selectedPortfolioKeyId.value) || null
    ))
    const selectedPortfolioSummary = computed(() => {
      const session = portfolioSession.value
      if (session?.portfolio_display_name) {
        return `${session.portfolio_display_name} · ${session.chain_run_count || 0} run nella finestra`
      }
      const context = selectedPortfolioContext.value
      if (context?.display_name) {
        return `${context.display_name} · ${context.chain_run_count || 0} run nella finestra`
      }
      return ''
    })
    const watchtowerLatest = computed(() => watchtower.value?.[0] || null)
    const integrityTotals = computed(() => watchtowerOverview.value?.totals || {})
    const integrityGroups = computed(() => watchtowerOverview.value?.groups || {
      by_summary: []
    })
    const integrityDetails = computed(() => watchtowerOverview.value?.warning_details || [])
    const integrityHistory = computed(() => watchtowerOverview.value?.history || [])
    const integrityMetricCards = computed(() => [
      {
        label: 'Warning',
        value: `${integrityTotals.value.warning_count ?? 0} (${(((integrityTotals.value.warning_count ?? 0) / Math.max(integrityTotals.value.observed_orders ?? 0, 1)) * 100).toFixed(1)}%)`
      },
      {
        label: 'Matched',
        value: `${integrityTotals.value.matched_signal_ids ?? 0} (${(((integrityTotals.value.matched_signal_ids ?? 0) / Math.max(integrityTotals.value.observed_orders ?? 0, 1)) * 100).toFixed(1)}%)`
      },
      {
        label: 'Observed',
        value: `${integrityTotals.value.observed_orders ?? 0} (${(((integrityTotals.value.observed_orders ?? 0) / Math.max(integrityTotals.value.reference_orders ?? 0, 1)) * 100).toFixed(1)}%)`
      },
      { label: 'Reference', value: integrityTotals.value.reference_orders ?? 0 }
    ])
    const quadratureRowsByMode = computed(() => {
      const rows = factsheet.value?.quadrature_rows || []
      const out = {}
      for (const row of rows) {
        out[row.mode] = row
      }
      return out
    })
    const emptyOperationRow = {
      open_submitted: 0,
      open_accepted: 0,
      open_completed: 0,
      open_rejected: 0,
      open_canceled: 0,
      open_canceled_timeout: 0,
      open_canceled_signal_edge: 0,
      open_margin: 0,
      close_submitted: 0,
      close_accepted: 0,
      close_completed: 0,
      close_rejected: 0,
      close_canceled: 0,
      close_margin: 0,
      trade_reconstructed: 0,
      open_unmatched: 0,
      close_multi_open: 0,
      trade_ambiguous: 0,
      trade_non_reconstructed: 0,
      final_inventory_nonzero_symbols: 0,
      open_close_delta: 0,
      open_consecutive_2: 0,
      open_consecutive_3: 0,
      open_consecutive_max: 0,
      open_consecutive_runs: {}
    }
    const paperOperationRow = computed(() => (
      quadratureRowsByMode.value.paper
      || quadratureRowsByMode.value.live
      || emptyOperationRow
    ))
    const simOperationRow = computed(() => (
      quadratureRowsByMode.value.backtest
      || quadratureRowsByMode.value.shadow
      || quadratureRowsByMode.value.sim
      || emptyOperationRow
    ))
    const alpacaOperationRow = computed(() => (
      quadratureRowsByMode.value.alpaca
      || emptyOperationRow
    ))
    const paperSignalSymbols = computed(() => paperOperationRow.value.signal_symbols || [])
    const simSignalSymbols = computed(() => simOperationRow.value.signal_symbols || [])
    const paperOnlySymbols = computed(() => (
      paperSignalSymbols.value.filter((symbol) => !simSignalSymbols.value.includes(symbol))
    ))
    const simOnlySymbols = computed(() => (
      simSignalSymbols.value.filter((symbol) => !paperSignalSymbols.value.includes(symbol))
    ))
    const assetDeltaSummary = computed(() => (
      `${simOnlySymbols.value.length} solo SIM / ${paperOnlySymbols.value.length} solo PAPER`
    ))
    const assetDeltaColor = computed(() => (
      simOnlySymbols.value.length || paperOnlySymbols.value.length ? 'warning' : 'positive'
    ))
    const simOnlySymbolsLabel = computed(() => simOnlySymbols.value.length ? simOnlySymbols.value.join(', ') : 'nessuno')
    const paperOnlySymbolsLabel = computed(() => paperOnlySymbols.value.length ? paperOnlySymbols.value.join(', ') : 'nessuno')
    const summarizeOpenNonExecuted = (row) => (
      Number(row?.open_canceled || 0)
      + Number(row?.open_rejected || 0)
      + Number(row?.open_margin || 0)
    )
    const summarizeOpenExecuted = (row) => (
      Number(row?.open_completed || 0)
      + Number(row?.open_partial || 0)
    )
    const summarizeCloseResidual = (row) => (
      Number(row?.open_completed || 0) - Number(row?.close_completed || 0)
    )
    const summarizeOpenExpectedExecuted = (row) => (
      Number(row?.open_submitted || 0) - summarizeOpenNonExecuted(row)
    )
    const summarizeOpenAccountingDelta = (row) => (
      Number(row?.open_completed || 0) - summarizeOpenExpectedExecuted(row)
    )
    // --- Helper delta ---
    const deltaLabel = (value, anchor) => {
      if (value == null || anchor == null) return ''
      const d = value - anchor
      if (d === 0) return ''
      return d > 0 ? `+${d}` : `${d}`
    }
    const deltaCellClass = (value, anchor) => {
      if (value == null || anchor == null) return ''
      return value === anchor ? '' : 'cell-delta-warn'
    }
    const deltaSignClass = (value, anchor) => {
      if (value == null || anchor == null) return ''
      const d = value - anchor
      if (d === 0) return ''
      return d > 0 ? 'text-positive' : 'text-negative'
    }

    // --- Righe quadratura conteggi ---
    const openSummaryRows = computed(() => [
      { key: 'submitted', label: 'Pending (barra invio)', sim: simOperationRow.value.open_submitted, paper: paperOperationRow.value.open_submitted, alpaca: alpacaOperationRow.value.open_submitted },
      { key: 'non_executed', label: 'Non eseguite', sim: summarizeOpenNonExecuted(simOperationRow.value), paper: summarizeOpenNonExecuted(paperOperationRow.value), alpaca: summarizeOpenNonExecuted(alpacaOperationRow.value) },
      { key: 'open_executed', label: 'Eseguite', sim: summarizeOpenExecuted(simOperationRow.value), paper: summarizeOpenExecuted(paperOperationRow.value), alpaca: summarizeOpenExecuted(alpacaOperationRow.value) },
      { key: 'accounting_delta', label: 'Quadratura contabile', sim: summarizeOpenAccountingDelta(simOperationRow.value), paper: summarizeOpenAccountingDelta(paperOperationRow.value), alpaca: summarizeOpenAccountingDelta(alpacaOperationRow.value), emphasizeNonZero: true },
    ])
    const openDetailRows = computed(() => [
      { key: 'canceled_total', label: 'Cancellate totali', sim: simOperationRow.value.open_canceled, paper: paperOperationRow.value.open_canceled, alpaca: alpacaOperationRow.value.open_canceled },
      { key: 'rejected', label: 'Rifiutate', sim: simOperationRow.value.open_rejected, paper: paperOperationRow.value.open_rejected, alpaca: alpacaOperationRow.value.open_rejected },
      { key: 'margin', label: 'Margin', sim: simOperationRow.value.open_margin, paper: paperOperationRow.value.open_margin, alpaca: alpacaOperationRow.value.open_margin },
      { key: 'canceled_ttl', label: 'Cancellate TTL', sim: simOperationRow.value.open_canceled_timeout, paper: paperOperationRow.value.open_canceled_timeout, alpaca: alpacaOperationRow.value.open_canceled_timeout },
      { key: 'canceled_edge', label: 'Cancellate signal edge', sim: simOperationRow.value.open_canceled_signal_edge, paper: paperOperationRow.value.open_canceled_signal_edge, alpaca: alpacaOperationRow.value.open_canceled_signal_edge },
    ])
    const openExecutedDetailRows = computed(() => [
      { key: 'open_completed', label: 'Filled / Completed', sim: simOperationRow.value.open_completed, paper: paperOperationRow.value.open_completed, alpaca: alpacaOperationRow.value.open_completed },
      { key: 'open_partial', label: 'Partial', sim: simOperationRow.value.open_partial || 0, paper: paperOperationRow.value.open_partial || 0, alpaca: alpacaOperationRow.value.open_partial || 0 },
    ])
    const closeSummaryRows = computed(() => [
      { key: 'submitted', label: 'Pending (barra invio)', sim: simOperationRow.value.close_submitted, paper: paperOperationRow.value.close_submitted, alpaca: alpacaOperationRow.value.close_submitted },
      { key: 'initial_flatten_close_completed', label: 'Flat iniziale', sim: simOperationRow.value.initial_flatten_close_completed || 0, paper: paperOperationRow.value.initial_flatten_close_completed || 0, alpaca: alpacaOperationRow.value.initial_flatten_close_completed || 0 },
      { key: 'completed', label: 'Eseguite', sim: simOperationRow.value.close_completed, paper: paperOperationRow.value.close_completed, alpaca: alpacaOperationRow.value.close_completed },
      { key: 'residual_vs_open', label: 'Residuo vs open eseguite', sim: summarizeCloseResidual(simOperationRow.value), paper: summarizeCloseResidual(paperOperationRow.value), alpaca: summarizeCloseResidual(alpacaOperationRow.value) },
      { key: 'canceled', label: 'Cancellate', sim: simOperationRow.value.close_canceled, paper: paperOperationRow.value.close_canceled, alpaca: alpacaOperationRow.value.close_canceled },
      { key: 'inventory_end', label: 'Inventory finale ≠ 0', sim: simOperationRow.value.final_inventory_nonzero_symbols, paper: paperOperationRow.value.final_inventory_nonzero_symbols, alpaca: alpacaOperationRow.value.final_inventory_nonzero_symbols },
    ])
    const exposureRows = computed(() => [
      { key: 'max_gross_exposure_abs', label: 'Esposizione massima |abs|', sim: simOperationRow.value.max_gross_exposure_abs, paper: paperOperationRow.value.max_gross_exposure_abs, alpaca: alpacaOperationRow.value.max_gross_exposure_abs, format: 'amount' },
      { key: 'max_open_symbols', label: 'Max asset aperti in simultanea', sim: simOperationRow.value.max_open_symbols, paper: paperOperationRow.value.max_open_symbols, alpaca: alpacaOperationRow.value.max_open_symbols },
      { key: 'signal_symbols_count', label: 'Asset con segnali', sim: simOperationRow.value.signal_symbols_count, paper: paperOperationRow.value.signal_symbols_count, alpaca: alpacaOperationRow.value.signal_symbols_count },
      { key: 'inventory_nonzero', label: 'Asset aperti a fine sessione (ricostruiti)', sim: simOperationRow.value.final_inventory_nonzero_symbols, paper: paperOperationRow.value.final_inventory_nonzero_symbols, alpaca: alpacaOperationRow.value.final_inventory_nonzero_symbols },
    ])
    const quadratureRows = computed(() => [
      { key: 'trade_reconstructed',          label: 'Trade ricostruiti',         sim: simOperationRow.value.trade_reconstructed,          paper: paperOperationRow.value.trade_reconstructed },
      { key: 'open_unmatched',               label: 'Open non abbinabili',       sim: simOperationRow.value.open_unmatched,               paper: paperOperationRow.value.open_unmatched, emphasizeNonZero: true },
      { key: 'close_multi_open',             label: 'Close multi-open',          sim: simOperationRow.value.close_multi_open,             paper: paperOperationRow.value.close_multi_open, emphasizeNonZero: true },
      { key: 'trade_ambiguous',              label: 'Trade ambigui',             sim: simOperationRow.value.trade_ambiguous,              paper: paperOperationRow.value.trade_ambiguous, emphasizeNonZero: true },
      { key: 'trade_non_reconstructed',      label: 'Trade non ricostruiti',     sim: simOperationRow.value.trade_non_reconstructed,      paper: paperOperationRow.value.trade_non_reconstructed, emphasizeNonZero: true },
      { key: 'reconstructed_trade_avg_pnl',  label: 'P/L medio trade ricostruiti', sim: simOperationRow.value.reconstructed_trade_avg_pnl, paper: paperOperationRow.value.reconstructed_trade_avg_pnl, format: 'amount' },
      { key: 'reconstructed_trade_pnl_variance', label: 'Varianza P/L trade ricostruiti', sim: simOperationRow.value.reconstructed_trade_pnl_variance, paper: paperOperationRow.value.reconstructed_trade_pnl_variance, format: 'amount' },
      { key: 'final_inventory_nonzero',      label: 'Inventory finale ≠ 0',     sim: simOperationRow.value.final_inventory_nonzero_symbols, paper: paperOperationRow.value.final_inventory_nonzero_symbols, emphasizeNonZero: true },
      { key: 'open_close_delta',             label: 'Delta open-close',          sim: simOperationRow.value.open_close_delta,             paper: paperOperationRow.value.open_close_delta, emphasizeNonZero: true },
      { key: 'open_consecutive_2',           label: '2 open consecutive',        sim: simOperationRow.value.open_consecutive_2,           paper: paperOperationRow.value.open_consecutive_2, emphasizeNonZero: true },
      { key: 'open_consecutive_3',           label: '3 open consecutive',        sim: simOperationRow.value.open_consecutive_3,           paper: paperOperationRow.value.open_consecutive_3, emphasizeNonZero: true },
      { key: 'open_consecutive_max',         label: 'Max open consecutive',      sim: simOperationRow.value.open_consecutive_max,         paper: paperOperationRow.value.open_consecutive_max, emphasizeNonZero: true },
    ])

    const factsheetRows = computed(() => factsheet.value?.performance_rows || [])
    const factsheetQuadratureRows = computed(() => factsheet.value?.quadrature_rows || [])
    const baselineStatus = computed(() => {
      if (coherenceSummary.value?.baseline_status?.baseline) return coherenceSummary.value?.baseline_status?.status || 'ok'
      return baselineCatalog.value.length ? 'ok' : (coherenceSummary.value?.baseline_status?.status || 'unresolved')
    })
    const baselineRecord = computed(() => (
      coherenceSummary.value?.baseline_status?.baseline
      || baselineCatalog.value?.[0]
      || null
    ))
    const baselineMatchMode = computed(() => (
      coherenceSummary.value?.baseline_status?.match_mode
      || (baselineCatalog.value.length ? 'default_latest' : '')
    ))
    const baselineMetrics = computed(() => baselineRecord.value?.metrics || {})
    const windowStats = computed(() => coherenceSummary.value?.window_stats || {})
    const coherenceRunId = computed(() => coherenceSummary.value?.run_id || '')
    const coherenceRunFingerprint = computed(() => coherenceSummary.value?.run?.strategy_fingerprint || '')
    const coherenceRunStrategy = computed(() => coherenceSummary.value?.run?.strategy || '')
    const coherenceRunParams = computed(() => coherenceSummary.value?.run?.params || {})
    const baselineSourcePaths = computed(() => (
      String(baselineSourcePathsText.value || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)
    ))
    const canComputeBaseline = computed(() => true)
    const baselineComputeContextLabel = computed(() => {
      if (coherenceRunStrategy.value && coherenceRunFingerprint.value) {
        return `${coherenceRunStrategy.value} · ${coherenceRunFingerprint.value}`
      }
      return 'derivato dai file sorgente'
    })
    const baselineStatusMessage = computed(() => {
      switch (baselineStatus.value) {
        case 'ok':
          return 'Baseline compatibile disponibile.'
        case 'baseline_missing':
          return 'Nessuna baseline compatibile con la strategia/versione selezionata.'
        case 'baseline_context_missing':
          return 'Contesto baseline non risolto. Usa la strategia/versione o derivala dai file storici.'
        case 'run_version_missing':
          return 'La strategia in osservazione non espone una fingerprint valida.'
        default:
          return 'Baseline non risolta.'
      }
    })
    const baselineMatchLabel = computed(() => {
      switch (baselineMatchMode.value) {
        case 'exact':
          return 'Esatto'
        case 'strategy_fallback':
          return 'Fallback strategia'
        case 'default_latest':
          return 'Ultima disponibile'
        default:
          return baselineRecord.value ? 'Disponibile' : 'NA'
      }
    })
    const baselineMetricCards = computed(() => {
      const metrics = baselineMetrics.value || {}
      const duration = metrics.duration_bars || {}
      return [
        { label: 'Mean', value: formatPercentValue(metrics.mean) },
        { label: 'Median', value: formatPercentValue(metrics.median) },
        { label: 'Stddev', value: formatPercentValue(metrics.stddev) },
        { label: 'MAD', value: formatPercentValue(metrics.mad) },
        { label: 'Win rate', value: formatPercentile(metrics.win_rate) },
        { label: 'Expectancy', value: formatPercentValue(metrics.expectancy) },
        { label: 'Profit factor', value: formatNumber(metrics.profit_factor, 2) },
        { label: 'Avg win / loss', value: `${formatPercentValue(metrics.avg_win)} / ${formatPercentValue(metrics.avg_loss)}` },
        { label: 'Durata media', value: formatNumber(duration.mean, 2), caption: `mediana ${formatNumber(duration.median, 2)} barre` },
        { label: 'Quantili', value: `${formatPercentValue(metrics.quantiles?.p05)} · ${formatPercentValue(metrics.quantiles?.p95)}`, caption: 'P05 · P95' }
      ]
    })
    const baselineDetailRows = computed(() => {
      const metrics = baselineMetrics.value || {}
      const duration = metrics.duration_bars || {}
      return [
        { label: 'Sample size', value: formatInteger(metrics.sample_size ?? baselineRecord.value?.sample_size) },
        { label: 'Mean', value: formatPercentValue(metrics.mean) },
        { label: 'Median', value: formatPercentValue(metrics.median) },
        { label: 'Stddev', value: formatPercentValue(metrics.stddev) },
        { label: 'MAD', value: formatPercentValue(metrics.mad) },
        { label: 'Win rate', value: formatPercentile(metrics.win_rate) },
        { label: 'Expectancy', value: formatPercentValue(metrics.expectancy) },
        { label: 'Average win', value: formatPercentValue(metrics.avg_win) },
        { label: 'Average loss', value: formatPercentValue(metrics.avg_loss) },
        { label: 'Profit factor', value: formatNumber(metrics.profit_factor, 2) },
        { label: 'Computed timestamp', value: formatDateTime(baselineRecord.value?.computed_at) },
        { label: 'Duration mean', value: formatNumber(duration.mean, 2) },
        { label: 'Duration median', value: formatNumber(duration.median, 2) },
        { label: 'Duration stddev', value: formatNumber(duration.stddev, 2) },
        { label: 'Duration MAD', value: formatNumber(duration.mad, 2) }
      ]
    })
    const baselineQuantileRows = computed(() => {
      const quantiles = baselineMetrics.value?.quantiles || {}
      const labels = {
        p05: 'Il 5% dei trade chiude sotto questo valore',
        p25: 'Il 25% dei trade chiude sotto questo valore',
        p50: 'Mediana: metà trade sotto, metà sopra',
        p75: 'Il 75% dei trade chiude sotto questo valore',
        p95: 'Il 95% dei trade chiude sotto questo valore'
      }
      return Object.entries(quantiles).map(([quantile, value]) => ({
        quantile,
        meaning: labels[quantile] || '',
        value: formatPercentValue(value)
      }))
    })
    const baselineHistogramBars = computed(() => {
      const rows = baselineMetrics.value?.histogram || []
      const maxCount = Math.max(...rows.map((row) => Number(row.count || 0)), 0)
      return rows.map((row, index) => ({
        key: `${index}-${row.start}-${row.end}`,
        label: `${formatPercentValue(row.start, 2)}\n${formatPercentValue(row.end, 2)}`,
        count: formatInteger(row.count),
        height: maxCount > 0 ? Math.max(1, Math.sqrt(Number(row.count || 0) / maxCount) * 100) : 0
      }))
    })
    const baselineSourceManifestRows = computed(() => (
      (baselineRecord.value?.source_meta?.source_manifest || []).map((row) => ({
        artifact_path: row.artifact_path || row.input_path || 'NA',
        trade_count: formatInteger(row.trade_count),
        closed_at_min: formatDateTime(row.closed_at_min),
        closed_at_max: formatDateTime(row.closed_at_max)
      }))
    ))
    const baselineSideRows = computed(() => (
      Object.entries(baselineMetrics.value?.by_side || {}).map(([side, stats]) => ({
        side,
        ...(stats || {})
      }))
    ))
    const baselineSymbolRows = computed(() => baselineMetrics.value?.top_symbols || [])
    const windowSampleCards = computed(() => {
      const reference = windowStats.value?.reference || {}
      const observed = windowStats.value?.observed || {}
      const coverage = factsheet.value?.coverage || {}
      const toCard = (label, sample) => ({
        label,
        tradeCount: sample.trade_count ?? 0,
        mean: formatPercentValue(sample.mean),
        median: formatPercentValue(sample.median),
        stddev: formatPercentValue(sample.stddev),
        winRate: formatPercentile(sample.win_rate),
        expectancy: formatPercentValue(sample.expectancy),
        pnlPercent: formatPercentValue(sample.sum),
        pnlTotal: formatAmount(sample.pnl_amount_total),
        coverage: label === (coherenceSummary.value?.reference_mode || 'SIM').toUpperCase()
          ? '100.0%'
          : formatPercentile(coverage.coverage_ratio),
        period: `${formatDateTime(sample.sample_period?.started_at)} → ${formatDateTime(sample.sample_period?.ended_at)}`
      })
      return [
        toCard((coherenceSummary.value?.reference_mode || 'SIM').toUpperCase(), reference),
        toCard((coherenceSummary.value?.observed_mode || 'OBSERVED').toUpperCase(), observed)
      ]
    })
    const windowStatRows = computed(() => {
      const build = (label, sample, coverageValue) => {
        const duration = sample?.duration_bars || {}
        return {
          label,
          rows: [
            { label: 'Trade count', value: formatInteger(sample?.trade_count) },
            { label: 'Mean return', value: formatPercentValue(sample?.mean) },
            { label: 'Median return', value: formatPercentValue(sample?.median) },
            { label: 'Stddev', value: formatPercentValue(sample?.stddev) },
            { label: 'Win rate', value: formatPercentile(sample?.win_rate) },
            { label: 'Expectancy', value: formatPercentValue(sample?.expectancy) },
            { label: 'Total pnl percent', value: formatPercentValue(sample?.sum) },
            { label: 'Sample coverage', value: coverageValue },
            { label: 'Duration mean', value: formatNumber(duration.mean, 2) },
            { label: 'Duration median', value: formatNumber(duration.median, 2) },
            { label: 'Duration stddev', value: formatNumber(duration.stddev, 2) },
            { label: 'Duration MAD', value: formatNumber(duration.mad, 2) }
          ]
        }
      }
      return [
        build(
          (coherenceSummary.value?.reference_mode || 'SIM').toUpperCase(),
          windowStats.value?.reference || {},
          '100.0%'
        ),
        build(
          (coherenceSummary.value?.observed_mode || 'OBSERVED').toUpperCase(),
          windowStats.value?.observed || {},
          formatPercentile(factsheet.value?.coverage?.coverage_ratio)
        )
      ]
    })
    const windowQuantileTables = computed(() => {
      const labels = {
        p05: 'Il 5% dei trade chiude sotto questo valore',
        p25: 'Il 25% dei trade chiude sotto questo valore',
        p50: 'Mediana: metà trade sotto, metà sopra',
        p75: 'Il 75% dei trade chiude sotto questo valore',
        p95: 'Il 95% dei trade chiude sotto questo valore'
      }
      const build = (label, sample) => ({
        label,
        rows: Object.entries(sample?.quantiles || {}).map(([quantile, value]) => ({
          quantile,
          meaning: labels[quantile] || '',
          value: formatPercentValue(value)
        }))
      })
      return [
        build((coherenceSummary.value?.reference_mode || 'SIM').toUpperCase(), windowStats.value?.reference || {}),
        build((coherenceSummary.value?.observed_mode || 'OBSERVED').toUpperCase(), windowStats.value?.observed || {})
      ]
    })
    const windowSampleSideRows = computed(() => {
      const buildRows = (label, stats) => (
        Object.entries(stats?.by_side || {}).map(([side, row]) => ({
          key: `${label}-${side}`,
          label,
          side,
          ...(row || {})
        }))
      )
      return [
        ...buildRows((coherenceSummary.value?.reference_mode || 'SIM').toUpperCase(), windowStats.value?.reference),
        ...buildRows((coherenceSummary.value?.observed_mode || 'OBSERVED').toUpperCase(), windowStats.value?.observed)
      ]
    })
    const comparisonSections = computed(() => {
      const comparison = coherenceSummary.value?.comparison || {}
      const simVsBaseline = comparison.sim_vs_baseline || coherenceSummary.value?.sim_check || {}
      const observedVsBaseline = comparison.observed_vs_baseline || coherenceSummary.value?.observed_check || {}
      const observedVsReference = comparison.observed_vs_reference || coherenceSummary.value?.paper_vs_sim || {}

      const buildBaselineRows = (payload) => {
        const metrics = payload?.metrics || {}
        return [
          { label: 'Verdetto appartenenza', value: coherenceStatusLabel(payload?.status || 'unresolved') },
          { label: 'Affidabilità check', value: formatNumber(payload?.confidence, 3) },
          { label: 'Score scostamento', value: formatNumber(payload?.score, 4) },
          { label: 'Dimensione campione', value: formatInteger(metrics?.current?.sample_size) },
          { label: 'Scostamento media', value: formatPercentValue(metrics?.mean_delta) },
          { label: 'Scostamento mediana', value: formatPercentValue(metrics?.median_delta) },
          { label: 'Z-score media', value: formatNumber(metrics?.z_mean, 3) },
          { label: 'Z-score mediana', value: formatNumber(metrics?.z_median, 3) },
          { label: 'Distanza KS', value: formatNumber(metrics?.ks_distance, 4) }
        ]
      }

      const observedLabel = (coherenceSummary.value?.observed_mode || 'PAPER/LIVE').toUpperCase()
      const referenceLabel = (coherenceSummary.value?.reference_mode || 'SIM/BACKTEST').toUpperCase()

      return [
        { label: `Check appartenenza ${referenceLabel} -> Baseline`, rows: buildBaselineRows(simVsBaseline) },
        { label: `Check appartenenza ${observedLabel} -> Baseline`, rows: buildBaselineRows(observedVsBaseline) },
        {
          label: `Confronto diagnostico ${observedLabel} vs ${referenceLabel}`,
          rows: [
            { label: 'Verdetto confronto', value: coherenceStatusLabel(observedVsReference?.status || 'unresolved') },
            { label: 'Coverage', value: formatPercentile(observedVsReference?.coverage_ratio) },
            { label: 'Distanza KS', value: formatNumber(observedVsReference?.ks_distance, 4) },
            { label: 'Wasserstein', value: formatNumber(observedVsReference?.wasserstein_distance, 4) },
            { label: 'Compatibile con casualità', value: observedVsReference?.random_like == null ? 'NA' : (observedVsReference.random_like ? 'Sì' : 'No') }
          ]
        }
      ]
    })
    const observedVsReferenceIndicators = computed(() => {
      const paperVsSim = coherenceSummary.value?.comparison?.observed_vs_reference
        || coherenceSummary.value?.paper_vs_sim
        || {}
      return [
        { label: 'Coverage', value: formatPercentile(paperVsSim.coverage_ratio) },
        { label: 'KS distance', value: formatNumber(paperVsSim.ks_distance, 4) },
        { label: 'Wasserstein', value: formatNumber(paperVsSim.wasserstein_distance, 4) },
        { label: 'Random-like', value: paperVsSim.random_like == null ? 'NA' : (paperVsSim.random_like ? 'Sì' : 'No') }
      ]
    })
    const coherenceDiagnosis = computed(() => {
      const rows = coherenceSummary.value?.diagnosis || []
      return rows
        .filter((item) => !(item?.title === 'Contesto baseline non risolto' && baselineRecord.value))
        .map((item) => {
          if (item?.title === 'Observed vs reference non casuale') {
            return {
              ...item,
              indicators: observedVsReferenceIndicators.value
            }
          }
          return item
        })
    })
    const alpacaSyncEstimatedTotal = computed(() => (
      Number(alpacaSyncStatus.value?.estimated_total || 0)
    ))
    const alpacaSyncProcessed = computed(() => (
      Number(alpacaSyncStatus.value?.processed || 0)
    ))
    const alpacaSyncProgress = computed(() => {
      const raw = Number(alpacaSyncStatus.value?.progress || 0)
      if (!Number.isFinite(raw) || raw <= 0) return 0
      return Math.min(1, raw / 100)
    })
    const alpacaSyncLabel = computed(() => {
      const status = alpacaSyncStatus.value?.status
      if (status === 'failed') return `Errore: ${alpacaSyncStatus.value?.error || 'sync fallita'}`
      if (status === 'completed') return 'Sync completata'
      if (status === 'running') return 'Scaricamento ordini Alpaca della finestra selezionata'
      if (status === 'queued') return 'Sync accodata'
      return 'Cache Alpaca in aggiornamento'
    })
    const formatInventorySample = (value) => {
      if (!value || typeof value !== 'object') return 'NA'
      const items = Object.entries(value)
      if (!items.length) return 'flat'
      return items.map(([symbol, qty]) => `${symbol}:${formatNumber(qty, 4)}`).join(' | ')
    }
    const statusColor = (status) => {
      switch (status) {
        case 'Completato':
        case 'ok':
        case 'active':
        case 'running':
          return 'positive'
        case 'In esecuzione':
        case 'starting':
        case 'activating':
          return 'warning'
        case 'warning':
        case 'inactive':
        case 'stopped':
          return 'orange'
        case 'Errore':
        case 'discrepancy':
        case 'failed':
        case 'not-found':
          return 'negative'
        default:
          return 'grey'
      }
    }
    const coherenceStatusColor = (status) => {
      switch (status) {
        case 'ok':
        case 'coherent':
          return 'positive'
        case 'borderline':
        case 'insufficient_sample':
        case 'baseline_missing':
        case 'run_version_missing':
          return 'warning'
        case 'drifted':
        case 'discrepancy':
        case 'failed':
          return 'negative'
        case 'missing_baseline':
        case 'unresolved':
        default:
          return 'grey'
      }
    }
    const coherenceStatusLabel = (status) => {
      switch (status) {
        case 'ok':
          return 'Coerente'
        case 'coherent':
          return 'Coerente'
        case 'drifted':
          return 'Scostato'
        case 'insufficient_sample':
          return 'Campione debole'
        case 'baseline_missing':
          return 'Baseline assente'
        case 'run_version_missing':
          return 'Versione mancante'
        case 'missing_baseline':
          return 'Baseline mancante'
        case 'discrepancy':
          return 'Discrepanza'
        default:
          return status || 'NA'
      }
    }
    const coherenceSeverityColor = (severity) => {
      if (severity === 'positive') return 'positive'
      if (severity === 'negative') return 'negative'
      return 'warning'
    }
    const coherenceSeverityIcon = (severity) => {
      if (severity === 'positive') return 'check_circle'
      if (severity === 'negative') return 'error'
      return 'warning'
    }

    const formatNumber = (value, digits = 2) => {
      const num = Number(value)
      return Number.isFinite(num) ? num.toFixed(digits) : 'NA'
    }
    const formatInteger = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? String(Math.round(num)) : 'NA'
    }

    const formatDateTime = (value) => {
      if (!value) return 'NA'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString('it-IT')
    }

    const formatWindowPoint = (value) => {
      if (!value) return 'NA'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      return date.toLocaleString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatWindowSummary = (window) => {
      if (!window) return ''
      const opened = formatWindowPoint(window.opened_at)
      const closed = window.in_progress ? 'in corso' : formatWindowPoint(window.closed_at)
      return `Finestra: ${opened} -> ${closed}`
    }

    const formatWindowOption = (window) => {
      if (!window) return ''
      const opened = formatWindowPoint(window.opened_at)
      const closed = window.in_progress ? 'in corso' : formatWindowPoint(window.closed_at)
      return `${opened} -> ${closed}`
    }

    const formatPercentile = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? `${(num * 100).toFixed(1)}%` : 'NA'
    }

    const formatPercentValue = (value, digits = 3) => {
      const num = Number(value)
      return Number.isFinite(num) ? `${num.toFixed(digits)}%` : 'NA'
    }

    const formatAmount = (value, digits = 2) => {
      const num = Number(value)
      return Number.isFinite(num) ? num.toFixed(digits) : 'NA'
    }
    const formatExposureValue = (row, value) => {
      if (row?.format === 'amount') return formatAmount(value, 2)
      return value
    }
    const showRowDelta = (row) => row?.format !== 'amount' && !row?.emphasizeNonZero
    const hasMetricValue = (value) => value !== null && value !== undefined
    const nonZeroMetricClass = (row, value) => {
      if (!row?.emphasizeNonZero) return ''
      const num = Number(value)
      if (!Number.isFinite(num) || num === 0) return ''
      return 'cell-delta-warn'
    }
    const metricCellClass = (row, value, anchor) => {
      if (row?.format === 'amount') return ''
      if (row?.emphasizeNonZero) return nonZeroMetricClass(row, value)
      return deltaCellClass(value, anchor)
    }
    const formatQuadratureValue = (row, value) => {
      if (row?.format === 'amount') return formatAmount(value, 2)
      return value
    }
    const metricSideRow = (side) => {
      if (side === 'sim') return simOperationRow.value
      if (side === 'paper') return paperOperationRow.value
      if (side === 'alpaca') return alpacaOperationRow.value
      return emptyOperationRow
    }
    const metricSideLabel = (side) => {
      if (side === 'sim') return 'SIM'
      if (side === 'paper') return 'PAPER'
      if (side === 'alpaca') return 'ALPACA'
      return side
    }
    const metricDetailsFor = (side, row) => {
      const source = metricSideRow(side)
      const details = source?.details || {}
      if (row.key === 'non_executed') {
        return [
          ...(details.open_canceled || []),
          ...(details.open_rejected || []),
          ...(details.open_margin || [])
        ]
      }
      if (row.key === 'open_executed') {
        return [
          ...(details.open_completed || []),
          ...(details.open_partial || [])
        ]
      }
      if (row.key === 'inventory_nonzero' || row.key === 'inventory_end' || row.key === 'final_inventory_nonzero') {
        return source?.final_inventory_nonzero_details || details.final_inventory_nonzero_symbols || []
      }
      if (row.key === 'signal_symbols_count') {
        return source?.signal_symbol_details || details.signal_symbols_count || []
      }
      if (row.key === 'initial_flatten_close_completed') {
        return source?.initial_flatten_close_details || details.initial_flatten_close_completed || []
      }
      return details[row.key] || []
    }
    const showMetricDetails = (side, row) => {
      metricDialogState.value = {
        title: `${row.label} · ${metricSideLabel(side)}`,
        subtitle: selectedWindowSummary.value || '',
        rows: metricDetailsFor(side, row)
      }
      showMetricDialog.value = true
    }

    const factsheetGroupLabel = (group) => {
      switch (group) {
        case 'live':
          return 'Paper totale'
        case 'paper':
          return 'Paper totale'
        case 'backtest':
          return 'Sim totale'
        case 'shadow':
          return 'Sim totale'
        case 'matched_in_observed':
          return 'Paper presi anche da Sim'
        case 'matched_in_reference':
          return 'Sim presi da Paper'
        case 'missed_in_reference':
          return 'Sim persi da Paper'
        case 'paper_only':
          return 'Paper senza match in Sim'
        default:
          return group
      }
    }

    const fetchJson = async (path) => {
      try {
        const response = await axios.get(`${constants.API_BASE_URL}${path}`)
        return response.data
      } catch (error) {
        const message = error?.response?.data?.error
          || error?.response?.data?.message
          || error?.message
          || String(error)
        throw new Error(message)
      }
    }

    const windowedPath = (path) => {
      const params = []
      if (selectedWindowOpen.value) {
        params.push(`window_open=${encodeURIComponent(selectedWindowOpen.value)}`)
      }
      if (selectedPortfolioKeyId.value) {
        params.push(`portfolio_key_id=${encodeURIComponent(selectedPortfolioKeyId.value)}`)
      }
      if (!params.length) return path
      const separator = path.includes('?') ? '&' : '?'
      return `${path}${separator}${params.join('&')}`
    }

    const handleWindowChange = (value) => {
      selectedWindowOpen.value = value
      selectedPortfolioKeyId.value = null
      portfolioSession.value = null
      refreshAll()
    }

    const refreshAll = async () => {
      isRefreshing.value = true
      try {
        const windowsData = await fetchJson('/dyn/obs/watchtower/windows')
        watchtowerWindows.value = windowsData || []
        if (!selectedWindowOpen.value && watchtowerWindows.value.length) {
          selectedWindowOpen.value = watchtowerWindows.value[0].window_open
        }
        if (
          selectedWindowOpen.value
          && !watchtowerWindows.value.some((window) => window.window_open === selectedWindowOpen.value)
        ) {
          selectedWindowOpen.value = watchtowerWindows.value[0]?.window_open || null
        }

        if (selectedWindowOpen.value) {
          portfolioContexts.value = await fetchJson('/dyn/obs/watchtower/portfolio-contexts?window_open=' + encodeURIComponent(selectedWindowOpen.value))
          if (!portfolioContexts.value.length) {
            selectedPortfolioKeyId.value = null
          } else if (
            !selectedPortfolioKeyId.value
            || !portfolioContexts.value.some((row) => row.portfolio_key_id === selectedPortfolioKeyId.value)
          ) {
            selectedPortfolioKeyId.value = portfolioContexts.value[0].portfolio_key_id
          }
          portfolioSession.value = selectedPortfolioKeyId.value
            ? await fetchJson(windowedPath('/dyn/obs/watchtower/portfolio-session'))
            : null
        } else {
          portfolioContexts.value = []
          selectedPortfolioKeyId.value = null
          portfolioSession.value = null
        }

        const requests = await Promise.allSettled([
          fetchJson('/dyn/obs/runs'),
          fetchJson('/dyn/obs/watchtower/baselines?limit=10'),
          fetchJson(windowedPath('/dyn/obs/watchtower')),
          fetchJson(windowedPath('/dyn/obs/watchtower/overview')),
          fetchJson(windowedPath('/dyn/obs/watchtower/coherence-summary'))
        ])
        const failures = []

        const applyResult = (index, onSuccess, label) => {
          const result = requests[index]
          if (result.status === 'fulfilled') {
            onSuccess(result.value)
            return
          }
          failures.push(`${label}: ${result.reason?.message || result.reason || 'unknown error'}`)
        }

        applyResult(0, (data) => { runs.value = data }, 'runs')
        applyResult(1, (data) => { baselineCatalog.value = Array.isArray(data) ? data : [] }, 'baselines')
        applyResult(2, (data) => { watchtower.value = data }, 'watchtower')
        applyResult(3, (data) => { watchtowerOverview.value = data }, 'watchtower-overview')
        applyResult(4, (data) => {
          coherenceSummary.value = data
          factsheet.value = data?.factsheet || null
        }, 'coherence-summary')

        lastRefreshAt.value = new Date().toISOString()

        if (failures.length) {
          Notify.create({
            type: 'warning',
            message: `Watchtower partial refresh: ${failures.join(' | ')}`
          })
        }
      } catch (error) {
        Notify.create({
          type: 'negative',
          message: `Watchtower refresh error: ${error?.message || error}`
        })
      } finally {
        isRefreshing.value = false
      }
    }

    const rebuildWindow = async () => {
      if (!selectedWindowOpen.value) {
        Notify.create({ type: 'warning', message: 'Seleziona una finestra' })
        return
      }
      isRebuilding.value = true
      try {
        await axios.post(`${constants.API_BASE_URL}/dyn/obs/watchtower/rebuild`, {
          window_open: selectedWindowOpen.value,
          sync: true
        })
        Notify.create({
          type: 'positive',
          message: `Report rigenerato per finestra ${selectedWindowOpen.value}`
        })
        await refreshAll()
      } catch (error) {
        const message = error?.response?.data?.error
          || error?.response?.data?.message
          || error?.message
          || String(error)
        Notify.create({
          type: 'negative',
          message: `Rigenerazione report fallita: ${message}`
        })
      } finally {
        isRebuilding.value = false
      }
    }

    const stopAlpacaSyncPolling = () => {
      if (alpacaSyncPollTimer.value) {
        clearTimeout(alpacaSyncPollTimer.value)
        alpacaSyncPollTimer.value = null
      }
    }

    const pollAlpacaSync = async (jobId) => {
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/alpaca-sync/${jobId}`)
        alpacaSyncStatus.value = response.data
        if (response.data?.done) {
          stopAlpacaSyncPolling()
          isSyncingAlpaca.value = false
          if (response.data.status === 'completed') {
            Notify.create({
              type: 'positive',
              message: `Sync Alpaca completata per finestra ${selectedWindowOpen.value}`
            })
            await refreshAll()
          } else {
            Notify.create({
              type: 'negative',
              message: `Sync Alpaca fallita: ${response.data?.error || 'errore sconosciuto'}`
            })
          }
          return
        }
        alpacaSyncPollTimer.value = setTimeout(() => { pollAlpacaSync(jobId) }, 1000)
      } catch (error) {
        stopAlpacaSyncPolling()
        isSyncingAlpaca.value = false
        Notify.create({
          type: 'negative',
          message: `Progress sync Alpaca non disponibile: ${error?.message || error}`
        })
      }
    }

    const syncAlpacaWindow = async () => {
      if (!selectedWindowOpen.value) {
        Notify.create({ type: 'warning', message: 'Seleziona una finestra' })
        return
      }
      stopAlpacaSyncPolling()
      isSyncingAlpaca.value = true
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/obs/watchtower/alpaca-sync`, {
          window_open: selectedWindowOpen.value,
          portfolio_key_id: selectedPortfolioKeyId.value || null
        })
        alpacaSyncStatus.value = response.data
        await pollAlpacaSync(response.data.job_id)
      } catch (error) {
        isSyncingAlpaca.value = false
        const message = error?.response?.data?.error
          || error?.response?.data?.message
          || error?.message
          || String(error)
        Notify.create({
          type: 'negative',
          message: `Sync Alpaca fallita: ${message}`
        })
      }
    }

    const showRun = async (runId) => {
      try {
        selectedRun.value = await fetchJson(`/dyn/obs/runs/${runId}`)
        showDialog.value = true
      } catch (error) {
        Notify.create({ type: 'negative', message: `Run detail error: ${error?.message || error}` })
      }
    }

    const pollBaselineJob = async (jobId) => {
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/baselines/jobs/${jobId}`)
        baselineJobStatus.value = response.data
        if (response.data?.done) {
          isComputingBaseline.value = false
          if (response.data.status === 'completed') {
            Notify.create({ type: 'positive', message: 'Baseline calcolata con successo' })
            await refreshAll()
          } else {
            Notify.create({ type: 'negative', message: `Calcolo baseline fallito: ${response.data?.error || 'errore sconosciuto'}` })
          }
          return
        }
        setTimeout(() => { pollBaselineJob(jobId) }, 1000)
      } catch (error) {
        isComputingBaseline.value = false
        Notify.create({ type: 'negative', message: `Job baseline non disponibile: ${error?.message || error}` })
      }
    }

    const computeBaseline = async () => {
      if (!baselineSourcePaths.value.length) {
        Notify.create({ type: 'warning', message: 'Specifica almeno un source path per la baseline' })
        return
      }
      isComputingBaseline.value = true
      baselineJobStatus.value = null
      try {
        const payload = {
          source_paths: baselineSourcePaths.value,
          source_root: baselineSourceRoot.value || null
        }
        if (coherenceRunStrategy.value && coherenceRunFingerprint.value) {
          payload.strategy = coherenceRunStrategy.value
          payload.strategy_fingerprint = coherenceRunFingerprint.value
          payload.params = coherenceRunParams.value || {}
        }
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/obs/watchtower/baselines/recompute`, payload)
        baselineJobStatus.value = response.data
        await pollBaselineJob(response.data.job_id)
      } catch (error) {
        isComputingBaseline.value = false
        const message = error?.response?.data?.error
          || error?.response?.data?.message
          || error?.message
          || String(error)
        Notify.create({ type: 'negative', message: `Calcolo baseline fallito: ${message}` })
      }
    }

    const exportBars = async () => {
      if (!selectedWindowOpen.value) {
        Notify.create({ type: 'warning', message: 'Seleziona una finestra' })
        return
      }
      isExportingBars.value = true
      try {
        const response = await axios.get(`${constants.API_BASE_URL}/dyn/obs/watchtower/export-bars`, {
          params: {
            window_open: selectedWindowOpen.value,
            portfolio_key_id: selectedPortfolioKeyId.value || undefined
          },
          responseType: 'blob'
        })
        const disposition = String(response.headers?.['content-disposition'] || '')
        const filenameMatch = disposition.match(/filename=([^;]+)/i)
        const serverFilename = filenameMatch?.[1]?.trim()?.replace(/^"|"$/g, '')
        const blob = new Blob(
          [response.data],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        )
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = serverFilename || `watchtower-bars-${selectedWindowOpen.value}.xlsx`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        let message = error?.message || String(error)
        const payload = error?.response?.data
        if (payload instanceof Blob) {
          try {
            const text = await payload.text()
            const parsed = JSON.parse(text)
            message = parsed?.error || parsed?.message || message
          } catch {
            message = message || 'export_failed'
          }
        } else {
          message = error?.response?.data?.error
            || error?.response?.data?.message
            || message
        }
        Notify.create({ type: 'negative', message: `Export Excel fallito: ${message}` })
      } finally {
        isExportingBars.value = false
      }
    }

    onMounted(refreshAll)
    onBeforeUnmount(stopAlpacaSyncPolling)

    return {
      runs,
      watchtower,
      watchtowerOverview,
      watchdog,
      factsheet,
      coherenceSummary,
      baselineCatalog,
      watchtowerWindows,
      selectedWindowOpen,
      portfolioContexts,
      selectedPortfolioKeyId,
      portfolioOptions,
      portfolioSession,
      selectedPortfolioSummary,
      windowOptions,
      selectedWindowMeta,
      selectedWindowSummary,
      isRefreshing,
      isRebuilding,
      isSyncingAlpaca,
      isExportingBars,
      lastRefreshAt,
      alpacaSyncStatus,
      baselineSourcePathsText,
      baselineSourceRoot,
      baselineSourcePaths,
      isComputingBaseline,
      baselineJobStatus,
      copyParams,
      baselineStatus,
      baselineRecord,
      baselineMatchMode,
      baselineMatchLabel,
      baselineMetrics,
      baselineMetricCards,
      baselineDetailRows,
      baselineQuantileRows,
      baselineHistogramBars,
      baselineSourceManifestRows,
      baselineSideRows,
      baselineSymbolRows,
      baselineStatusMessage,
      baselineSideColumns,
      baselineSymbolColumns,
      statDetailColumns,
      quantileColumns,
      baselineSourceManifestColumns,
      coherenceRunId,
      coherenceRunFingerprint,
      coherenceRunStrategy,
      coherenceRunParams,
      canComputeBaseline,
      baselineComputeContextLabel,
      windowStats,
      windowSampleCards,
      windowStatRows,
      windowQuantileTables,
      windowSampleSideRows,
      windowSampleSideColumns,
      comparisonSections,
      coherenceDiagnosis,
      alpacaSyncProgress,
      alpacaSyncProcessed,
      alpacaSyncEstimatedTotal,
      alpacaSyncLabel,
      paperOperationRow,
      simOperationRow,
      alpacaOperationRow,
      assetDeltaSummary,
      assetDeltaColor,
      simOnlySymbolsLabel,
      paperOnlySymbolsLabel,
      selectedRun,
      showDialog,
      showMetricDialog,
      metricDialogColumns,
      metricDialogRows,
      metricDialogTitle,
      metricDialogSubtitle,
      openNonExecutedExpanded,
      openExecutedExpanded,
      watchtowerLatest,
      openSummaryRows,
      openDetailRows,
      openExecutedDetailRows,
      closeSummaryRows,
      exposureRows,
      quadratureRows,
      deltaLabel,
      deltaCellClass,
      deltaSignClass,
      runColumns,
      groupColumns,
      integrityDetailColumns,
      integrityHistoryColumns,
      watchdogColumns,
      factsheetColumns,
      factsheetQuadratureColumns,
      prettySelected,
      integrityGroups,
      integrityDetails,
      integrityHistory,
      integrityMetricCards,
      factsheetRows,
      factsheetQuadratureRows,
      rebuildWindow,
      computeBaseline,
      syncAlpacaWindow,
      exportBars,
      refreshAll,
      handleWindowChange,
      showRun,
      statusColor,
      coherenceStatusColor,
      coherenceStatusLabel,
      coherenceSeverityColor,
      coherenceSeverityIcon,
      formatNumber,
      formatInteger,
      formatDateTime,
      formatWindowPoint,
      formatWindowSummary,
      formatWindowOption,
      formatPercentile,
      formatPercentValue,
      formatAmount,
      formatExposureValue,
      showRowDelta,
      hasMetricValue,
      metricCellClass,
      formatQuadratureValue,
      showMetricDetails,
      factsheetGroupLabel,
      formatInventorySample
    }
  }
})
</script>

<style scoped>
.detail-pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 65vh;
  overflow: auto;
}

.service-card {
  min-height: 0;
}

.watchtower-toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.watchtower-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.quadrature-fallback {
  overflow-x: auto;
}

.quadrature-expansion {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.asset-popup {
  max-width: 420px;
}

.coherence-panel {
  height: 100%;
}

.coherence-verdict-card {
  height: 100%;
}

.histogram-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
  gap: 10px;
  align-items: end;
}

.histogram-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.histogram-bar-label,
.histogram-bar-count {
  font-size: 0.72rem;
  color: rgba(0, 0, 0, 0.62);
  text-align: center;
  line-height: 1.1;
  white-space: pre-line;
}

.histogram-bar-track {
  width: 100%;
  height: 160px;
  border-radius: 8px;
  background: rgba(25, 118, 210, 0.08);
  border: 1px solid rgba(25, 118, 210, 0.12);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.histogram-bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #90caf9 0%, #1976d2 100%);
  border-radius: 6px 6px 0 0;
}

.diagnosis-indicators {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.diagnosis-indicator {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.02);
}

.quantile-inline-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.quantile-inline-item {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 8px;
}

.quadrature-section-row th {
  background: #eef2f7;
  color: #243447;
  font-weight: 700;
  text-align: left;
  border-top: 2px solid #cfd8e3;
}

.quadratura-table {
  border-collapse: collapse;
  font-size: 0.85rem;
}
.quadratura-table th,
.quadratura-table td {
  padding: 4px 10px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  white-space: nowrap;
}
.quadratura-table thead th {
  text-align: center;
  font-weight: 600;
  color: rgba(0,0,0,0.6);
  border-bottom: 2px solid rgba(0,0,0,0.15);
}
.quadratura-table tbody th {
  text-align: left;
  font-weight: 400;
  color: rgba(0,0,0,0.7);
  padding-right: 16px;
}
.quadratura-table td {
  text-align: right;
}
.col-baseline {
  color: #111111;
  font-weight: 600;
}
.col-delta {
  background: rgba(25, 118, 210, 0.06);
  font-weight: 600;
}
.col-label {
  min-width: 160px;
}
.cell-delta-warn {
  background: rgba(255, 152, 0, 0.15);
  color: #e65100;
  font-weight: 600;
}
.delta-badge {
  font-size: 0.75rem;
  font-weight: 600;
}
.metric-cell-btn {
  min-height: 24px;
  padding: 0 2px;
  color: inherit;
}

.quadrature-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.quadrature-table th,
.quadrature-table td {
  border: 1px solid #d7dbe3;
  padding: 6px 8px;
  text-align: right;
  white-space: nowrap;
}

.quadrature-table th:first-child,
.quadrature-table td:first-child {
  text-align: left;
}

.quadrature-table thead th {
  background: #f5f7fa;
  font-weight: 600;
}
.quadrature-subrow th,
.quadrature-subrow td {
  background: #fafbfc;
  font-size: 11px;
}
.quadrature-subrow th {
  padding-left: 20px;
}
.quadrature-subrow-label {
  color: #6b7280;
  font-weight: 500;
}

.ops-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ops-table th,
.ops-table td {
  border-bottom: 1px solid #e6e9ef;
  padding: 7px 8px;
  vertical-align: middle;
}

.ops-table tbody th {
  text-align: left;
  font-weight: 500;
  color: #5f6b7a;
  width: 56%;
}

.ops-table td {
  text-align: right;
  font-weight: 600;
  width: 22%;
}

.ops-table thead th {
  text-align: center;
  font-weight: 600;
  color: #2f3a48;
}

.ops-table thead th:first-child {
  text-align: left;
}
</style>
