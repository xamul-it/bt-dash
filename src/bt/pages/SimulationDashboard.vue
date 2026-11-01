<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-xs">Dashboard</div>
    <div class="text-grey-7 q-mb-lg">I tuoi preferiti aggiornati: strategie schedulate, intraday e laboratorio schedulato.</div>
    <div class="row q-col-gutter-lg">
    <OperationalFavorites class="col-12 col-lg-4" kind="cron" title="Strategie schedulate" />
    <OperationalFavorites class="col-12 col-lg-4" kind="intraday" title="Strategie intraday" />
    <section class="col-12 col-lg-4" aria-label="Laboratorio schedulato">
      <LaboratorySchedules embedded favorites-only />
    </section>
    </div>
  </q-page>
</template>
<script>
import OperationalFavorites from '../components/OperationalFavorites.vue'
import LaboratorySchedules from './LaboratorySchedules.vue'
export default { components: { OperationalFavorites, LaboratorySchedules } }
</script>
