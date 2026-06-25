<template>
        <q-btn
        :color="status === 'Running' ? 'red' : 'green'"
        :label="status === 'Running' ? 'Ferma Trading' : 'Avvia Trading'"
        :disable="(status === 'Running' && !canStop) || (status === 'Stopped' && !canStart)"
        @click="status === 'Running' ? stopTrading() : startTrading()"
      />
</template>
  
  <script>
  import { ref } from 'vue';
  import { api } from 'boot/axios';
  
  export default {
    setup() {
      const status = ref('Stopped'); // Stato iniziale: fermo
      const canStart = ref(true);   // Puoi avviare il trading
      const canStop = ref(false);   // Non puoi fermare il trading (inizialmente)
  
      // Funzione per aggiornare lo stato
      const fetchStatus = async () => {
        try {
          const response = await api.get('/dyn/al/status');
          status.value = response.data.status;
  
          // Aggiorna le condizioni dei bottoni
          canStart.value = status.value === 'Stopped';
          canStop.value = status.value === 'Running';
        } catch (error) {
          console.error("Errore nel recupero dello stato:", error);
        }
      };
  
      // Funzione per avviare il trading
      const startTrading = async () => {
        try {
          await api.post('/dyn/al/start');
          await fetchStatus(); // Aggiorna lo stato dopo l'avvio
        } catch (error) {
          console.error("Errore nell'avvio del trading:", error);
        }
      };
  
      // Funzione per fermare il trading
      const stopTrading = async () => {
        try {
          await api.post('/dyn/al/stop');
          await fetchStatus(); // Aggiorna lo stato dopo la fermata
        } catch (error) {
          console.error("Errore nella fermata del trading:", error);
        }
      };
  
      // Carica lo stato iniziale
      fetchStatus();
  
      return {
        status,
        canStart,
        canStop,
        startTrading,
        stopTrading,
      };
    },
  };
  </script>
