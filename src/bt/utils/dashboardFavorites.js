import { reactive } from 'vue'
import { api } from 'boot/axios'
export const dashboardFavorites = reactive({ values: {}, loaded: false })
let pending
export async function loadDashboardFavorites(force = false) {
  if (pending) return pending
  if (dashboardFavorites.loaded && !force) return
  pending = api.get('/dyn/simulations/dashboard-favorites').then(({ data }) => {
    dashboardFavorites.values = data
    dashboardFavorites.loaded = true
  }).finally(() => { pending = null })
  return pending
}
export function isDashboardFavorite(kind, id) {
  return (dashboardFavorites.values[kind] || []).includes(id)
}
export async function setDashboardFavorite(kind, id, favorite) {
  const { data } = await api.put('/dyn/simulations/dashboard-favorites', { kind, id, favorite })
  dashboardFavorites.values = data
  dashboardFavorites.loaded = true
}
