<template>
  <q-btn flat round dense :icon="favorite ? 'star' : 'star_border'" :color="favorite ? 'amber-9' : 'grey-7'"
    :loading="busy" :disable="!id || !ready" :aria-label="label" @click.stop="toggle">
    <q-tooltip>{{ label }}</q-tooltip>
  </q-btn>
</template>
<script>
import { dashboardFavorites, loadDashboardFavorites, isDashboardFavorite, setDashboardFavorite } from '../utils/dashboardFavorites'
export default {
  props: { kind: { type: String, required: true }, id: { type: String, default: '' } },
  data: () => ({ busy: false }),
  computed: {
    ready() { return dashboardFavorites.loaded },
    favorite() { return isDashboardFavorite(this.kind, this.id) },
    label() { return this.favorite ? 'Rimuovi dai preferiti della dashboard' : 'Aggiungi ai preferiti della dashboard' },
  },
  async mounted() {
    try { await loadDashboardFavorites() } catch (e) { this.failure(e) }
  },
  methods: {
    failure(e) { this.$q.notify({ type: 'negative', message: `Preferiti: ${e.response?.data?.error || e.message}` }) },
    async toggle() {
      this.busy = true
      try { await setDashboardFavorite(this.kind, this.id, !this.favorite) } catch (e) { this.failure(e) }
      finally { this.busy = false }
    },
  },
}
</script>
