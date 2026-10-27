
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('src/bt/pages/SimulationDashboard.vue') },
      { path: '/Configure', component: () => import('src/bt/pages/SimulationData.vue')},
      { path: '/TickerLists', component: () => import('src/bt/pages/TickerLists.vue')},
      { path: '/Benchmark', component: () => import('src/bt/pages/SimulationBenchmarks.vue')},
      { path: '/ExecuteStrategy', component: () => import('src/bt/pages/BacktestingStudio.vue')},
      { path: '/Scheduler', component: () => import('src/bt/pages/Scheduler.vue')},
      { path: '/QuoteMonitoring', component: () => import('src/bt/pages/QuoteMonitoring.vue')},
      { path: '/ProxyAdministration', component: () => import('src/bt/pages/ProxyAdministration.vue')},
      { path: '/RecordedFlows', component: () => import('src/bt/pages/RecordedFlows.vue')},
      { path: '/Watchtower', component: () => import('src/bt/pages/Watchtower.vue')},
      { path: '/Watchtower/CronMonitoring', component: () => import('src/bt/pages/WatchtowerCronMonitoring.vue')},
      { path: '/Watchtower/FeedMonitoring', component: () => import('src/bt/pages/WatchtowerFeedMonitoring.vue')},
      { path: '/Watchtower/ServiceMonitoring', component: () => import('src/bt/pages/WatchtowerServiceMonitoring.vue')},
      { path: '/ScheduledProfiles/Configuration', component: () => import('src/bt/pages/ScheduledProfileConfiguration.vue')},
      { path: '/ScheduledProfiles/Baselines', component: () => import('src/bt/pages/ProfileBaselineManager.vue')},
      { path: '/Alpaca', component: () => import('src/bt/pages/Alpaca.vue')},

      { path: '/Dashboard', component: () => import('src/bt/pages/SimulationDashboard.vue') },
      { path: '/Dashboard3', component: () => import('pages/Dashboard.vue')},
      { path: '/Dashboard2', component: () => import('pages/Dashboard2.vue')},
      { path: '/Cards', component: () => import('pages/Cards.vue')},
      { path: '/Charts', component: () => import('pages/Charts.vue')},
      { path: '/Directory', component: () => import('pages/Directory.vue')},
      { path: '/CardHeader', component: () => import('pages/CardHeader.vue')},
      { path: '/Pagination', component: () => import('pages/Pagination.vue')},
      { path: '/Tables', component: () => import('pages/Tables.vue')},
    ]
  },
  {
    path: '/login',
    component: () => import('src/bt/pages/LoginPage.vue')
  },
  {
    path: '/details/:ticker',
    component: () => import('src/bt/pages/TickerDetails.vue')
  },
  {
    path: '/details/:ticker/:param',
    component: () => import('src/bt/pages/TickerDetails.vue')
  },
  {
    path: '/details/:ticker/:param/:status',
    component: () => import('src/bt/pages/TickerDetails.vue')
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/Error404.vue')
  }
]

export default routes
