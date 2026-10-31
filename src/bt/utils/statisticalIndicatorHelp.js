const reference = 'Il riferimento esclude tutte le ultime 25 sedute. Le prime 500 sedute inizializzano il confronto continuo; le successive 500 definiscono centri e scale dei riassunti. Dopo 20 sedute di separazione, si confrontano blocchi storici consecutivi, non sovrapposti, di N sedute. Servono almeno 20 blocchi per finestra.'
const rank = 'Per ogni riassunto fⱼ si misura lo scostamento dal suo centro storico cⱼ, diviso per la scala sⱼ. Il punteggio S è il maggiore di questi scostamenti assoluti. K conta i blocchi storici con S almeno pari a quello recente; B è il totale dei blocchi. Un K/B piccolo indica pochi precedenti altrettanto atipici. I blocchi sono tratti dalla serie reale senza rimescolare le sedute e senza assumere giornate indipendenti.'
const limits = 'Confronto esplorativo: K/B non è la probabilità che la strategia sia rimasta invariata. Verde: K/B ≥ 20%; arancione: 5% ≤ K/B < 20%; rosso: K/B < 5%. Sono soglie descrittive, senza garanzia sui falsi allarmi delle diverse finestre o dei controlli ripetuti.'
const categories = 'rₜ è il rendimento semplice giornaliero del portafoglio. μ è la media aritmetica di tutte le sedute precedenti alle ultime 25, identica per le finestre correnti. Si aggiorna quando avanza il run. Confronti stretti: un rendimento uguale a μ non è sotto media. Zero resta distinto dalle perdite.'

export default {
  compatibility: {
    title: 'Compatibilità statistica della media dei trade',
    purpose: 'Valuta quanto il gain medio dei trade della finestra si discosta dalla media della baseline, tenendo conto della sua dispersione e del numero di trade recenti.',
    details: [
      'x̄ è il gain medio/trade recente, μ₀ e σ₀ sono media e deviazione standard della baseline; n è il numero dei trade recenti. Φ è la funzione di distribuzione della normale standard. La pagina mostra 100 × p, usando un’approssimazione numerica della coda normale.',
      'Il test bilaterale usa l’ipotesi di trade indipendenti e l’approssimazione normale della media. Un valore basso segnala una media insolita in entrambe le direzioni; un valore alto non dimostra che la strategia sia invariata. Non considera l’ordine dei risultati né stima l’incertezza di μ₀ e σ₀.',
      'La baseline è quella selezionata nella tabella. Nei risultati di un run comprende anche i trade delle finestre finali: il confronto è descrittivo e non è un test fuori campione. Il colore indica la direzione del gain rispetto alla baseline, non la significatività del test. Dati mancanti o dispersione nulla producono —.',
    ],
    formulas: ['z = |x̄ − μ₀| / (σ₀ / √n)', 'p = 2 × [1 − Φ(z)]'],
  },
  continuous: {
    title: 'Coerenza storica della serie',
    purpose: 'Confronta ampiezza e ordine dei rendimenti giornalieri del portafoglio con periodi precedenti della stessa durata. È complementare al test della media dei trade.',
    details: [
      'Si usano rendimenti logaritmici ℓₜ = ln(1 + rₜ). I riassunti fⱼ comprendono cumulato, energia quadratica, minimo e massimo, drawdown interno, quota e massima sequenza di perdite, prodotti a ritardo dei rendimenti centrati e delle loro ampiezze. I ritardi vanno da 1 a N−1.',
      reference,
      rank + ' Le scale sono deviazioni standard campionarie dei riassunti nel periodo di normalizzazione, con minimo 0,05.',
      limits,
    ],
    formulas: ['ℓₜ = ln(1 + rₜ)', 'S = maxⱼ |(fⱼ − cⱼ) / max(sⱼ, 0,05)|', 'K = numero di blocchi con S_storico ≥ S_recente; frequenza = K / B'],
  },
  balance: {
    title: 'Bilanciamento dei rendimenti',
    purpose: 'Controlla se le frequenze recenti di giorni negativi, nulli, positivi e sotto media sono insolite rispetto allo storico della strategia.',
    details: [
      categories,
      'I quattro conteggi sono confrontati insieme. Il bilanciamento considera le frequenze, non l’ordine dei giorni: per quest’ultimo si legge la persistenza. Non si assume un win rate del 50%, né che metà delle giornate sia sotto media. Le categorie rispetto a zero e rispetto alla media possono sovrapporsi; con μ positiva, anche uno zero o un piccolo guadagno può essere sotto media.',
      reference,
      rank + ' Per i conteggi la scala minima è mezza osservazione (0,5).',
      limits,
    ],
    formulas: ['μ = (Σ rendimenti dello storico precedente) / numero di sedute', 'C₋ = Σ 1(rₜ < 0); C₀ = Σ 1(rₜ = 0); C₊ = Σ 1(rₜ > 0)', 'C_sotto = Σ 1(rₜ < μ); 1(condizione) vale 1 se vera, altrimenti 0', 'S = maxⱼ |(Cⱼ − cⱼ) / max(sⱼ, 0,5)|; frequenza = K / B'],
  },
  persistence: {
    title: 'Persistenza dei rendimenti',
    purpose: 'Controlla se perdite o giornate sotto media si concentrano in sequenze diverse dal comportamento storico, anche quando i conteggi complessivi sono simili.',
    details: [
      categories,
      'Per ciascuna soglia si usano tre riassunti entro le N sedute: massima sequenza consecutiva, sequenza ancora aperta alla fine della finestra e numero di coppie consecutive che rispettano la condizione. I sei riassunti sono confrontati insieme.',
      'Esempio con media +0,10%: −0,20%; +0,05%; −0,10% dà al massimo 1 perdita consecutiva, ma 3 giorni consecutivi sotto media. I due massimi possono anche coincidere.',
      reference,
      rank + ' La scala minima è 0,5. Le sequenze complessive ancora aperte, mostrate una sola volta sotto la tabella, possono superare N; il punteggio usa soltanto le N sedute.',
      limits,
    ],
    formulas: ['bₜ = 1(rₜ < soglia), con soglia 0 oppure μ', 'Lₜ = bₜ × (Lₜ₋₁ + 1), con L₀ = 0 all’inizio della finestra', 'Massimo = maxₜ Lₜ; sequenza finale = L_N; coppie = Σₜ₌₂ᴺ bₜ₋₁ × bₜ', 'S = maxⱼ |(fⱼ − cⱼ) / max(sⱼ, 0,5)|; frequenza = K / B'],
  },
  ongoing: {
    title: 'Sequenze ancora aperte all’ultima seduta',
    purpose: 'Indica da quante sedute consecutive il portafoglio perde oppure rende meno della media storica, arrivando fino all’ultima data osservata del run.',
    details: [
      'Zero significa che l’ultima seduta non rispetta quella condizione e quindi non c’è una sequenza aperta. Non significa che non ci siano state perdite nella finestra.',
      'Il conteggio risale sull’intera serie disponibile: può iniziare prima delle ultime N sedute. È mostrato una sola volta perché tutte le finestre terminano nella stessa data. Non si riferisce alla data odierna, se il run termina prima.',
      'La media è la stessa soglia precedente alle ultime 25 sedute usata per il bilanciamento. Queste durate sono informazioni descrittive; il confronto della persistenza ritaglia invece ciascuna finestra a N sedute.',
    ],
    formulas: ['Lₜ = Lₜ₋₁ + 1 se rₜ < soglia; altrimenti Lₜ = 0', 'Soglia delle perdite: 0; soglia sotto media: μ'],
  },
}
