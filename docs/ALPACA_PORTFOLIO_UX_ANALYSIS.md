# Alpaca Portfolio UX Analysis (Step 1)

## Summary
Questo documento definisce il primo step per la nuova esperienza Portfolio Alpaca Paper:
- analisi UX/prodotto strutturata
- wireframe low-fi
- criteri MVP
- prototipo minimale funzionante in Quasar/Vue

Vincoli adottati:
- timezone canonica: **UTC**
- frontend senza chiavi Alpaca
- accesso dati via backend/proxy
- direzione futura: Alpaca + storage locale (step successivo)

## Goal Prodotto e KPI
### Goal
1. Visualizzare il valore complessivo portafoglio (cash + titoli) nel tempo.
2. Consentire drill-down minuto-per-minuto per osservare la composizione.
3. Mostrare overlay entrate/uscite (buy/sell) per asset selezionati.
4. Esporre metriche operative immediate (PnL, drawdown, high, low).
5. Evidenziare eventuali pattern intraday legati all'orario.

### KPI
1. Tempo al primo dato < 2.5s su range 1D in condizioni standard.
2. Coerenza valori: variazione equity coerente con attività visibili.
3. Completezza UX: loading/empty/error gestiti in ogni vista.
4. Leggibilità decisionale: un utente deve identificare trend/criticità in meno di 30s.

## User Journey e Task Principali
1. L'utente apre la pagina Portfolio Alpaca.
2. Vede card metriche e curva equity giornaliera con overlay trade.
3. Seleziona 1..N asset per filtrare gli eventi buy/sell nel grafico.
4. Cambia range temporale (1D/1W/1M).
5. Usa il cursore minuto per minuto per leggere la composizione stimata.
6. Legge il grafico di ciclicità intraday per individuare finestre orarie ricorrenti.

## Wireframe Low-Fi
### Vista 1: Dashboard Giornaliera
```
+--------------------------------------------------------------+
| [PnL] [Max DD] [High] [Low]                                  |
+--------------------------------------------------------------+
| Range [1D|1W|1M]  Asset Overlay [multi-select]  TZ [UTC]     |
+--------------------------------------------------------------+
|                  Equity Curve + Buy/Sell Overlay             |
|                           (time UTC)                         |
+--------------------------------------------------------------+
```

### Vista 2: Drill-down Minuto
```
+--------------------------------------------------------------+
| Slider minuto [----|------]  Timestamp UTC selezionato       |
+--------------------------------------------------------------+
| Tabella composizione (stimata):                              |
| Symbol | Qty | Weight% | Estimated Market Value              |
+--------------------------------------------------------------+
```

### Vista 3: Ciclicità Intraday
```
+--------------------------------------------------------------+
|   Avg cumulative PnL by minute (HH:MM UTC)                   |
|   (linea aggregata per fasce orarie)                         |
+--------------------------------------------------------------+
```

## Regole UX
1. Tutti i timestamp mostrati in UTC (ISO8601).
2. Filtri asset non bloccanti: se nessun asset selezionato, mostra tutti gli eventi.
3. Stati di errore espliciti in alto pagina con messaggio backend.
4. Stato empty: grafici vuoti ma con struttura visibile.
5. Refresh manuale sempre disponibile.
6. Nessuna operatività ordine automatica nelle viste analitiche.

## Backlog Prioritizzato
### MVP
1. Dashboard equity con overlay buy/sell.
2. Card metriche: PnL range, high, low, max drawdown.
3. Slider minuto con composizione stimata.
4. Grafico ciclicità intraday base.
5. Range selector e filtro asset.

### V1
1. Migliorare composizione con ricostruzione posizioni storiche reali.
2. Aggiungere benchmark comparativo (es. NASDAQ100).
3. Tooltip avanzati con dettaglio trade/notional.
4. Export CSV metriche e eventi.

### V2
1. Alert su pattern orari ripetitivi.
2. Segmentazione per sessione (pre/regular/post market).
3. Layer probabilistico su ciclicità con bande di confidenza.

## Criteri di Accettazione Funzionale
1. La pagina carica dati reali Alpaca senza esporre chiavi nel frontend.
2. Il grafico principale mostra equity e marker buy/sell filtrabili per simbolo.
3. Lo slider minuto aggiorna timestamp e tabella composizione senza glitch.
4. Le metriche sono ricalcolate sul range corrente visualizzato.
5. Il grafico ciclicità mostra una serie valida per almeno un range con dati.

## Interfacce Pubbliche MVP (Read-Only)
1. `GET /dyn/al/portfolio`
2. `GET /dyn/al/portfolio-history`
3. `GET /dyn/al/activities`

Nota: schema dettagliato e persistenza locale sono fuori da questo step.

## Assunzioni Step 1
1. La composizione minuto nel prototipo è stimata dai pesi correnti delle posizioni.
2. Lo storage locale non viene implementato in questo step.
3. Range e metriche sono orientati a validazione UX, non audit contabile.
