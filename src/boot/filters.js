import { boot } from 'quasar/wrappers'

export default boot(async ( { app } ) => {
  app.config.globalProperties.$filters = {
    floatFormat(value, digits) {
      if(value && !isNaN(value) && typeof value == "number") {
        //console.log('floatFormat', value, digits, typeof value)
        return value.toFixed(digits)
      } else {
        return value
      }
    }
  }
})
