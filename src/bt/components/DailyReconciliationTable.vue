<template>
  <q-table :rows="rows" :columns="columns" row-key="key" dense flat
    :pagination="{ rowsPerPage: 0 }" hide-bottom no-data-label="Nessuna evidenza giornaliera disponibile">
    <template #body="props">
      <q-tr :props="props" :class="{ 'cursor-pointer': expandable(props.row) }"
        @click="expandable(props.row) && $emit('toggle', props.row.key)">
        <q-td auto-width>
          <q-icon v-if="expandable(props.row)" :name="expanded.includes(props.row.key) ? 'expand_more' : 'chevron_right'" />
        </q-td>
        <slot name="summary" v-bind="props">
          <q-td key="trading_date" :props="props">{{ props.row.trading_date }}</q-td>
          <q-td key="status" :props="props"><q-badge :color="props.row.badgeColor">{{ props.row.statusLabel }}</q-badge></q-td>
          <q-td key="day_return" :props="props" :class="returnColor(props.row.day_return)">{{ signedPercent(props.row.day_return) }}</q-td>
          <q-td key="detail" :props="props">{{ props.row.detail }}</q-td>
        </slot>
      </q-tr>
      <q-tr v-if="expandable(props.row) && expanded.includes(props.row.key)" :props="props" no-hover>
        <q-td colspan="100%" class="bg-grey-1"><slot name="detail" v-bind="props" /></q-td>
      </q-tr>
    </template>
  </q-table>
</template>
<script>
import { returnColor } from '../utils/returnColor'
export default {
  name: 'DailyReconciliationTable',
  props: {
    rows: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [
      { name: 'expand', label: '', field: 'expand' },
      { name: 'trading_date', label: 'Giorno', field: 'trading_date', align: 'left' },
      { name: 'status', label: 'Esito', field: 'statusLabel', align: 'left' },
      { name: 'day_return', label: 'Rendimento portafoglio', field: 'day_return', align: 'left' },
      { name: 'detail', label: 'Dettaglio', field: 'detail', align: 'left' },
    ] },
    expanded: { type: Array, default: () => [] },
    expandable: { type: Function, default: () => true },
  },
  emits: ['toggle'],
  methods: {
    returnColor,
    signedPercent(value) {
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
      return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(3)}%`
    },
  },
}
</script>
