
const constants = {
<<<<<<< HEAD
//  API_BASE_URL: 'http://213.171.162.127/dash',
  API_BASE_URL: 'http://backtrader.ilz.it/',
  API_BASE_FOLDER: '../out',
  API_BACKUP_FOLDER: '../backup',
=======
  //const apiBaseUrl = process.env.VUE_APP_API_URL;

  API_BASE_URL: process.env.VUE_APP_API_URL,  
  //API_BASE_URL: 'http://localhost:9090',
  API_BASE_FOLDER: '/out',
  API_BACKUP_FOLDER: '/backup',
>>>>>>> 7ea6e3b7eaa94f1828238bef999985a2fa2b824a
  API_BACKUP_BASE_FOLDER: '/out',
  API_INDEX_FILE: '/index.json',
  API_TICKER_DATA_FILE: '/results.json',
  STATS_FILE: '/stats.html',
  API_ORDERS_FILE: '/orders.json',
  API_POSITIONS_FILE: '/positions.json',  
  API_TODAY_FILE: '/today.json',
  PAGE_DETAILS: '/details',

  //Locale
  APP_LOCALE: 'en-US',

}

export { constants }
