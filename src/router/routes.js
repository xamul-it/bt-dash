
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Index.vue') },

      { path: '/orders', component: () => import('pages/Orders.vue')},
      { path: '/positions', component: () => import('pages/Positions.vue')},
      { path: '/today', component: () => import('pages/Today.vue')},


      { path: '/Dashboard', component: () => import('pages/Dashboard.vue')},
      { path: '/Dashboard2', component: () => import('pages/Dashboard2.vue')},
      { path: '/Cards', component: () => import('pages/Cards.vue')},
      { path: '/Charts', component: () => import('pages/Charts.vue')},
      { path: '/Directory', component: () => import('pages/Directory.vue')},
      { path: '/CardHeader', component: () => import('pages/CardHeader.vue')},
      { path: '/Pagination', component: () => import('pages/Pagination.vue')},
      { path: '/Tables', component: () => import('pages/Tables.vue')},
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/Error404.vue')
  }
]

export default routes
