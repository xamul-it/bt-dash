<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="text-h5">
          Watchtower — {{ selectedProfile || 'Profili Cron' }}
          <span v-if="profileTitleLabel">· {{ profileTitleLabel }}</span>
          <q-badge v-if="overview?.registry" :color="overview.registry.paper ? 'blue-grey' : 'deep-orange'" class="q-ml-sm" vertical-align="middle">
            {{ overview.registry.paper ? 'paper' : 'LIVE' }}
          </q-badge>
        </div>
        <div class="text-caption text-grey-7">
          <template v-if="overview?.registry">Strategia: {{ overview.registry.assigned_strategy }}</template>
          <template v-else>Strategie schedulate a barra daily (overnight_ah e simili)</template>
          <q-btn v-if="overview?.current_version" flat round dense icon="info" size="sm" class="q-ml-xs" @click="paramsDialog = true">
            <q-tooltip>Vedi e copia i parametri correnti</q-tooltip>
          </q-btn>
        </div>
      </div>
      <div class="col-auto row q-col-gutter-sm items-center">
        <div class="col-auto">
          <q-select
            v-model="selectedProfile"
            :options="profileOptions"
            label="Profilo"
            dense
            outlined
            emit-value
            map-options
            style="min-width: 220px"
            @update:model-value="loadOverview"
          />
        </div>
        <div class="col-auto">
          <q-btn
            flat
            round
            icon="refresh"
            :loading="loading"
            @click="loadOverview"
          />
        </div>
      </div>
    </div>

    <q-banner v-if="loadError" class="bg-red-1 text-red-9 q-mb-md" rounded>
      {{ loadError }}
    </q-banner>

    <q-dialog v-model="paramsDialog">
      <q-card style="min-width: 620px; max-width: 95vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ paramsDialogTitle }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          <div class="text-caption text-grey-7 q-mb-xs">Strategia</div>
          <pre class="stratargs-pre">{{ dialogParamsText }}</pre>
          <template v-if="paramsDialogBacktestVisible">
            <div class="text-caption text-grey-7 q-mb-xs">Replay Backtest</div>
            <pre class="stratargs-pre">{{ backtestParamsText }}</pre>
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat icon="content_copy" label="Copia" color="primary" @click="copyCurrentParams" />
          <q-btn flat label="Chiudi" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <div v-if="!selectedProfile && !loading" class="text-grey-6 q-pa-lg text-center">
      Nessun profilo trovato nel registro. I profili appaiono qui appena hanno almeno un dato in una delle Fasi D/A/C/B.
    </div>

    <template v-if="overview">
      <!-- Status banner: capire in 10 secondi se c'è un problema -->
      <q-banner :class="statusBannerClass" rounded class="q-mb-md text-white">
        <template #avatar>
          <q-icon :name="statusIcon" size="2rem" />
        </template>
        <div class="text-subtitle1">{{ statusHeadline }}</div>
        <div class="text-caption">{{ statusSubline }}</div>
      </q-banner>

      <div class="row q-col-gutter-md q-mb-md">
        <!-- Cosa è successo oggi / di recente -->
        <div class="col-12">
          <q-card flat bordered class="full-height">
            <q-card-section>
              <div class="text-subtitle2 text-grey-8">Cosa è successo di recente</div>
            </q-card-section>
            <q-separator />
            <q-card-section>
              <div v-if="!latestActivity" class="text-grey-6">
                Nessun run o riconciliazione ancora registrato per questo profilo.
              </div>
              <template v-else>
                <div class="text-body1">
                  <b>{{ latestActivity.trading_date }}</b>
                  — {{ latestActivity.detail || latestActivity.statusLabel }}
                </div>
                <div v-if="latestActivity.raw && resultDetail(latestActivity.raw)" class="text-caption text-grey-7 q-mt-xs">
                  {{ resultDetail(latestActivity.raw) }}
                </div>
                <div v-if="isExpandable(latestActivity)" class="text-caption text-primary q-mt-xs">
                  Apri la riga corrispondente qui sotto per vedere ordini, quantità e stato broker.
                </div>
              </template>
              <div v-if="pendingCount" class="q-mt-md">
                <span class="text-caption text-orange-9">In attesa di riconciliazione:</span>
                <q-btn v-for="pending in pendingDates" :key="pending.day" flat dense no-caps color="orange-9"
                  :label="pending.label" @click="goToDay(pending.day)">
                  <q-tooltip>{{ pending.detail }} · vai alla riga</q-tooltip>
                </q-btn>
              </div>
              <div v-if="historicalEntryIssues.length" class="q-mt-md">
                <div class="text-caption text-orange-9">Da analizzare nello storico:</div>
                <q-btn v-for="issue in historicalEntryIssues" :key="issue.day" flat dense no-caps
                  :color="issue.status === 'error' ? 'negative' : 'orange-9'" :label="`${issue.label} · ${issue.kind}`"
                  @click="goToDay(issue.day)">
                  <q-tooltip>{{ issue.detail }} · apri la giornata</q-tooltip>
                </q-btn>
                <div class="text-caption text-grey-7 q-mt-xs">
                  Sono divergenze/esiti da verificare, non errori generici di telemetria. Le più vecchie restano nello storico della tabella.
                </div>
              </div>
              <div v-if="overview.open_guardrail_alerts?.length" class="q-mt-md">
                <div v-for="alert in overview.open_guardrail_alerts" :key="alert.id" class="text-body2 text-negative">
                  <q-icon name="warning" size="xs" /> {{ guardrailAlertText(alert) }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>

      </div>

      <!-- Performance vs storia -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">La strategia performa come in passato?</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="!selectedBaseline || !prePost.pre || !prePost.post" class="text-grey-6">
            Crea e seleziona una baseline per confrontarla con la finestra recente.
          </div>
          <template v-else>
            <q-select v-model="selectedBaselineId" :options="baselineOptions" dense outlined emit-value map-options
              label="Baseline" class="q-mb-sm" />
            <div class="text-body1">Confronto della baseline con i replay della riconciliazione giornaliera.</div>
            <div class="overflow-auto">
              <table class="footprint-table q-mt-sm">
                <thead>
                  <tr>
                    <th></th>
                    <th>Baseline<div class="text-caption text-grey-7">{{ dateRange(selectedBaseline) }}</div></th>
                    <th v-for="window in comparisonWindows" :key="window.days">
                      Ultimi {{ window.days }} giorni
                      <div class="text-caption text-grey-7">{{ dateRange(window.comparison?.recent) }}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Trade</td><td>{{ selectedBaseline?.sample_size ?? '—' }}</td><td v-for="window in comparisonWindows" :key="`trades-${window.days}`">{{ window.comparison?.recent?.sample_size ?? '—' }}</td></tr>
                  <tr><td>Win rate</td><td>{{ pct(selectedBaseline?.metrics?.win_rate) }}</td><td v-for="window in comparisonWindows" :key="`win-${window.days}`">{{ pct(window.comparison?.recent?.metrics?.win_rate) }}</td></tr>
                  <tr><td>Gain medio/trade</td><td>{{ pctSigned(selectedBaseline?.metrics?.mean) }}</td><td v-for="window in comparisonWindows" :key="`trade-gain-${window.days}`">{{ pctSigned(window.comparison?.recent?.metrics?.mean) }}</td></tr>
                  <tr><td>Gain medio/giorno</td><td>{{ pctSigned(selectedBaseline?.metrics?.average_daily_return_pct) }}</td><td v-for="window in comparisonWindows" :key="`day-gain-${window.days}`">{{ pctSigned(window.comparison?.recent?.metrics?.average_daily_return_pct) }}</td></tr>
                  <tr><td>Compatibilità statistica</td><td>—</td><td v-for="window in comparisonWindows" :key="`compatibility-${window.days}`">{{ compatibilityLabel(window.comparison) }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">
              Compatibilità: test bilaterale del gain medio/trade della finestra rispetto a media e dispersione della baseline.
              Valore alto = il campione è statisticamente coerente con la baseline.
              Le date seguono sempre il calendario di trading; eventuali giorni senza replay restano fuori dal campione.
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- Alpaca vs baseline Backtrader -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">Su Alpaca performa come Backtrader in passato?</div>
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div v-if="!selectedBaseline" class="text-grey-6">
            Crea e seleziona una baseline Backtrader per confrontarla con i risultati Alpaca recenti.
          </div>
          <template v-else>
            <div class="text-body1">
              Baseline Backtrader selezionata confrontata con gli eseguiti Alpaca delle ultime finestre di trading.
            </div>
            <div class="overflow-auto">
              <table class="footprint-table q-mt-sm">
                <thead>
                  <tr>
                    <th></th>
                    <th>Baseline Backtrader<div class="text-caption text-grey-7">{{ dateRange(selectedBaseline) }}</div></th>
                    <th v-for="window in alpacaComparisonWindows" :key="`alpaca-${window.days}`">
                      Alpaca — ultimi {{ window.days }} giorni
                      <div class="text-caption text-grey-7">{{ dateRange(window.comparison?.recent) }}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Trade</td><td>{{ selectedBaseline?.sample_size ?? '—' }}</td><td v-for="window in alpacaComparisonWindows" :key="`alpaca-trades-${window.days}`">{{ window.comparison?.recent?.sample_size ?? '—' }}</td></tr>
                  <tr><td>Win rate</td><td>{{ pct(selectedBaseline?.metrics?.win_rate) }}</td><td v-for="window in alpacaComparisonWindows" :key="`alpaca-win-${window.days}`">{{ pct(window.comparison?.recent?.metrics?.win_rate) }}</td></tr>
                  <tr><td>Gain medio/trade</td><td>{{ pctSigned(selectedBaseline?.metrics?.mean) }}</td><td v-for="window in alpacaComparisonWindows" :key="`alpaca-trade-gain-${window.days}`">{{ pctSigned(window.comparison?.recent?.metrics?.mean) }}</td></tr>
                  <tr><td>Gain medio/giorno</td><td>{{ pctSigned(selectedBaseline?.metrics?.average_daily_return_pct) }}</td><td v-for="window in alpacaComparisonWindows" :key="`alpaca-day-gain-${window.days}`">{{ pctSigned(window.comparison?.recent?.metrics?.average_daily_return_pct) }}</td></tr>
                  <tr><td>Compatibilità statistica</td><td>—</td><td v-for="window in alpacaComparisonWindows" :key="`alpaca-compatibility-${window.days}`">{{ compatibilityLabel(window.comparison) }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="text-caption text-grey-7 q-mt-sm">
              I trade e i rendimenti giornalieri provengono solo dagli ordini Alpaca con uscita eseguita; la baseline resta sempre Backtrader.
              Le date seguono sempre il calendario di trading, anche se una riconciliazione manca.
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- Storico riconciliazioni -->
      <q-card id="reconciliation-table" flat bordered class="q-mb-md">
        <q-card-section>
          <div class="row items-center q-col-gutter-sm">
            <div class="col text-subtitle2 text-grey-8">Riconciliazione giornaliera</div>
            <div class="col-auto"><q-select v-model="historyDays" dense outlined emit-value map-options :options="historyDayOptions" label="Mostra ultimi" style="min-width: 160px" /></div>
          </div>
        </q-card-section>
        <q-separator />
        <q-table
          :rows="reconciliationRows"
          :columns="reconciliationColumns"
          row-key="key"
          dense
          flat
          v-model:pagination="tablePagination"
        >
          <template #body="props">
            <q-tr
              :props="props"
              :class="{ 'cursor-pointer': isExpandable(props.row) }"
              @click="isExpandable(props.row) && toggleDay(props.row.key)"
            >
              <q-td auto-width>
                <q-icon
                  v-if="isExpandable(props.row)"
                  :name="expandedDays.includes(props.row.key) ? 'expand_more' : 'chevron_right'"
                />
              </q-td>
              <q-td key="trading_date" :props="props">
                <strong v-if="props.row.change">{{ props.row.trading_date }}</strong>
                <span v-else>{{ props.row.trading_date }}</span>
                <q-icon
                  v-if="props.row.change"
                  :name="changeIcon(props.row.change.kind)"
                  color="primary"
                  size="16px"
                  class="q-ml-xs"
                >
                  <q-tooltip>{{ props.row.change.label }}</q-tooltip>
                </q-icon>
              </q-td>
              <q-td key="status" :props="props">
                <q-badge :color="props.row.badgeColor">{{ props.row.statusLabel }}</q-badge>
              </q-td>
              <q-td key="day_return" :props="props">
                <div v-if="props.row.raw" class="day-return">
                  <span class="day-return__tag">BT</span>
                  <span class="day-return__val" :class="pctClass(daySummary(props.row.raw).bt_day_return_pct)">
                    {{ fmtDayRet(daySummary(props.row.raw).bt_day_return_pct) }}
                  </span>
                  <span class="day-return__tag">Alpaca</span>
                  <span class="day-return__val" :class="pctClass(daySummary(props.row.raw).live_day_return_pct)">
                    {{ fmtDayRet(daySummary(props.row.raw).live_day_return_pct) }}
                  </span>
                </div>
                <span v-else class="text-grey-5">—</span>
              </q-td>
              <q-td key="detail" :props="props">{{ props.row.detail }}</q-td>
            </q-tr>

            <q-tr v-if="isExpandable(props.row) && expandedDays.includes(props.row.key)" :props="props" no-hover>
              <q-td colspan="100%" class="bg-grey-1">
                <div class="q-pa-sm">
                  <template v-if="props.row.raw && props.row.raw.status !== 'error'">
                    <ul class="q-my-xs q-pl-md">
                      <li
                        v-for="(line, i) in dayReading(props.row.raw)"
                        :key="`summary-${i}`"
                        class="text-body2"
                        :class="line.cls"
                      >{{ line.text }}</li>
                    </ul>
                    <q-separator class="q-my-sm" />
                  </template>
                  <template v-if="Object.keys(props.row.decisions || {}).length">
                    <div class="text-subtitle2 q-mb-xs">Decisioni di ingresso — {{ props.row.trading_date }}</div>
                    <div class="text-caption text-grey-8 q-mb-sm">
                      Stato immediato del run: gli ordini Alpaca sono quelli inviati/rilevati dal broker. Backtrader mostra il piano locale d'ingresso, non un trade completo già eseguito.
                    </div>
                    <div class="entry-receipts">
                      <div v-for="source in ['backtest', 'alpaca']" :key="source" class="entry-receipt">
                        <div class="row items-center q-gutter-sm q-mb-xs">
                          <b>{{ source === 'alpaca' ? 'Alpaca' : backtestReceiptTitle(props.row.settlements?.backtest) }}</b>
                          <q-badge :color="decisionColor(props.row.decisions?.[source])">
                            {{ decisionState(props.row.decisions?.[source]) }}
                          </q-badge>
                        </div>
                        <div v-if="!props.row.decisions?.[source]" class="text-grey-6 text-caption">Nessuna ricevuta del run.</div>
                        <template v-else>
                          <div v-if="props.row.decisions[source].error" class="text-negative text-caption">{{ props.row.decisions[source].error }}</div>
                          <div v-if="!(props.row.decisions[source].orders || []).length" class="text-caption text-grey-7">
                            Nessun ordine. {{ decisionReasons(props.row.decisions[source]) }}
                          </div>
                          <q-list v-else dense bordered separator class="bg-white">
                              <q-item v-for="(order, index) in props.row.decisions[source].orders" :key="`${source}-${index}`">
                                <q-item-section>
                                  <q-item-label>
                                    {{ orderText(order, source, props.row.settlements?.[source]) }}
                                    <q-icon v-if="orderBrokerDetail(order, source)" name="info_outline" size="15px" class="cursor-help q-ml-xs">
                                      <q-tooltip max-width="520px">{{ orderBrokerDetail(order, source) }}</q-tooltip>
                                    </q-icon>
                                  </q-item-label>
                                  <q-item-label
                                    v-if="source === 'backtest' && backtestOrderSettlement(order, props.row.settlements?.backtest)"
                                    caption
                                    :class="pctClass(backtestOrderSettlement(order, props.row.settlements?.backtest).pnl_pct)"
                                  >
                                    {{ backtestOrderSettlementText(order, props.row.settlements?.backtest) }}
                                  </q-item-label>
                                  <q-item-label
                                    v-if="source === 'alpaca' && alpacaOrderSettlement(order, props.row.settlements?.alpaca)"
                                    caption
                                    :class="pctClass(alpacaOrderSettlement(order, props.row.settlements?.alpaca).pnl_pct)"
                                  >
                                    {{ alpacaOrderSettlementText(order, props.row.settlements?.alpaca) }}
                                  </q-item-label>
                                </q-item-section>
                              </q-item>
                          </q-list>
                          <div v-if="decisionReasons(props.row.decisions[source])" class="text-caption text-orange-9 q-mt-xs">
                            {{ decisionReasons(props.row.decisions[source]) }}
                          </div>
                          <div v-if="source === 'backtest'" class="text-caption text-grey-7 q-mt-xs">
                            {{ backtestSettlementExplanation(props.row.settlements?.backtest) }}
                          </div>
                        </template>
                      </div>
                    </div>
                  </template>

                  <template v-if="(props.row.alpacaActivity || []).length">
                    <q-expansion-item dense class="q-mt-md" :label="`Ordini Alpaca ricevuti dal broker — ${props.row.trading_date}`" header-class="text-primary text-weight-medium">
                      <div class="text-caption text-grey-8 q-mb-sm">
                        Include le chiusure OPG del mattino: sono eventi distinti dalla decisione CLS di ingresso mostrata sopra.
                      </div>
                      <q-list dense bordered separator class="bg-white">
                        <q-item v-for="order in props.row.alpacaActivity" :key="order.alpaca_order_id">
                          <q-item-section>
                            <q-item-label>{{ alpacaActivityText(order) }}</q-item-label>
                            <q-item-label caption>{{ alpacaActivityDetail(order) }}</q-item-label>
                          </q-item-section>
                        </q-item>
                      </q-list>
                    </q-expansion-item>
                  </template>

                  <template v-if="props.row.raw">
                  <div class="text-caption text-grey-8 q-mb-xs">
                    Replay su commit <code>{{ (props.row.raw.core_commit || '—').slice(0, 10) }}</code>
                    <q-badge
                      v-if="props.row.raw.core_commit_resolution"
                      outline
                      :color="props.row.raw.core_commit_resolution === 'exact' ? 'positive' : 'orange'"
                      class="q-ml-xs"
                    >{{ props.row.raw.core_commit_resolution }}</q-badge>
                    <span v-if="daySummary(props.row.raw).cash_used">
                      — cash usato ${{ num(daySummary(props.row.raw).cash_used) }}</span>
                    <span v-if="daySummary(props.row.raw).bt_entry_count != null">
                      — {{ daySummary(props.row.raw).bt_entry_count }} ingressi attesi dal backtest</span>
                  </div>

                  <div v-if="commitCaveat(props.row.raw)" class="text-caption text-orange-9 q-mb-xs">
                    ⚠ {{ commitCaveat(props.row.raw) }}
                  </div>

                  <q-expansion-item dense label="Parametri Backtrader usati in questo replay" class="q-mb-xs">
                    <div class="text-caption text-grey-7 q-mb-xs">
                      Versione parametri #{{ props.row.raw.params_version_id || '—' }}; <code>auction: true</code> è la
                      traduzione di esecuzione documentata per il backtest.
                    </div>
                    <pre class="stratargs-pre">{{ JSON.stringify(backtestStratargs(replayParamsVersion(props.row.raw)), null, 2) }}</pre>
                  </q-expansion-item>

                  <div v-if="props.row.raw.status === 'error'" class="text-negative">
                    Replay del backtest fallito: {{ props.row.raw.error || 'errore sconosciuto' }}
                  </div>

                  <template v-else>
                    <div class="sym-cards q-mt-sm">
                      <div
                        v-for="card in symbolCards(props.row.raw)"
                        :key="card.symbol + ':' + card.category"
                        class="sym-card"
                        :class="card.cls"
                      >
                        <div class="sym-card__head">
                          <span class="sym-card__symbol">{{ card.symbol }}</span>
                          <span class="sym-card__cat">{{ card.categoryLabel }}</span>
                        </div>
                        <div class="sym-grid">
                          <span class="sym-grid__corner"></span>
                          <span class="sym-grid__col">INGRESSO</span>
                          <span class="sym-grid__col">USCITA</span>
                          <span class="sym-grid__col">GUAD.</span>

                          <span class="sym-grid__row">Backtest</span>
                          <span>{{ card.btEntry }}</span>
                          <span>{{ card.btExit }}</span>
                          <span :class="pctClass(card.btPctRaw)">{{ card.btPct || '—' }}</span>

                          <span class="sym-grid__row">Alpaca</span>
                          <span>{{ executionText(card.liveEntry, card.liveEntryCodes) }}</span>
                          <span :class="{ 'text-negative text-weight-medium': card.exitBad, 'text-grey-5': card.exitStale }">{{ executionText(card.liveExit, card.liveExitCodes) }}</span>
                          <span :class="pctClass(card.livePctRaw)">{{ card.livePct || '—' }}</span>
                        </div>
                        <div v-if="card.footer" class="sym-card__foot">{{ card.footer }}</div>
                      </div>
                    </div>

                    <div class="text-caption text-grey-6 q-mt-sm">
                      "Guad." = rendimento del round-trip (uscita vs ingresso). Prezzo di uscita backtest ricavato da pnl/size.
                      "Due strategie diverse" / contaminazione account → riquadro "Account e proprietà" sopra (guardrail).
                    </div>
                    <div class="text-caption text-grey-6">Legenda Alpaca: <b>c</b> asta di chiusura (CLS), <b>o</b> asta di apertura (OPG), <b>m</b> mercato, <b>f</b> fallback dopo asta non eseguita.</div>
                    <div v-if="props.row.raw.replay_outpath" class="text-caption text-grey-6">
                      Output replay: <code>{{ props.row.raw.replay_outpath }}</code>
                    </div>
                  </template>
                  </template>
                </div>
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card>

      <!-- Timeline parametri completa -->
      <q-card flat bordered>
        <q-card-section>
          <div class="text-subtitle2 text-grey-8">Cosa è cambiato nel tempo</div>
        </q-card-section>
        <q-separator />
        <q-card-section v-if="changeMarkers.length" class="q-py-sm">
          <div class="text-caption text-grey-7 q-mb-xs">Marcatori: <b>automatico</b> = cambio rilevato di parametri/codice; <b>manuale</b> = nota operativa.</div>
          <div class="row q-gutter-xs">
            <q-badge v-for="marker in changeMarkers" :key="marker.id" outline :color="marker.source === 'manuale' ? 'deep-purple' : 'primary'" class="q-pa-xs">
              {{ formatDate(marker.trading_date) }} · {{ marker.label }}
              <span v-if="marker.source === 'automatico' && (marker.code_git_ref || marker.core_commit)" class="q-ml-xs">{{ marker.code_git_ref || marker.core_commit.slice(0, 8) }}</span>
            </q-badge>
          </div>
        </q-card-section>
        <q-list separator>
          <q-item v-for="v in reversedTimeline" :key="v.id">
            <q-item-section>
              <q-item-label>
                {{ formatDate(v.effective_from_date) }} → {{ v.effective_to_date ? formatDate(v.effective_to_date) : 'oggi' }}
                <q-badge :color="v.source === 'observed_run' ? 'positive' : 'grey-6'" class="q-ml-sm">
                  {{ v.source === 'observed_run' ? 'osservato' : 'ricostruito' }}
                </q-badge>
              </q-item-label>
              <q-item-label caption>
                commit codice: {{ v.core_commit ? v.core_commit.slice(0, 10) : 'non registrato' }}
                —
                <q-btn flat dense no-caps color="primary" label="Parametri" @click="openParams(v)">
                  <q-tooltip>{{ JSON.stringify(v.stratargs || {}, null, 2) }}</q-tooltip>
                </q-btn>
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </template>
  </q-page>
</template>

<script>
import { api } from 'boot/axios'

const CATEGORY_LABELS = {
  never_submitted: 'atteso dal backtest ma nessun ordine reale trovato',
  live_order_not_filled: 'ordine reale inviato ma non eseguito (rifiutato / annullato / in sospeso)',
  partial_fill: 'ordine reale eseguito solo parzialmente',
  extra_live_order: 'ordine reale senza corrispondenza nel backtest (possibile divergenza di segnale/dati)',
  matched: 'combacia con il backtest',
  exit_missing: 'posizione entrata ma mai chiusa: nessun ordine di uscita reale',
  exit_not_filled: 'ordine di uscita inviato ma non eseguito (scaduto / rifiutato / in sospeso)',
  exit_partial_fill: 'uscita eseguita solo in parte: posizione ancora parzialmente aperta',
}

const EXIT_ISSUE_LABELS = {
  missing: 'nessun ordine di uscita',
  partial_fill: 'uscita parziale',
}

export default {
  name: 'WatchtowerCronMonitoring',
  data() {
    return {
      profiles: [],
      selectedProfile: null,
      overview: null,
      loading: false,
      loadError: '',
      expandedDays: [],
      tablePagination: { rowsPerPage: 10 },
      selectedBaselineId: null,
      markerDate: new Date().toISOString().slice(0, 10),
      markerLabel: '',
      markerSaving: false,
      paramsDialog: false,
      paramsDialogVersion: null,
      historyDays: 20,
      historyDayOptions: [5, 10, 20, 30, 60].map(value => ({ value, label: `${value} giorni` })),
    }
  },
  computed: {
    profileOptions() {
      return this.profiles.map((p) => ({
        label: `${p.profile} (${p.strategy || 'strategia sconosciuta'})`,
        value: p.profile,
      }))
    },
    profileTitleLabel() {
      const label = String(this.overview?.registry?.display_name || '').trim()
      return label && label.toLowerCase() !== String(this.selectedProfile || '').trim().toLowerCase()
        ? label
        : ''
    },
    latestResult() {
      const results = this.overview?.reconciliation_results || []
      return results.length ? results[0] : null
    },
    latestActivity() {
      return this.reconciliationRows[0] || null
    },
    latestEntryComparison() {
      const comparisons = this.overview?.entry_comparisons || []
      return comparisons.length ? comparisons[0] : null
    },
    historicalEntryIssues() {
      const latestDate = String(this.latestEntryComparison?.trading_date || '').slice(0, 10)
      if (!latestDate) return []
      return (this.overview?.entry_comparisons || []).filter((item) => {
        const day = String(item.trading_date || '').slice(0, 10)
        return day < latestDate && ['diverged', 'error'].includes(item.status)
      }).slice(0, 10).map((item) => {
        const day = String(item.trading_date).slice(0, 10)
        const diffs = item.diffs || []
        const first = diffs[0] || {}
        return {
          day,
          label: this.formatDate(day),
          status: item.status,
          kind: item.status === 'error' ? 'run fallito' : 'ingressi divergenti',
          detail: first.error || first.category || first.kind || this.entryComparisonLabel(item),
        }
      })
    },
    pendingCount() {
      return this.pendingDates.length
    },
    pendingDates() {
      const today = new Date().toISOString().slice(0, 10)
      return (this.overview?.pending_queue || []).filter((pending) => String(pending.trading_date).slice(0, 10) < today).map((pending) => {
        const day = String(pending.trading_date).slice(0, 10)
        return {
          day,
          label: this.formatDate(day),
          detail: pending.reason === 'no_exit_leg_evidence_yet'
            ? 'in attesa dell’evidenza di chiusura'
            : (pending.reason || 'in attesa di elaborazione'),
        }
      })
    },
    currentParamsEqual() {
      const version = this.overview?.current_version
      if (!version) return true
      return JSON.stringify(version.stratargs || {}) === JSON.stringify(this.backtestStratargs(version))
    },
    currentParamsText() {
      return JSON.stringify(this.overview?.current_version?.stratargs || {}, null, 2)
    },
    backtestParamsText() {
      return JSON.stringify(this.backtestStratargs(this.overview?.current_version), null, 2)
    },
    dialogParamsVersion() { return this.paramsDialogVersion || this.overview?.current_version || null },
    dialogParamsText() { return JSON.stringify(this.dialogParamsVersion?.stratargs || {}, null, 2) },
    paramsDialogTitle() { return this.paramsDialogVersion ? 'Parametri della versione storica' : 'Parametri correnti' },
    paramsDialogBacktestVisible() {
      const version = this.dialogParamsVersion
      return version && JSON.stringify(version.stratargs || {}) !== JSON.stringify(this.backtestStratargs(version))
    },
    prePost() {
      const footprints = this.overview?.footprints || []
      return {
        pre: footprints.find((f) => f.period === 'pre_activation'),
        post: footprints.find((f) => f.period === 'post_activation'),
      }
    },
    baselineOptions() { return (this.overview?.baselines || []).map((b) => ({ label: `${b.label} (${this.dateRange(b)})`, value: b.id })) },
    selectedBaseline() {
      const rows = this.overview?.baselines || []
      return rows.find((b) => b.id === this.selectedBaselineId) || rows[0] || null
    },
    comparisonWindows() {
      return [3, 5, 10, 15, 20, 25].map((days) => ({
        days,
        comparison: this.overview?.reconciliation_statistics?.backtest?.[String(days)] || null,
      }))
    },
    alpacaComparisonWindows() {
      return [3, 5, 10, 15, 20, 25].map((days) => ({
        days,
        comparison: this.overview?.reconciliation_statistics?.alpaca?.[String(days)] || null,
      }))
    },
    replayParamsVersion() {
      return (result) => {
        const id = result?.params_version_id
        const versions = this.overview?.timeline || []
        return versions.find((version) => version.id === id) || this.overview?.current_version || null
      }
    },
    reversedTimeline() {
      return [...(this.overview?.timeline || [])].reverse()
    },
    changeMarkers() {
      return [...(this.overview?.change_markers || [])].sort((a, b) => String(b.trading_date).localeCompare(String(a.trading_date)))
    },
    automaticChangesByDate() {
      const changes = {}
      for (const marker of this.overview?.change_markers || []) {
        if (marker.source !== 'automatico' || !['params', 'code', 'both'].includes(marker.change_kind)) continue
        changes[String(marker.trading_date).slice(0, 10)] = {
          kind: marker.change_kind,
          label: marker.label,
        }
      }
      return changes
    },
    reconciliationColumns() {
      return [
        { name: 'expand', label: '', field: 'expand', align: 'left' },
        { name: 'trading_date', label: 'Giorno', field: 'trading_date', align: 'left' },
        { name: 'status', label: 'Esito', field: 'statusLabel', align: 'left' },
        { name: 'day_return', label: 'Guadagno giorno', field: 'day_return', align: 'left' },
        { name: 'detail', label: 'Dettaglio', field: 'detail', align: 'left' },
      ]
    },
    reconciliationRows() {
      const results = this.overview?.reconciliation_results || []
      const decisions = this.overview?.entry_decisions || []
      const settlements = this.overview?.entry_settlements || []
      const comparisons = this.overview?.entry_comparisons || []
      const alpacaActivity = this.overview?.alpaca_order_activity || []
      const byDate = new Map()
      results.forEach((r) => {
        const day = String(r.trading_date).slice(0, 10)
        byDate.set(day, { result: r, decisions: {}, settlements: {} })
      })
      decisions.forEach((d) => {
        const day = String(d.trading_date).slice(0, 10)
        if (!byDate.has(day)) byDate.set(day, { result: null, decisions: {}, settlements: {} })
        byDate.get(day).decisions[d.source] = d
      })
      settlements.forEach((s) => {
        const day = String(s.trading_date).slice(0, 10)
        if (!byDate.has(day)) byDate.set(day, { result: null, decisions: {}, settlements: {} })
        const bySource = byDate.get(day).settlements
        if (!bySource[s.source]) bySource[s.source] = []
        bySource[s.source].push(s)
      })
      comparisons.forEach((comparison) => {
        const day = String(comparison.trading_date).slice(0, 10)
        if (!byDate.has(day)) byDate.set(day, { result: null, decisions: {}, settlements: {} })
        byDate.get(day).comparison = comparison
      })
      alpacaActivity.forEach((order) => {
        const day = String(order.window_open).slice(0, 10)
        if (!byDate.has(day)) byDate.set(day, { result: null, decisions: {}, settlements: {} })
        const item = byDate.get(day)
        if (!item.alpacaActivity) item.alpacaActivity = []
        item.alpacaActivity.push(order)
      })
      const rows = [...byDate.entries()].map(([day, item]) => ({
        key: `day-${day}`,
        sortDate: day,
        trading_date: this.formatDate(day),
        statusLabel: this.brokerActivityOverridesWatchdog(item)
          ? this.brokerTelemetryLabel(item)
          : (item.comparison ? this.entryComparisonLabel(item.comparison) : (item.result ? this.rowStatusLabel(item.result) : this.entryStatusLabel(item.decisions))),
        badgeColor: this.brokerActivityOverridesWatchdog(item)
          ? 'dark'
          : (item.comparison ? this.entryComparisonColor(item.comparison) : (item.result ? this.rowBadgeColor(item.result) : this.entryStatusColor(item.decisions))),
        detail: [
          this.brokerActivityOverridesWatchdog(item) ? this.brokerTelemetryDetail(item) : '',
          this.entryHeadline(item.decisions, item.settlements),
          this.alpacaActivityHeadline(item.alpacaActivity),
          this.resultHeadline(item.result),
        ].filter(Boolean).join(' · '),
        change: item.result?.change || this.automaticChangesByDate[day] || null,
        raw: item.result,
        decisions: item.decisions,
        settlements: item.settlements,
        alpacaActivity: item.alpacaActivity || [],
      }))
      const pendingRows = (this.overview?.pending_queue || [])
        .filter((p) => !byDate.has(String(p.trading_date).slice(0, 10)))
        .slice(0, 15).map((p) => ({
        key: `pend-${p.trading_date}`,
        sortDate: String(p.trading_date).slice(0, 10),
        trading_date: this.formatDate(p.trading_date),
        statusLabel: p.status === 'blocked_missing_params' ? 'parametri sconosciuti' : 'in coda',
        badgeColor: p.status === 'blocked_missing_params' ? 'grey-7' : 'orange',
        detail: p.reason === 'open_day' ? 'giorno ancora aperto / non settled' : 'in attesa di elaborazione',
        raw: null,
      }))
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - this.historyDays + 1)
      const cutoffDay = cutoff.toISOString().slice(0, 10)
      return [...pendingRows, ...rows]
        .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
        .filter((row) => row.sortDate >= cutoffDay)
    },
    statusHeadline() {
      if (!this.overview) return ''
      if ((this.overview.open_guardrail_alerts || []).length) {
        return 'Attenzione: possibile contaminazione tra strategie sullo stesso account'
      }
      // The banner answers one question only: did the latest scheduled entry
      // agree? Older telemetry/replay failures remain visible below, but must
      // not make a successful current run look failed.
      if (this.latestEntryComparison?.status === 'matched') {
        return this.pendingCount
          ? 'Ultimo ingresso coerente · arretrati da recuperare'
          : 'Ultimo ingresso coerente'
      }
      if (['diverged', 'error'].includes(this.latestEntryComparison?.status)) {
        return 'Divergenza rilevata nell\'ultimo ingresso'
      }
      const latestEntryDay = String(this.latestEntryComparison?.trading_date || '').slice(0, 10)
      const latestResultDay = String(this.latestResult?.trading_date || '').slice(0, 10)
      const hardIssue = latestResultDay >= latestEntryDay && this.latestResult?.summary?.counts &&
        Object.keys(this.latestResult.summary.counts).some((k) => k !== 'matched' && k !== 'sizing_divergence')
      if (hardIssue) return 'Divergenza rilevata nell\'ultima riconciliazione completa'
      if (this.overview.latest_drift_check?.status === 'warning') return 'Possibile cambio di regime nella strategia'
      return 'Tutto nella norma'
    },
    statusSubline() {
      if (!this.overview) return ''
      const parts = []
      if (this.latestActivity) parts.push(`Ultima attività: ${this.latestActivity.trading_date}`)
      if (this.latestResult) {
        const currentEntryDay = String(this.latestEntryComparison?.trading_date || '').slice(0, 10)
        const resultDay = String(this.latestResult.trading_date || '').slice(0, 10)
        parts.push(`${resultDay < currentEntryDay ? 'Ultima riconciliazione completa (storica)' : 'Ultima riconciliazione completa'}: ${this.formatDate(this.latestResult.trading_date)}`)
      }
      if (this.pendingCount) parts.push(`${this.pendingCount} giornate storiche da recuperare`)
      return parts.join(' — ') || 'Nessun dato di riconciliazione ancora disponibile'
    },
    statusIcon() {
      const h = this.statusHeadline
      if (h.startsWith('Attenzione') || h.startsWith('Divergenza')) return 'error'
      if (h.startsWith('Possibile') || h.includes('arretrati')) return 'warning'
      return 'check_circle'
    },
    statusBannerClass() {
      const h = this.statusHeadline
      if (h.startsWith('Attenzione') || h.startsWith('Divergenza')) return 'bg-negative'
      if (h.startsWith('Possibile') || h.includes('arretrati')) return 'bg-warning text-dark'
      return 'bg-positive'
    },
  },
  async mounted() {
    await this.loadProfiles()
  },
  methods: {
    openParams(version) {
      this.paramsDialogVersion = version || null
      this.paramsDialog = true
    },
    async copyCurrentParams() {
      const version = this.dialogParamsVersion
      const same = JSON.stringify(version?.stratargs || {}) === JSON.stringify(this.backtestStratargs(version))
      const text = same ? this.dialogParamsText : `Strategia:\n${this.dialogParamsText}\n\nReplay Backtest:\n${JSON.stringify(this.backtestStratargs(version), null, 2)}`
      try {
        await navigator.clipboard.writeText(text)
        this.$q.notify({ color: 'positive', message: 'Parametri copiati' })
      } catch (error) {
        this.$q.notify({ color: 'negative', message: 'Copia non disponibile nel browser' })
      }
    },
    settlementLabel(settlements) {
      if (!settlements?.length) return 'chiusura pending'
      const pending = settlements.filter((s) => s.status === 'pending').length
      const closed = settlements.filter((s) => s.status === 'closed')
      const parts = []
      if (pending) parts.push(`${pending} chiusura/e pending`)
      if (closed.length) {
        const pnl = closed.reduce((sum, s) => sum + Number(s.pnl || 0), 0)
        parts.push(`${closed.length} chiusa/e · gain ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}`)
      }
      return parts.join(' · ') || 'chiusura non comunicata'
    },
    entryDecisionLabel(decision, settlements) {
      if (!decision) return 'run non eseguito'
      if (decision.run_status === 'running') return 'in esecuzione'
      if (decision.run_status === 'failed') return `errore run: ${decision.error || 'errore sconosciuto'}`
      if (!decision.outcome) return 'strategia eseguita · causale non comunicata'
      const reasons = (decision.reasons || []).map((r) => r?.code || r?.detail).filter(Boolean)
      if (decision.outcome === 'no_orders') return `nessun ordine · ${reasons.join(' | ') || 'causale non comunicata'}`
      return `${(decision.orders || []).length} ordini · ${this.settlementLabel(settlements)}`
    },
    entryHeadline(decisions, settlements = {}) {
      if (!decisions || (!decisions.backtest && !decisions.alpaca)) return ''
      return `Backtest: ${this.entryDecisionLabel(decisions.backtest, settlements.backtest)} · Alpaca: ${this.entryDecisionLabel(decisions.alpaca, settlements.alpaca)}`
    },
    alpacaActivityHeadline(orders) {
      const closes = (orders || []).filter((order) => order.intent === 'CLOSE')
      if (!closes.length) return ''
      const failed = closes.filter((order) => ['rejected', 'canceled', 'expired', 'failed'].includes(String(order.status || '').toLowerCase()))
      const filled = closes.filter((order) => String(order.status || '').toLowerCase() === 'filled')
      const parts = []
      if (failed.length) parts.push(`${failed.length} chiusura/e Alpaca non eseguita/e`)
      if (filled.length) parts.push(`${filled.length} chiusura/e Alpaca eseguita/e`)
      return parts.join(', ')
    },
    entryStatusLabel(decisions) {
      if (Object.values(decisions || {}).some((d) => d?.run_status === 'failed')) return 'errore run'
      if (Object.values(decisions || {}).some((d) => d?.run_status === 'running')) return 'in esecuzione'
      return 'decisioni ingresso'
    },
    entryStatusColor(decisions) {
      if (Object.values(decisions || {}).some((d) => d?.run_status === 'failed')) return 'negative'
      if (Object.values(decisions || {}).some((d) => d?.run_status === 'running')) return 'orange'
      return 'primary'
    },
    brokerActivityOverridesWatchdog(item) {
      if (!item?.alpacaActivity?.length) return false
      const errors = Object.values(item.decisions || {})
        .filter((decision) => decision?.run_status === 'failed')
        .map((decision) => String(decision.error || ''))
      return errors.length > 0 && errors.every((error) => error.includes('watchdog deadline'))
    },
    watchdogMissingSources(item) {
      return Object.entries(item?.decisions || {})
        .filter(([, decision]) => decision?.run_status === 'failed' && String(decision.error || '').includes('watchdog deadline'))
        .map(([source]) => source === 'backtest' ? 'Backtest' : 'Alpaca')
    },
    brokerTelemetryLabel(item) {
      const missing = this.watchdogMissingSources(item)
      return `telemetria incompleta${missing.length ? `: ${missing.join(' / ')} non tracciato` : ''}`
    },
    brokerTelemetryDetail(item) {
      const orders = item?.alpacaActivity?.length || 0
      const missing = this.watchdogMissingSources(item)
      return `Broker: ${orders} ordine/i rilevato/i; ricevuta Watchtower assente per ${missing.join(' / ') || 'il run'}. Confronto Backtest/Alpaca non affidabile.`
    },
    isExpandable(row) {
      return Boolean(row?.raw || Object.keys(row?.decisions || {}).length || Object.keys(row?.settlements || {}).length || row?.alpacaActivity?.length)
    },
    decisionState(decision) {
      if (!decision) return 'non ricevuto'
      if (decision.run_status === 'failed') return 'errore'
      if (decision.run_status === 'running') return 'in esecuzione'
      if (decision.outcome === 'no_orders') return 'nessun ordine'
      return decision.outcome === 'orders' ? 'ordini' : 'completato'
    },
    decisionColor(decision) {
      if (!decision) return 'grey-6'
      if (decision.run_status === 'failed') return 'negative'
      if (decision.run_status === 'running') return 'orange'
      if (decision.outcome === 'no_orders') return 'blue-grey'
      return 'primary'
    },
    alpacaActivityText(order) {
      const intent = order.intent === 'CLOSE' ? 'CHIUSURA' : (order.intent === 'OPEN' ? 'APERTURA' : 'ORDINE')
      return `${intent} ${order.symbol || '—'} · ${(order.side || '—').toUpperCase()} · ${order.status || 'stato sconosciuto'}`
    },
    alpacaActivityDetail(order) {
      const parts = []
      if (order.time_in_force) parts.push(String(order.time_in_force).toUpperCase())
      if (order.qty !== null && order.qty !== undefined) parts.push(`qty ${this.qty(order.filled_qty || 0)} / ${this.qty(order.qty)}`)
      if (order.filled_avg_price) parts.push(`prezzo ${this.num(order.filled_avg_price)}`)
      if (order.position_intent) parts.push(order.position_intent)
      return parts.join(' · ') || 'Nessun dettaglio broker disponibile'
    },
    decisionReasons(decision) {
      return (decision?.reasons || [])
        .map((reason) => reason?.label || reason?.detail || reason?.code || String(reason))
        .filter(Boolean)
        .join(' · ')
    },
    backtestReceiptTitle(settlements) {
      return settlements?.some((item) => item.status === 'closed')
        ? 'Backtrader — trade simulati completi'
        : 'Backtrader — piano simulato'
    },
    backtestOrderSettlement(order, settlements) {
      const symbol = String(order?.symbol || '').toUpperCase()
      return (settlements || []).find((item) => item.symbol === symbol && item.side === 'buy') || null
    },
    backtestOrderSettlementText(order, settlements) {
      const settled = this.backtestOrderSettlement(order, settlements)
      if (!settled || settled.status !== 'closed') return ''
      const pnl = Number(settled.pnl || 0)
      return `CHIUSURA · SELL ${settled.symbol} · ${this.qty(settled.qty)} @ ${this.num(settled.exit_price)} · ${this.formatDate(settled.exit_date)} · P&L ${pnl >= 0 ? '+' : ''}${this.num(pnl)} (${this.signedPct(settled.pnl_pct)})`
    },
    alpacaOrderSettlement(order, settlements) {
      const symbol = String(order?.symbol || '').toUpperCase()
      const filled = Number(order?.filled_qty || 0) > 0 || String(order?.broker_status || order?.status || '').toLowerCase() === 'filled'
      if (!filled) return null
      const settled = (settlements || []).find((item) => item.symbol === symbol && item.side === 'buy')
      return settled?.status === 'closed' ? settled : null
    },
    alpacaOrderSettlementText(order, settlements) {
      const settled = this.alpacaOrderSettlement(order, settlements)
      if (!settled) return ''
      const pnl = Number(settled.pnl || 0)
      const marker = settled.detail?.exit_execution
      return `CHIUSURA · SELL ${settled.symbol} · ${this.qty(settled.qty)} @ ${this.num(settled.exit_price)} · ${this.formatDate(settled.exit_date)}${marker ? ` · ${marker}` : ''} · P&L ${pnl >= 0 ? '+' : ''}${this.num(pnl)} (${this.signedPct(settled.pnl_pct)})`
    },
    orderText(order, source, settlements) {
      if (!order) return 'Ordine non disponibile'
      const symbol = order.symbol || '—'
      const side = String(order.side || '').toUpperCase() || 'ORDINE'
      const qty = order.filled_qty ?? order.qty
      const price = order.filled_avg_price ?? order.reference_price
      if (source === 'backtest') {
        const settled = this.backtestOrderSettlement(order, settlements)
        return `${side} ${symbol} · ${this.qty(qty)}${price != null ? ` @ ${this.num(price)}` : ''} · ${settled?.status === 'closed' ? 'APERTURA' : 'apertura prevista'}`
      }
      const execution = order.broker_status || order.status || (order.execution_effective === false ? 'non eseguito' : 'inviato')
      const settled = this.alpacaOrderSettlement(order, settlements)
      const marker = settled?.detail?.entry_execution
      return `${side} ${symbol} · ${this.qty(qty)}${price != null ? ` @ ${this.num(price)}` : ''} · ${execution}${marker ? ` · ${marker}` : ''}`
    },
    orderBrokerDetail(order, source) {
      if (!order) return ''
      const parts = []
      if (source === 'backtest') {
        if (order.client_order_id) parts.push(`id tecnico locale ${order.client_order_id}`)
        return parts.join(' · ') || 'Nessun identificativo locale disponibile'
      }
      if (order.client_order_id) parts.push(`client id ${order.client_order_id}`)
      if (order.alpaca_order_id || order.id) parts.push(`broker id ${order.alpaca_order_id || order.id}`)
      if (order.execution_effective === false) parts.push('non conta come esecuzione effettiva')
      return parts.join(' · ') || 'Dettaglio broker non ancora disponibile'
    },
    backtestSettlementExplanation(settlements) {
      const label = this.settlementLabel(settlements)
      if (!settlements?.length || settlements.every((item) => item.status === 'pending')) {
        return `Chiusura simulata: ${label}. Non può essere nota nella decisione d'ingresso; verrà mostrata soltanto da un replay con la candela successiva.`
      }
      return `Esito dei trade completi nel replay: ${label}.`
    },
    entryComparisonLabel(comparison) {
      return ({ matched: 'ingressi allineati', diverged: 'divergenza ingressi', incomplete: 'riconciliazione incompleta', error: 'errore riconciliazione' })[comparison?.status] || 'riconciliazione ingressi'
    },
    entryComparisonColor(comparison) {
      return ({ matched: 'positive', diverged: 'negative', incomplete: 'orange', error: 'negative' })[comparison?.status] || 'primary'
    },
    async loadProfiles() {
      this.loading = true
      this.loadError = ''
      try {
        const { data } = await api.get('/dyn/obs/watchtower/cron/profiles', {
          params: { _ts: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
        })
        this.profiles = data || []
        if (this.profiles.length && !this.selectedProfile) {
          this.selectedProfile = this.profiles[0].profile
        }
        if (this.selectedProfile) await this.loadOverview()
      } catch (err) {
        this.loadError = `Impossibile caricare i profili: ${err?.message || err}`
      } finally {
        this.loading = false
      }
    },
    async loadOverview() {
      if (!this.selectedProfile) return
      this.loading = true
      this.loadError = ''
      try {
        const { data } = await api.get(`/dyn/obs/watchtower/cron/${this.selectedProfile}/overview`, {
          params: { _ts: Date.now() },
          headers: { 'Cache-Control': 'no-cache' },
        })
        this.overview = data
        if (!this.selectedBaselineId && data?.baselines?.length) {
          this.selectedBaselineId = data.baselines[0].id
        }
      } catch (err) {
        this.loadError = `Impossibile caricare il profilo ${this.selectedProfile}: ${err?.message || err}`
        this.overview = null
      } finally {
        this.loading = false
      }
    },
    async createChangeMarker() {
      if (!this.markerDate || !this.markerLabel.trim() || !this.selectedProfile) return
      this.markerSaving = true
      this.loadError = ''
      try {
        await api.post(`/dyn/obs/watchtower/cron/${this.selectedProfile}/change-markers`, {
          trading_date: this.markerDate,
          label: this.markerLabel.trim(),
        })
        this.markerLabel = ''
        await this.loadOverview()
      } catch (err) {
        this.loadError = `Impossibile salvare l'etichetta: ${err?.response?.data?.error || err?.message || err}`
      } finally {
        this.markerSaving = false
      }
    },
    formatDate(value) {
      if (!value) return '—'
      return String(value).slice(0, 10)
    },
    changeIcon(kind) {
      if (kind === 'params') return 'tune'
      if (kind === 'code') return 'code'
      return 'published_with_changes'
    },
    dateRange(footprint) {
      if (!footprint) return '—'
      const range = `${this.formatDate(footprint.window_start)} → ${this.formatDate(footprint.window_end)}`
      if (Number.isFinite(Number(footprint.observed_day_count))) {
        const expected = Number(footprint.observed_day_count) + Number(footprint.missing_day_count || 0)
        return `${range} · ${footprint.observed_day_count}/${expected} replay`
      }
      return range
    },
    pct(value) {
      if (value === null || value === undefined) return '—'
      return `${(Number(value) * 100).toFixed(1)}%`
    },
    backtestStratargs(version) {
      if (!version?.stratargs) return {}
      return { ...version.stratargs, auction: true }
    },
    pctSigned(value) {
      if (value === null || value === undefined) return '—'
      const v = Number(value)
      return `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`
    },
    compatibilityLabel(comparison) {
      const baselineMean = Number(this.selectedBaseline?.metrics?.mean)
      const baselineStddev = Number(this.selectedBaseline?.metrics?.stddev)
      const recentMean = Number(comparison?.recent?.metrics?.mean)
      const sampleSize = Number(comparison?.recent?.sample_size)
      if (![baselineMean, baselineStddev, recentMean, sampleSize].every(Number.isFinite) || baselineStddev <= 0 || sampleSize <= 0) return '—'
      const z = Math.abs(recentMean - baselineMean) / (baselineStddev / Math.sqrt(sampleSize))
      return this.pct(this.normalTwoSidedProbability(z))
    },
    normalTwoSidedProbability(z) {
      // Abramowitz-Stegun approximation of erfc(z / sqrt(2)).
      const t = 1 / (1 + 0.2316419 * z)
      const density = 0.3989422804014327 * Math.exp(-0.5 * z * z)
      const upperTail = density * ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530) * t
      return Math.max(0, Math.min(1, 2 * upperTail))
    },
    rowBadgeColor(result) {
      if (result.status === 'error') return 'grey-8'
      const counts = result.summary?.counts || {}
      const hard = Object.keys(counts).some((k) => k !== 'matched' && k !== 'sizing_divergence')
      return hard ? 'negative' : 'positive'
    },
    rowStatusLabel(result) {
      if (result.status === 'error') return 'errore replay'
      const counts = result.summary?.counts || {}
      const hard = Object.keys(counts).some((k) => k !== 'matched' && k !== 'sizing_divergence')
      return hard ? 'divergenza' : 'pulito'
    },
    resultHeadline(result) {
      if (!result) return ''
      if (result.status === 'error') return 'Il replay del backtest è fallito per questo giorno.'
      if (result.summary?.bt_no_trade || result.summary?.live_no_trade) {
        const side = (name, noTrade, reasons, count) => {
          if (!noTrade) return `${name}: ${count || 0} ordine/i`
          const labels = (reasons || []).map((r) => r?.label || r?.detail || String(r))
          return `${name}: nessun ordine — ${labels.join(' | ') || 'causale non disponibile'}`
        }
        return [
          side('Backtest', result.summary?.bt_no_trade, result.summary?.bt_no_trade_reasons, result.summary?.bt_entry_count),
          side('Alpaca', result.summary?.live_no_trade, result.summary?.live_no_trade_reasons, result.summary?.live_entry_count),
        ].join(' · ')
      }
      const counts = result.summary?.counts || {}
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      const matched = counts.matched || 0
      const hardKeys = Object.keys(counts).filter((k) => k !== 'matched' && k !== 'sizing_divergence')
      if (!hardKeys.length) {
        return `${matched} di ${total} ordini combaciano con il backtest, nessun problema.`
      }
      return `${hardKeys.length} tipo/i di divergenza su ${total} ordini confrontati.`
    },
    resultDetail(result) {
      if (!result || result.status === 'error') return result?.error || ''
      const sizing = (result.summary?.counts || {}).sizing_divergence
      if (sizing) {
        return 'Le quantità differiscono leggermente dal backtest: atteso, l\'equity simulata nel backtest diverge da quella reale su una finestra lunga — non è un errore di esecuzione.'
      }
      return ''
    },
    humanDiffs(result) {
      if (!result || !result.diffs) return []
      const hardDiffs = result.diffs.filter((d) => d.category !== 'matched')
      return hardDiffs.slice(0, 8).map((d) => {
        const label = CATEGORY_LABELS[d.category] || CATEGORY_LABELS[(d.category || '').split(':')[0]] || d.category
        return `${d.symbol}: ${label}`
      })
    },
    guardrailAlertText(alert) {
      const map = {
        multiple_source_accounts: 'Ordini con etichette account diverse sullo stesso account reale.',
        source_account_registry_mismatch: 'L\'account reale non corrisponde al profilo registrato.',
        multiple_client_order_id_run_tags: 'Ordini di più strategie diverse rilevati sullo stesso account.',
        client_order_id_run_tag_mismatch: 'Un ordine porta l\'identificativo di un\'altra strategia.',
        unregistered_account: 'Account non ancora registrato nel sistema.',
      }
      return map[alert.alert_type] || alert.alert_type
    },

    // ----- Drill-down per-giorno della riconciliazione (punto C) -----
    toggleDay(key) {
      const i = this.expandedDays.indexOf(key)
      if (i >= 0) this.expandedDays.splice(i, 1)
      else this.expandedDays.push(key)
    },
    goToDay(day) {
      const key = `day-${day}`
      const index = this.reconciliationRows.findIndex((row) => row.key === key || row.key === `pend-${day}`)
      if (index >= 0) {
        this.tablePagination.page = Math.floor(index / this.tablePagination.rowsPerPage) + 1
        if (!this.expandedDays.includes(key)) this.expandedDays.push(key)
      }
      this.$nextTick(() => document.getElementById('reconciliation-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    },
    daySummary(result) {
      return result?.summary || {}
    },
    num(value) {
      if (value === null || value === undefined || value === '') return '—'
      return Number(value).toLocaleString('it-IT', { maximumFractionDigits: 2 })
    },
    qty(value) {
      if (value === null || value === undefined || value === '') return '—'
      return Number(value).toLocaleString('it-IT', { maximumFractionDigits: 4 })
    },
    bps(value) {
      if (value === null || value === undefined) return '—'
      const n = Number(value)
      return `${n >= 0 ? '+' : ''}${n.toFixed(1)} bps`
    },
    diffCategoryLabel(category) {
      const cat = String(category || '')
      if (cat.startsWith('live_order_not_filled:')) {
        const st = cat.split(':')[1] || 'sconosciuto'
        const map = {
          rejected: 'rifiutato', canceled: 'annullato', cancelled: 'annullato',
          expired: 'scaduto', pending: 'in sospeso', new: 'in sospeso',
          accepted: 'in sospeso', done_for_day: 'chiuso a fine giornata',
        }
        return `ordine inviato ma non eseguito — ${map[st] || st}`
      }
      return CATEGORY_LABELS[cat] || cat
    },
    signedPct(value) {
      if (value === null || value === undefined) return ''
      const n = Number(value)
      return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
    },
    executionText(value, codes) {
      if (!value || value === '—' || !Array.isArray(codes) || !codes.length) return value || '—'
      return `${value} [${codes.join('/')}]`
    },
    fmtDayRet(value) {
      if (value === null || value === undefined) return '—'
      return this.signedPct(value)
    },
    pctClass(value) {
      if (value === null || value === undefined || value === '') return 'text-grey-6'
      return Number(value) >= 0 ? 'text-positive' : 'text-negative'
    },
    symbolCards(result) {
      const diffs = result?.diffs || []
      const order = { never_submitted: 0, partial_fill: 1, extra_live_order: 2, matched: 4 }
      const rank = (c) => (c && c.startsWith('live_order_not_filled') ? 3 : (order[c] ?? 5))
      const qp = (q, p) => (q == null && p == null ? '—' : `${this.qty(q)} @ ${this.num(p)}`)
      return [...diffs]
        .sort((a, b) => rank(a.category) - rank(b.category))
        .map((d) => {
          const cat = d.category || ''
          const bt = d.bt || {}
          const live = d.live && !Array.isArray(d.live) ? d.live : {}
          const btPctRaw = d.bt_pnl_pct != null ? d.bt_pnl_pct : (bt.bt_pnl_pct != null ? bt.bt_pnl_pct : null)
          // A fresh reconcile record always carries the exit_issue key
          // (null when the exit filled fine). Its absence = an old record
          // written before exit reconciliation -> show "n/d", not an alarm.
          const exitReconciled = Object.prototype.hasOwnProperty.call(d, 'exit_issue')
          const exitIssue = d.exit_issue || null
          const card = {
            symbol: d.symbol || '—',
            category: cat,
            categoryLabel: this.diffCategoryLabel(cat),
            cls: cat !== 'matched'
              ? 'card-hard'
              : (exitIssue ? 'card-hard' : (d.sizing_divergence ? 'card-soft' : 'card-ok')),
            btEntry: bt.bt_entry_price != null ? qp(bt.bt_qty, bt.bt_entry_price) : '—',
            btExit: bt.bt_exit_price != null ? qp(bt.bt_exit_qty != null ? bt.bt_exit_qty : bt.bt_qty, bt.bt_exit_price) : '—',
            liveEntry: '—',
            liveExit: '—',
            liveEntryCodes: d.live_entry_execution_codes || live.execution_codes || [],
            liveExitCodes: d.live_exit_execution_codes || [],
            exitBad: false,
            exitStale: false,
            btPctRaw,
            btPct: this.signedPct(btPctRaw),
            livePctRaw: d.live_pnl_pct != null ? d.live_pnl_pct : null,
            livePct: this.signedPct(d.live_pnl_pct),
            footer: '',
          }
          if (cat === 'matched' || cat === 'partial_fill' || cat === 'extra_live_order') {
            card.liveEntry = qp(live.filled_qty != null ? live.filled_qty : live.qty, live.filled_avg_price)
            if (!exitReconciled && cat === 'matched') {
              card.liveExit = 'n/d (record precedente)'
              card.exitStale = true
            } else if (exitIssue === 'missing') {
              card.liveExit = 'nessun ordine di uscita'
              card.exitBad = true
            } else if (typeof exitIssue === 'string' && exitIssue.startsWith('not_filled:')) {
              card.liveExit = `uscita ${exitIssue.split(':')[1] || 'non eseguita'} — non eseguita`
              card.exitBad = true
            } else if (exitIssue === 'partial_fill') {
              card.liveExit = `${qp(d.live_exit_qty, d.live_exit_price)} ⚠ parziale`
              card.exitBad = true
            } else if (d.live_exit_price != null) {
              card.liveExit = qp(d.live_exit_qty != null ? d.live_exit_qty : live.filled_qty, d.live_exit_price)
            } else if (d.live_exit_status) {
              card.liveExit = `uscita ${d.live_exit_status}`
            } else {
              card.liveExit = '—'
            }
          } else if (cat === 'never_submitted') {
            card.liveEntry = 'nessun ordine reale'
          } else if (cat.startsWith('live_order_not_filled')) {
            const orders = Array.isArray(d.live) ? d.live : (d.live ? [d.live] : [])
            const st = orders.map((o) => o.status).filter(Boolean).join(', ') || (cat.split(':')[1] || '—')
            card.liveEntry = `non eseguito (${st})`
          }
          const bits = []
          if (cat !== 'matched') bits.push(this.diffCategoryLabel(cat))
          if (exitIssue === 'missing') bits.push('posizione entrata ma mai chiusa')
          else if (typeof exitIssue === 'string' && exitIssue.startsWith('not_filled:')) bits.push('ordine di uscita non eseguito')
          else if (exitIssue === 'partial_fill') bits.push('uscita solo parziale')
          if (d.entry_edge_bps != null) bits.push(`slippage ingresso ${this.bps(d.entry_edge_bps)}`)
          if (d.sizing_ratio_live_over_bt != null) {
            bits.push(`qty reale/BT ${d.sizing_ratio_live_over_bt}×${d.sizing_divergence ? ' ⚠ fuori banda' : ''}`)
          }
          card.footer = bits.join(' · ')
          return card
        })
    },
    dayReading(result) {
      const counts = (result?.summary && result.summary.counts) || {}
      const lines = []
      const missing = counts.never_submitted || 0
      const notFilledEntries = Object.entries(counts).filter(([k]) => k.startsWith('live_order_not_filled:'))
      const notFilled = notFilledEntries.reduce((a, [, n]) => a + n, 0)
      const extra = counts.extra_live_order || 0
      const partial = counts.partial_fill || 0
      const sizing = counts.sizing_divergence || 0
      const exitMissing = counts.exit_missing || 0
      const exitNotFilled = counts.exit_not_filled || 0
      const exitPartial = counts.exit_partial_fill || 0

      const addNoTradeReason = (name, enabled, reasons) => {
        if (!enabled) return
        const text = (reasons || []).map((r) => {
          const label = r?.label || 'Causale non disponibile'
          return r?.detail ? `${label} (${r.detail})` : label
        }).join(' | ')
        lines.push({ cls: 'text-orange-9', text: `${name}: nessun ordine — ${text || 'causale non disponibile'}.` })
      }
      addNoTradeReason('Backtest', result?.summary?.bt_no_trade, result?.summary?.bt_no_trade_reasons)
      addNoTradeReason('Alpaca', result?.summary?.live_no_trade, result?.summary?.live_no_trade_reasons)

      if (missing) {
        lines.push({ cls: 'text-negative', text: `${missing} ordine/i previsti dal backtest e mai inviati nel reale (ingresso mancato).` })
      }
      if (exitMissing || exitNotFilled || exitPartial) {
        const parts = []
        if (exitMissing) parts.push(`${exitMissing} senza alcun ordine di uscita`)
        if (exitNotFilled) parts.push(`${exitNotFilled} con uscita inviata ma non eseguita`)
        if (exitPartial) parts.push(`${exitPartial} con uscita solo parziale`)
        lines.push({ cls: 'text-negative', text: `Posizioni entrate ma non chiuse come nel backtest: ${parts.join(', ')}. La strategia esce sempre in pieno alla sessione successiva.` })
      }
      if (notFilled) {
        const byStatus = notFilledEntries
          .map(([k, n]) => `${n} ${this.diffCategoryLabel(k).replace('ordine inviato ma non eseguito — ', '')}`)
          .join(', ')
        lines.push({ cls: 'text-negative', text: `${notFilled} ordine/i inviati ma non eseguiti (${byStatus}).` })
      }
      if (partial) {
        lines.push({ cls: 'text-negative', text: `${partial} ordine/i eseguiti solo in parte (fill parziale broker-side).` })
      }
      if (extra) {
        lines.push({ cls: 'text-negative', text: `${extra} ordine/i reali su titoli non previsti dal backtest — selezione/segnale divergente, oppure contaminazione da un'altra strategia sullo stesso conto.` })
      }
      if (sizing) {
        lines.push({ cls: 'text-grey-8', text: `${sizing} titolo/i con quantità reale/backtest fuori banda 0.85–1.15: atteso, l'equity simulata del replay diverge da quella reale del conto — non è un errore di esecuzione.` })
      }

      const edges = (result?.diffs || [])
        .filter((d) => d.category === 'matched' && d.entry_edge_bps != null)
        .map((d) => Number(d.entry_edge_bps))
      if (edges.length) {
        const avg = edges.reduce((a, b) => a + b, 0) / edges.length
        const worst = edges.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))
        lines.push({
          cls: Math.abs(avg) >= 15 ? 'text-orange-9' : 'text-grey-8',
          text: `Slippage prezzo di ingresso: media ${this.bps(avg)}, max ${this.bps(worst)} su ${edges.length} ordini combacianti.`,
        })
      }

      if (!lines.length) {
        lines.push({ cls: 'text-positive', text: 'Nessuna divergenza: tutti gli ordini reali combaciano con il backtest.' })
      }
      return lines
    },
    commitCaveat(result) {
      const res = result?.core_commit_resolution
      if (res && res !== 'exact') {
        return `Il replay non ha usato il commit esatto di quel giorno (${res}): parte delle divergenze di selezione titoli può essere artefatto del commit, non un problema reale.`
      }
      return ''
    },
  },
}
</script>

<style scoped>
.footprint-table {
  width: 100%;
  border-collapse: collapse;
}
.footprint-table th, .footprint-table td {
  text-align: right;
  padding: 2px 8px;
}
.footprint-table th:first-child, .footprint-table td:first-child {
  text-align: left;
}
.stratargs-pre {
  font-size: 0.75rem;
  max-height: 300px;
  overflow: auto;
  background: rgba(0, 0, 0, 0.04);
  padding: 8px;
  border-radius: 4px;
}
.full-height {
  height: 100%;
}

/* Guadagno giorno — cella di riga: due valori etichettati, a colpo d'occhio */
.day-return {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 8px;
  row-gap: 1px;
  align-items: baseline;
  min-width: 120px;
}
.day-return__tag {
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  color: #888;
  text-transform: uppercase;
}
.day-return__val {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* Spaccato per simbolo: card con griglia ingresso/uscita/guadagno */
.sym-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.entry-receipts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}
.entry-receipt {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: #fff;
  padding: 8px;
}
.sym-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-left-width: 4px;
  border-radius: 6px;
  padding: 8px 10px;
  background: #fff;
  min-width: 300px;
  flex: 1 1 340px;
}
.sym-card.card-hard { border-left-color: #c10015; }
.sym-card.card-soft { border-left-color: #f57c00; }
.sym-card.card-ok   { border-left-color: #21ba45; }
.sym-card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.sym-card__symbol {
  font-weight: 700;
  font-size: 0.95rem;
}
.sym-card__cat {
  font-size: 0.75rem;
  color: #666;
  text-align: right;
}
.sym-grid {
  display: grid;
  grid-template-columns: 4.5rem 1fr 1fr 4.5rem;
  gap: 2px 8px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  align-items: baseline;
}
.sym-grid__corner { }
.sym-grid__col {
  font-size: 0.66rem;
  letter-spacing: 0.05em;
  color: #999;
  text-align: right;
}
.sym-grid__row {
  font-size: 0.72rem;
  color: #888;
  text-transform: uppercase;
}
.sym-grid > span:not(.sym-grid__row):not(.sym-grid__col):not(.sym-grid__corner) {
  text-align: right;
}
.sym-card__foot {
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 0.72rem;
  color: #777;
}
</style>
