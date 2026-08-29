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
      class="bg-primary text-white"
    >
    <!-- show-if-above -->
      <q-list>
        <q-item to="/" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Dashboard</q-item-label>
          </q-item-section>
        </q-item>
        
        <q-item to="/ExecuteStrategy" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="add_task"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Backtesting</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Configure" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="build"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Elenco Tickers</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Benchmark" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="gps_fixed"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Benchmark</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Scheduler" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="timer"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Scheduler</q-item-label>
          </q-item-section>
        </q-item>

        <q-expansion-item
          icon="event_repeat"
          label="Strategie Schedulate"
          :default-opened="isScheduledRoute"
          expand-separator
        >
          <q-item to="/Watchtower/CronMonitoring" active-class="q-item-no-link-highlighting" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Profili Cron</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/ScheduledProfiles/Configuration" active-class="q-item-no-link-highlighting" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Configurazione</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/ScheduledProfiles/Baselines" active-class="q-item-no-link-highlighting" class="q-pl-xl">
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
          <q-item to="/Watchtower" active-class="q-item-no-link-highlighting" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Overview</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/Watchtower/FeedMonitoring" active-class="q-item-no-link-highlighting" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Feed Monitoring</q-item-label>
            </q-item-section>
          </q-item>
          <q-item to="/Watchtower/ServiceMonitoring" active-class="q-item-no-link-highlighting" class="q-pl-xl">
            <q-item-section>
              <q-item-label>Service Monitoring</q-item-label>
            </q-item-section>
          </q-item>
        </q-expansion-item>

        <!-- Riga di separazione -->
        <q-separator />

        <q-item to="/Alpaca" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="account_balance_wallet"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>My Portfolio</q-item-label>
          </q-item-section>
        </q-item>

        <div v-if="false">
        <q-item to="/Dashboard" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Dashboard 21</q-item-label>
          </q-item-section>
        </q-item>
        <q-item to="/Dashboard2" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="dashboard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>CRM Dashboard</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Directory" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Directory</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Charts" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="insert_chart"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Charts</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/CardHeader" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Card Header</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Cards" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Cards</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Tables" active-class="q-item-no-link-highlighting">
          <q-item-section avatar>
            <q-icon name="table_chart"/>
          </q-item-section>
          <q-item-section>
            <q-item-label>Tables</q-item-label>
          </q-item-section>
        </q-item>

        <q-item to="/Pagination" active-class="q-item-no-link-highlighting">
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

import { computed, defineComponent, ref } from 'vue'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: 'MainLayout',

  components: {
    EssentialLink
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
    )

    return {
      isScheduledRoute,
      isIntradayRoute,
      leftDrawerOpen,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>
