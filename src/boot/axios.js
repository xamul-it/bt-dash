import { boot } from 'quasar/wrappers'
import { constants } from 'boot/constants'

import axios from 'axios'

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const api = axios.create({ baseURL: constants.API_BASE_URL })

export default boot(({ app, router }) => {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = (error.config && error.config.url) || ''
      if (error.response && error.response.status === 401 && !url.includes('/auth/')) {
        const current = router.currentRoute.value
        if (current.path !== '/login') {
          router.replace({ path: '/login', query: { redirect: current.fullPath } })
        }
      }
      return Promise.reject(error)
    }
  )

  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { api }
