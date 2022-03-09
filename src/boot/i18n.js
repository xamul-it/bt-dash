import { boot } from 'quasar/wrappers'
import { constants } from 'boot/constants'
import { createI18n } from 'vue-i18n'
import messages from 'src/i18n'

export default boot(({ app }) => {
  const i18n = createI18n({
    locale: constants.APP_LOCALE,
    messages
  })

  // Set i18n instance on app
  app.use(i18n)
})
