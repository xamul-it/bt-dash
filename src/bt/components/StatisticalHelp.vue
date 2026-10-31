<template>
  <q-btn
    v-if="definition"
    flat round dense size="sm" icon="info_outline" color="primary"
    class="statistical-help"
    :aria-label="`Informazioni su ${definition.title}`"
    @mouseenter="showHelp" @focus="showHelp" @click.stop="showHelp"
  >
    <q-menu
      ref="popup" no-parent-event no-focus no-refocus
      max-width="min(560px, 90vw)" max-height="70vh"
      anchor="bottom middle" self="top middle"
      class="statistical-help-tooltip" :data-statistic-help="indicator" role="tooltip"
    >
      <div class="row items-center no-wrap q-mb-sm">
        <strong class="col">{{ definition.title }}</strong>
        <q-btn flat round dense size="sm" icon="close" aria-label="Chiudi informazioni statistiche" @click="hideHelp" />
      </div>
      <p>{{ definition.purpose }}</p>
      <div v-for="formula in definition.formulas" :key="formula" class="statistical-help-formula q-mb-sm">{{ formula }}</div>
      <p v-for="paragraph in definition.details" :key="paragraph">{{ paragraph }}</p>
    </q-menu>
  </q-btn>
</template>
<script>
import definitions from '../utils/statisticalIndicatorHelp'
let activePopup = null
export default {
  name: 'StatisticalHelp',
  props: { indicator: { type: String, required: true } },
  computed: { definition() { return definitions[this.indicator] } },
  beforeUnmount() { if (activePopup === this.$refs.popup) activePopup = null },
  methods: {
    showHelp() {
      if (activePopup !== this.$refs.popup) activePopup?.hide()
      activePopup = this.$refs.popup
      activePopup?.show()
    },
    hideHelp() { this.$refs.popup?.hide() },
  },
}
</script>
<style>
.statistical-help-tooltip {
  width: 560px;
  overflow: auto;
  white-space: normal;
  font-size: 13px;
  line-height: 1.5;
  padding: 14px;
}
.statistical-help-tooltip p:last-child { margin-bottom: 0; }
.statistical-help-formula { font-family: monospace; overflow-wrap: anywhere; }
</style>
