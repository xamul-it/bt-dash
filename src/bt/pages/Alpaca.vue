<template>
  <q-page class="row full-width">
    <div class="full-width">
      <AlpacaPortfolioPrototype />
      <OrderForm />
    </div>
  </q-page>
</template>

<script>
import AlpacaPortfolioPrototype from 'src/bt/components/AlpacaPortfolioPrototype.vue'
import OrderForm from 'src/bt/components/OrderForm.vue'

export default {
  components: {
    AlpacaPortfolioPrototype,
    OrderForm
  }
}
</script>
