<template>
  <q-btn
    v-if="text"
    flat
    round
    dense
    size="sm"
    icon="info_outline"
    color="primary"
    :aria-label="`Informazioni su ${name}`"
    @click.stop
  >
    <q-popup-proxy>
      <div class="q-pa-md parameter-help"><MarkdownNotes :text="text" /></div>
    </q-popup-proxy>
  </q-btn>
</template>

<script>
import MarkdownNotes from './MarkdownNotes.vue'

export default {
  name: 'ParameterHelp',
  components: { MarkdownNotes },
  props: {
    name: { type: String, required: true },
    text: { type: String, default: '' },
  },
}
</script>

<style scoped>
.parameter-help {
  max-width: min(480px, 85vw);
  white-space: normal;
  font-size: 15px;
  line-height: 1.5;
  max-height: 70vh;
  overflow: auto;
}
</style>
