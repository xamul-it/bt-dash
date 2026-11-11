<template>
  <div class="strategy-badges q-mb-xs">
    <q-chip v-for="family in families" :key="family" dense square color="blue-1" text-color="primary" icon="account_tree" clickable @click.stop="$emit('select', family)">
      <strong>{{ family }}</strong><q-tooltip>Filtra la documentazione per questa strategia / famiglia</q-tooltip>
    </q-chip>
    <span v-if="!families.length" class="text-caption text-grey-7">Strategia non associata / documentazione comune</span>
  </div>
</template>
<script setup>
defineProps({ families: { type: Array, default: () => [] } })
defineEmits(['select'])
</script>
<style scoped>.strategy-badges { display: flex; flex-wrap: wrap; gap: 2px; }.strategy-badges .q-chip { margin: 0 4px 0 0; }</style>
