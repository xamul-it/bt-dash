<template>
    <q-page class="q-pa-sm">
        <div class="row q-col-gutter-sm q-py-sm items-start">
            <strategy-form> </strategy-form>
        </div>

    </q-page>
</template>
  
<script>
import { defineComponent, defineAsyncComponent } from 'vue'

export default defineComponent({
    components: {
        StrategyForm: defineAsyncComponent(() => import('components/dialogs/StrategyForm')),
    }
});
</script>
  
<style>
/* Stili CSS opzionali per MyPage */
</style>
  