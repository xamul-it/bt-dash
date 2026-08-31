<template>
  <div class="fullscreen flex flex-center bg-primary">
    <q-card style="width: 320px; max-width: 90vw">
      <q-card-section class="text-h6 text-center">Backtrader Watchtower</q-card-section>
      <q-form @submit="submit">
        <q-card-section class="q-gutter-md">
          <input
            type="text"
            name="username"
            autocomplete="username"
            value="watchtower"
            hidden
          />
          <q-input
            v-model="password"
            type="password"
            label="Password"
            autocomplete="current-password"
            autofocus
            :error="!!error"
            :error-message="error"
          />
        </q-card-section>
        <q-card-actions>
          <q-btn
            type="submit"
            color="primary"
            class="full-width"
            label="Entra"
            :loading="loading"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </div>
</template>

<script>
import { api } from 'boot/axios'

export default {
  name: 'LoginPage',
  data () {
    return { password: '', error: '', loading: false }
  },
  methods: {
    async submit () {
      this.loading = true
      this.error = ''
      try {
        await api.post('/auth/login', { password: this.password })
        const q = this.$route.query.redirect
        const redirect = (Array.isArray(q) ? q[0] : q) || '/'
        this.$router.replace(redirect).catch(() => {})
      } catch (e) {
        this.error = e.response && e.response.status === 401
          ? 'Password errata'
          : 'Errore di connessione'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>
