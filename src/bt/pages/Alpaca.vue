<template>
    <q-page class="row full-width">
      <div class="full-width">
        <Portfolio />
        <OrderForm />
      </div>
    </q-page>
  </template>
  
  <script>
  import Portfolio from 'src/bt/components/Portfolio.vue';
  import OrderForm from 'src/bt/components/OrderForm.vue';
  
  export default {
    components: {
      Portfolio,
      OrderForm,
    },
  };
  </script>