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

import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'MainLayout',

  components: {
    EssentialLink
  },

  setup () {
    const leftDrawerOpen = ref(false)

    return {
      leftDrawerOpen,
      toggleLeftDrawer () {
        leftDrawerOpen.value = !leftDrawerOpen.value
      }
    }
  }
})
</script>
