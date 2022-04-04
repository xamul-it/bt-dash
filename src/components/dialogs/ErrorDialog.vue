<template>

  <q-dialog v-model="isErrorDialog" persistent transition-show="scale" transition-hide="scale"> <!-- @hide="" -->
      <q-card class="bg-red text-white" style="width: 300px">
        <q-card-section>
          <div class="text-h6">{{$t('error')}}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          {{ errorText }}
        </q-card-section>

        <q-card-actions align="right" class="bg-white text-teal">
          <q-btn flat label="OK" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

</template>

<script>
import {defineComponent, ref, onMounted, onUpdated} from 'vue';

export default defineComponent({
  name: "ErrorDialog",
  props: {
    isError: {
      type: Boolean,
      default: false
    },
    errorText: {
      type: String,
      default: ''
    }
  },

  //<q-btn @click="$emit('sourceUrl', baseURL+'/'+name+constants.STATS_FILE)" flat round color="primary" icon="insights" size="sm">

  setup(props) {
    const isErrorDialog = ref(props.isError)

    return {
      isErrorDialog
    }
  }
})
</script>

<style scoped>

</style>
