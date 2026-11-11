<template>
  <div class="row q-col-gutter-sm">
    <div v-for="field in knowledgeFilterFields" :key="field.key" class="col-12 col-sm-6 col-lg-4">
      <q-select :model-value="modelValue[field.key] || null" :label="field.label"
                :aria-label="field.label" :options="choices[field.key] || options(field.key)"
                outlined dense clearable use-input hide-selected fill-input emit-value map-options
                input-debounce="0" @filter="(text, update) => filter(field.key, text, update)"
                @update:model-value="value => updateField(field.key, value)">
        <template #option="scope">
          <q-item v-bind="scope.itemProps"><q-item-section style="overflow-wrap: anywhere">{{ scope.opt.label }}</q-item-section></q-item>
        </template>
      </q-select>
    </div>
    <div v-if="dates" class="col-12">
      <q-expansion-item dense icon="date_range" label="Date dello studio e periodo economico">
        <div class="row q-col-gutter-sm q-pt-sm">
          <div v-for="field in dateFields" :key="field.key" class="col-12 col-sm-6 col-lg-3">
            <q-input :model-value="modelValue[field.key] || ''" type="date" outlined dense stack-label
                     :label="field.label" @update:model-value="value => updateField(field.key, value)" />
          </div>
        </div>
      </q-expansion-item>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { knowledgeFilterFields, knowledgeLabel } from '../utils/knowledge.mjs'
const props = defineProps({ modelValue: { type: Object, required: true }, facets: { type: Object, default: () => ({}) }, dates: Boolean })
const emit = defineEmits(['update:modelValue'])
const choices = reactive({})
const dateFields = [
  { key: 'study_from', label: 'Data studio dal' }, { key: 'study_to', label: 'Data studio al' },
  { key: 'period_start_from', label: 'Inizio periodo economico da' }, { key: 'period_end_to', label: 'Fine periodo economico entro' },
]
function options(key) {
  return (props.facets[key] || []).map(item => ({ value: item.value, label: `${knowledgeLabel(item.value, key)} (${item.count})` }))
}
function filter(key, text, update) {
  update(() => { choices[key] = options(key).filter(item => item.label.toLowerCase().includes(text.toLowerCase())) })
}
function updateField(key, value) { emit('update:modelValue', { ...props.modelValue, [key]: value || '' }) }
watch(() => props.facets, () => { for (const key of Object.keys(choices)) delete choices[key] })
</script>
