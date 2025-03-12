<template>
    <div>
        <q-toolbar class="bg-primary text-white">
            <template v-if="$q.screen.gt.xs">
                    Cash: {{ account.cash }} | Equity: {{ account.equity }} | Account: {{ account.account_number }} |
                    <q-icon :name="currencyIcon(account.currency)" /> {{ account.currency }} |
                    Date: {{ formatDate(account.balance_asof) }}
            </template>
            <template v-else>
                <q-btn icon="menu" flat @click="toggleDrawer" />
            </template>

            <!-- Spazio vuoto per spingere il bottone a destra -->
            <q-space />

            <!-- Bottone Avvia/Ferma Trading -->
            <TradingButton />

        </q-toolbar> <q-table :rows="portfolio" :columns="columns" row-key="name" />
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import TradingButton from './Cerebro.vue'; // Modifica il percorso in base alla tua struttura

export default {
    components: {
        TradingButton, // Registra il componente
    },
    setup() {
        const portfolio = ref([]);
        const account = ref({});
        const columns = [
            { name: 'asset', label: 'Asset', field: 'symbol', align: 'left' },
            { name: 'qty', label: 'Quantità', field: 'qty', align: 'left' },
            { name: 'market_value', label: 'Valore di Mercato', field: 'market_value', align: 'left' },
        ];

        onMounted(async () => {
            try {
                const response = await axios.get('http://localhost:5001/dyn/al/portfolio');
                portfolio.value = response.data.positions;
                account.value = response.data.account;
            } catch (error) {
                console.error('Errore nel caricamento del portafoglio:', error);
            }
        });
        const currencyIcon = (currency) => {
            switch (currency) {
                case 'USD': return 'fa fa-dollar-sign';
                case 'EUR': return 'fa fa-euro-sign';
                // aggiungi altre valute secondo necessità
                default: return 'fa fa-money-bill';
            }
        };

        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleDateString('it-IT');
        };
        const toggleDrawer = () => {
            // implementa la logica per mostrare/nascondere il drawer
        };

        return {
            portfolio, account, columns, currencyIcon, formatDate, toggleDrawer
        };
    },
};
</script>