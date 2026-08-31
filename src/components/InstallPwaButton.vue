<template>
  <q-btn
    v-if="canInstall"
    dense
    flat
    color="white"
    icon="install_mobile"
    label="Installa app"
    @click="install"
  />
  <q-btn
    v-else-if="showIosHint"
    dense
    flat
    round
    color="white"
    icon="ios_share"
    @click="iosDialog = true"
  >
    <q-dialog v-model="iosDialog">
      <q-card>
        <q-card-section class="text-subtitle1">Installa su iPhone/iPad</q-card-section>
        <q-card-section>
          Apri il menu <b>Condividi</b> di Safari e scegli
          <b>«Aggiungi a Home»</b>.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="OK" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-btn>
</template>

<script>
export default {
  name: 'InstallPwaButton',
  data () {
    return {
      deferredPrompt: null,
      canInstall: false,
      iosDialog: false
    }
  },
  computed: {
    isStandalone () {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
    },
    isIos () {
      return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    },
    showIosHint () {
      return this.isIos && !this.isStandalone
    }
  },
  mounted () {
    if (this.isStandalone) return
    window.addEventListener('beforeinstallprompt', this.onPrompt)
    window.addEventListener('appinstalled', this.onInstalled)
  },
  beforeUnmount () {
    window.removeEventListener('beforeinstallprompt', this.onPrompt)
    window.removeEventListener('appinstalled', this.onInstalled)
  },
  methods: {
    onPrompt (e) {
      e.preventDefault()
      this.deferredPrompt = e
      this.canInstall = true
    },
    onInstalled () {
      this.canInstall = false
      this.deferredPrompt = null
    },
    async install () {
      if (!this.deferredPrompt) return
      this.deferredPrompt.prompt()
      await this.deferredPrompt.userChoice
      this.deferredPrompt = null
      this.canInstall = false
    }
  }
}
</script>
