
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('src/bt/pages/Index.vue') },
      { path: '/Configure', component: () => import('src/bt/pages/Configure.vue')},
      { path: '/Benchmark', component: () => import('src/bt/pages/Benchmark.vue')},
      { path: '/ExecuteStrategy', component: () => import('src/bt/pages/ExecuteStrategy.vue')},
      { path: '/Scheduler', component: () => import('src/bt/pages/Scheduler.vue')},
      { path: '/Alpaca', component: () => import('src/bt/pages/Alpaca.vue')},

      { path: '/Dashboard', component: () => import('src/bt/pages/Index.vue')},
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
