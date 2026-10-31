<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          @click="toggleLeftDrawer"
          icon="menu"
          aria-label="Menu"
        />
        <q-toolbar-title>
          BT Dashboard
        </q-toolbar-title>
        <q-space/>
        <div class="q-gutter-sm row items-center no-wrap">
          <q-chip dense square :color="schedulerRunning ? 'positive' : 'negative'" text-color="white" icon="schedule">
            Scheduler {{ schedulerRunning ? 'attivo' : 'fermo' }}
          </q-chip>
          <install-pwa-button />
          <q-btn round dense flat color="white" icon="logout" aria-label="Esci" @click="logout">
            <q-tooltip>Esci</q-tooltip>
          </q-btn>
          <q-btn round dense flat color="white" :icon="$q.fullscreen.isActive ? 'fullscreen_exit' : 'fullscreen'"
                 @click="$q.fullscreen.toggle()"
                 v-if="$q.screen.gt.sm">
          </q-btn>
          <!-- q-btn round dense flat color="white" icon="fab fa-github" type="a" href="https://github.com/pratik227/quasar-admin" target="_blank">
          </q-btn -->

          <!-- q-btn round flat>
            <q-avatar size="26px">
              <img src="https://cdn.quasar.dev/img/boy-avatar.png">
            </q-avatar>
          </q-btn -->
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      bordered
      class="bg-primary text-white navigation-drawer"
    >
    <!-- show-if-above -->
      <q-list>
        <q-item to="/" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Dashboard</q-item-label>
          </q-item-section>
        </q-item>
        
        <q-item to="/ExecuteStrategy" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="add_task"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Backtesting</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/TickerLists" active-class="navigation-active">
          <q-item-section avatar><q-icon name="playlist_add_check" /></q-item-section>
          <q-item-section><q-item-label>Liste ticker</q-item-label></q-item-section>
        </q-item>

        <q-item to="/Configure" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="build"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Dati ticker</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Benchmark" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="gps_fixed"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Benchmark</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Scheduler" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="timer"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Scheduler</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Services" active-class="navigation-active">
          <q-item-section avatar><q-icon name="dns" /></q-item-section>
          <q-item-section><q-item-label>Servizi</q-item-label></q-item-section>
        </q-item>
        <q-expansion-item icon="hub" label="Dati di mercato" :default-opened="$route.path.startsWith('/Zmq')" expand-separator>
          <q-item to="/Zmq/Recording" active-class="navigation-active" class="q-pl-xl"><q-item-section><q-item-label>Titoli monitorati</q-item-label></q-item-section></q-item>
          <q-item to="/Zmq/Monitoring" active-class="navigation-active" class="q-pl-xl"><q-item-section><q-item-label>Flussi live</q-item-label></q-item-section></q-item>
          <q-item to="/Zmq/History" active-class="navigation-active" class="q-pl-xl"><q-item-section><q-item-label>Storico</q-item-label></q-item-section></q-item>
          <q-item to="/Zmq/Replay" active-class="navigation-active" class="q-pl-xl"><q-item-section><q-item-label>Replay</q-item-label></q-item-section></q-item>
        </q-expansion-item>

        <q-expansion-item
          icon="event_repeat"
          label="Strategie Schedulate"
          :default-opened="isScheduledRoute"
          expand-separator
        >
          <q-item to="/Watchtower/CronMonitoring" active-class="navigation-active" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Profili Cron</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/ScheduledProfiles/Configuration" active-class="navigation-active" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Configurazione</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/ScheduledProfiles/Baselines" active-class="navigation-active" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Gestione baseline</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>

        <q-expansion-item
          icon="monitor_heart"
          label="Strategie Intraday"
          :default-opened="isIntradayRoute"
          expand-separator
        >
          <q-item to="/Watchtower" active-class="navigation-active" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Overview</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/Watchtower/FeedMonitoring" active-class="navigation-active" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Feed Monitoring</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>

        <!-- Riga di separazione -->
        <q-separator />

        <q-item to="/Alpaca" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="account_balance_wallet"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>My Portfolio</q-item-label>
          </q-item-section>
        </q-item>

        <div v-if="false">
        <q-item to="/Dashboard" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Dashboard 21</q-item-label>
          </q-item-section>
        </q-item>
        <q-item to="/Dashboard2" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>CRM Dashboard</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Directory" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Directory</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Charts" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="insert_chart"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Charts</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/CardHeader" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Card Header</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Cards" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Cards</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Tables" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="table_chart"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Tables</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Pagination" active-class="navigation-active">
          <q-item-section avatar>
            <q-icon name="date_range"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Pagination</q-item-label>
          </q-item-section>
        </q-item>
      </div>

      </q-list>
    </q-drawer>

    <q-page-container class="bg-grey-2">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import EssentialLink from 'components/EssentialLink.vue'
import InstallPwaButton from 'src/components/InstallPwaButton.vue'
import { api } from 'boot/axios'

import { computed, defineComponent, ref } from 'vue'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: 'MainLayout',

  components: {
    EssentialLink,
    InstallPwaButton
  },

  methods: {
    async logout () {
      try {
        await api.post('/auth/logout')
      } catch (e) {
        // Anche se la POST fallisce (es. rete), la sessione locale è di fatto
        // finita dal punto di vista dell'utente: si va comunque al login.
      }
      this.$router.replace('/login')
    }
  },

  setup () {
    const route = useRoute()
    const leftDrawerOpen = ref(false)
    const currentPath = computed(() => String(route.path || ''))
    // "Profili Cron" vive ancora sotto la route /Watchtower/CronMonitoring ma
    // concettualmente appartiene al gruppo "Strategie Schedulate".
    const isScheduledRoute = computed(
      () => currentPath.value.startsWith('/ScheduledProfiles')
        || currentPath.value === '/Watchtower/CronMonitoring'
    )
    const isIntradayRoute = computed(
      () => currentPath.value.startsWith('/Watchtower')
        && currentPath.value !== '/Watchtower/CronMonitoring'
        && currentPath.value !== '/Watchtower/ServiceMonitoring'
    )

    const schedulerRunning = ref(false)
    const refreshSchedulerStatus = async () => {
      try {
        const { data } = await api.get('/dyn/sc/status')
        schedulerRunning.value = data?.status === 'running'
      } catch (_) {
        schedulerRunning.value = false
      }
    }
    refreshSchedulerStatus()
    return {
      isScheduledRoute,
      isIntradayRoute,
      leftDrawerOpen,
      schedulerRunning,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>

<style>
.navigation-drawer .q-item { color: white; }
.navigation-drawer .q-item.navigation-active { color: white !important; background: rgba(255, 255, 255, .18); box-shadow: inset 3px 0 #fff; }
.navigation-drawer .q-expansion-item__toggle-icon { color: white; }
</style>
