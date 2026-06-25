<template>
  <q-page class="q-pa-md">
    <div class="row items-start q-col-gutter-md q-mb-md">
      <div class="col">
        <div class="text-h5">Watchtower Service Monitoring</div>
        <div class="text-caption text-grey-7">
          Monitoraggio operativo dei servizi systemd osservati da Watchtower.
        </div>
        <div v-if="lastRefreshAt" class="text-caption text-grey-6">
          Ultimo refresh: {{ formatDateTime(lastRefreshAt) }}
        </div>
      </div>
      <div class="col-auto">
        <q-btn
          color="primary"
          icon="refresh"
          label="Refresh"
          :loading="isRefreshing"
          @click="refreshPage"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey-7">Active</div>
            <div class="text-h5 text-positive">{{ activeServicesCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey-7">Degraded</div>
            <div class="text-h5 text-warning">{{ degradedServicesCount }}</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-4">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-caption text-grey-7">Failed</div>
            <div class="text-h5 text-negative">{{ failedServicesCount }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row q-col-gutter-md items-end">
        <div class="col-12 col-lg-9">
          <q-select
            v-model="serviceConfig"
            :options="serviceOptions"
            label="Observed systemd services"
            multiple
            use-chips
            use-input
            new-value-mode="add-unique"
            dense
            outlined
            emit-value
            map-options
          />
        </div>
        <div class="col-12 col-lg-3">
          <q-btn
            color="primary"
            label="Save services"
            :loading="isSavingConfig"
            @click="saveServiceConfig"
          />
        </div>
      </q-card-section>
      <q-card-section class="text-caption text-grey-7">
        Config file: {{ serviceConfigPath || 'default' }}
      </q-card-section>
    </q-card>

    <q-card flat bordered>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Observed Services</div>
          <div class="text-caption text-grey-7">
            {{ serviceConfig.length }} servizi monitorati
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-section>
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6 col-lg-3" v-for="service in services" :key="service.name">
            <q-card flat bordered class="service-card">
              <q-card-section class="row items-center q-pa-sm">
                <div class="col">
                  <div class="text-body2 text-weight-medium">{{ service.name }}</div>
                  <div class="text-caption">
                    load: {{ service.load }} | active: {{ service.active }}/{{ service.sub }} | enabled: {{ service.enabled }}
                  </div>
                  <div class="text-caption text-grey-7" v-if="service.description">{{ service.description }}</div>
                </div>
                <div class="col-auto">
                  <q-badge :color="serviceBadgeColor(service)">
                    {{ serviceStatusLabel(service) }}
                  </q-badge>
                </div>
              </q-card-section>
              <q-card-actions align="right" class="q-pa-xs">
                <q-btn flat dense size="sm" label="Start" @click="serviceAction(service.name, 'start')" />
                <q-btn flat dense size="sm" label="Stop" @click="serviceAction(service.name, 'stop')" />
                <q-btn flat dense size="sm" label="Restart" @click="serviceAction(service.name, 'restart')" />
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script>
import { computed, defineComponent, onMounted, ref } from 'vue'
import axios from 'axios'
import { Notify } from 'quasar'
import { constants } from 'boot/constants'

export default defineComponent({
  name: 'WatchtowerServiceMonitoring',

  setup () {
    const services = ref([])
    const serviceConfig = ref([])
    const availableServices = ref([])
    const serviceConfigPath = ref('')
    const isRefreshing = ref(false)
    const isSavingConfig = ref(false)
    const lastRefreshAt = ref(null)

    const serviceOptions = computed(() => (
      availableServices.value.map((service) => ({
        label: service.description ? `${service.name} - ${service.description}` : service.name,
        value: service.name
      }))
    ))

    const activeServicesCount = computed(() => services.value.filter((service) => service.active === 'active').length)
    const failedServicesCount = computed(() => services.value.filter((service) => !service.exists || service.active === 'failed').length)
    const degradedServicesCount = computed(() => Math.max(services.value.length - activeServicesCount.value - failedServicesCount.value, 0))

    const formatDateTime = (value) => {
      if (!value) return 'NA'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
    }

    const serviceBadgeColor = (service) => {
      if (!service?.exists) return 'negative'
      if (service.active === 'active') return 'positive'
      if (service.active === 'failed') return 'negative'
      return 'warning'
    }

    const serviceStatusLabel = (service) => {
      if (!service?.exists) return 'not-found'
      return service.sub && service.sub !== service.active
        ? `${service.active}/${service.sub}`
        : service.active
    }

    const fetchJson = async (path) => {
      const response = await axios.get(`${constants.API_BASE_URL}${path}`)
      return response.data
    }

    const refreshPage = async () => {
      isRefreshing.value = true
      try {
        const requests = await Promise.allSettled([
          fetchJson('/dyn/obs/services'),
          fetchJson('/dyn/obs/services-config')
        ])
        const failures = []

        const applyResult = (index, onSuccess, label) => {
          const result = requests[index]
          if (result.status === 'fulfilled') {
            onSuccess(result.value)
            return
          }
          failures.push(`${label}: ${result.reason?.message || result.reason || 'unknown error'}`)
        }

        applyResult(0, (data) => { services.value = data }, 'services')
        applyResult(1, (data) => {
          serviceConfig.value = data.services || []
          availableServices.value = data.available || []
          serviceConfigPath.value = data.config_path || ''
        }, 'services-config')

        lastRefreshAt.value = new Date().toISOString()

        if (failures.length) {
          Notify.create({
            type: 'warning',
            message: `Service Monitoring partial refresh: ${failures.join(' | ')}`
          })
        }
      } catch (error) {
        Notify.create({
          type: 'negative',
          message: `Service Monitoring refresh error: ${error?.message || error}`
        })
      } finally {
        isRefreshing.value = false
      }
    }

    const saveServiceConfig = async () => {
      isSavingConfig.value = true
      try {
        const response = await axios.put(`${constants.API_BASE_URL}/dyn/obs/services-config`, {
          services: serviceConfig.value
        })
        serviceConfig.value = response.data.services || []
        serviceConfigPath.value = response.data.config_path || ''
        Notify.create({ type: 'positive', message: 'Services configuration updated' })
        await refreshPage()
      } catch (error) {
        Notify.create({ type: 'negative', message: `Services config error: ${error?.message || error}` })
      } finally {
        isSavingConfig.value = false
      }
    }

    const serviceAction = async (service, action) => {
      try {
        const response = await axios.post(`${constants.API_BASE_URL}/dyn/obs/services/${service}/${action}`)
        Notify.create({ type: 'positive', message: `${service}: ${action}` })
        if (response?.data?.stderr) {
          Notify.create({ type: 'warning', message: `${service}: ${response.data.stderr}` })
        }
        await refreshPage()
      } catch (error) {
        const message = error?.response?.data?.stderr
          || error?.response?.data?.error
          || error?.message
          || 'request failed'
        Notify.create({ type: 'negative', message: `${service}: ${action} failed - ${message}` })
      }
    }

    onMounted(refreshPage)

    return {
      services,
      serviceConfig,
      serviceConfigPath,
      serviceOptions,
      isRefreshing,
      isSavingConfig,
      lastRefreshAt,
      activeServicesCount,
      degradedServicesCount,
      failedServicesCount,
      refreshPage,
      saveServiceConfig,
      serviceAction,
      serviceBadgeColor,
      serviceStatusLabel,
      formatDateTime
    }
  }
})
</script>

<style scoped>
.service-card {
  min-height: 0;
}
</style>
