<template>
    <q-page class="q-pa-sm">
        <div class="row q-col-gutter-sm q-py-sm items-start">
            <strategy-form> </strategy-form>
        </div>
        <div class="items-start">
        <tasks-actions class="q-mt-lg"></tasks-actions>
    </div>
    </q-page>
</template>
  
<script>
import { defineComponent, defineAsyncComponent } from 'vue'

export default defineComponent({
    components: {
        StrategyForm: defineAsyncComponent(() => import('components/dialogs/StrategyForm')),
        TasksActions: defineAsyncComponent(() => import('components/tables/TasksActions')),

    }
});
</script>
  
<style>
/* Stili CSS opzionali per MyPage */
</style>
  