<template>

  <q-card v-if="rows.length>0" class="full-width q-ma-md q-pa-none">
    <q-card-section class="full-width q-pa-none">
      <q-table
        :title="tableTitle"
        :rows="rows"
        :filter="filter"
        :sort-method = "customSort"
        :loading = "loading"
        separator = "vertical"
        :pagination="initialPagination"
        flat
        bordered
      >

        <template v-slot:top-right>
          <q-input v-if="show_filter" filled borderless dense debounce="300" v-model="filter" placeholder="Search">
            <template v-slot:append>
              <q-icon name="search"/>
            </template>
          </q-input>

          <q-btn class="q-ml-sm" icon="filter_list" @click="show_filter=!show_filter" flat/>
        </template>

        <template v-slot:no-data="{ icon, message, filter }">
          <div class="full-width row flex-center text-accent q-gutter-sm">
            <q-icon size="2em" name="sentiment_dissatisfied" />
            <span>
              Well this is sad... {{ isError? errorText:message }}
            </span>
            <q-icon size="2em" :name="filter ? 'filter_b_and_w' : icon" />
          </div>
        </template>

      </q-table>
    </q-card-section>
  </q-card>

</template>

<script>
import { defineComponent, toRefs, ref, watch, onMounted, } from 'vue'
import { api } from 'boot/axios'
import { constants } from 'boot/constants'
import { date } from 'quasar'

export default defineComponent({
  name: 'TableDataApi',
  props: {
    tableTitle: {
      type: String,
      required: true,
      default: 'Title [required]'
    },
    apiURL: {
      type: String,
      required: true,
      default: '#'
    },
    jsonDataPath: {
      type: Array,
      required: false,
      default: ['data']
    }
  },
  components: {
  },
  setup(props) {
    const rows = ref([])
    const columns = ref([])

    const loading = ref(false)

    const show_filter = ref(false)

    const isError = ref(false)
    const errorText = ref('')

    watch(() => props.apiURL, (newApiURL, prevApiURL) => {
      getLatestData()
    })

    function getLatestData (path = constants.API_BASE_FOLDER) {
      loading.value = true
      api.get(props.apiURL).then((response) => {

        let rd = response
        for(let i in props.jsonDataPath) {
          rd = rd[props.jsonDataPath[i]]
        }
        rows.value = prepareTableData(rd)
      })
      .catch( (e) => {
        handleUnexpectedError(e)
      })
      .finally(()=> {
        loading.value = false
      })
    }

    function prepareTableData(data) {
      if(!data) {
        throw {message: 'No data in '+ props.jsonDataPath + ' path'}
      }
      //ROWS
      let dataRows = []
      let keys = Object.keys(data)

      //console.log('keys', keys)

      for(let ki in keys) {
        for(let i in data[keys[ki]]) {

          let dataRow = []
          if( typeof data[keys[ki]][i] === 'object' ) {
            dataRow = Object.assign({"name":keys[ki]}, data[keys[ki]][i])
            dataRows.push(dataRow)
          } else {
            dataRow = Object.assign({"name":keys[ki]}, data[keys[ki]])
            dataRows.push(dataRow)
            break;
          }
        }
      }

      //console.log('Rows', dataRows)

      //COLUMNS
      let dataColumns = []
      keys = Object.keys(dataRows[0])
      for(let ki in keys) {
        let column = {}

        column.name = keys[ki]
        column.label = keys[ki]
        column.field = keys[ki]
        column.sortable = false
        column.required = true
        //column.align = 'left'
        //column.format: val => `${val}`
        //column.sort: (a, b) => parseInt(a, 10) - parseInt(b, 10)

        dataColumns.push(column)

      }

      columns.value = dataColumns

      //console.log('Columns', dataColumns)

      return dataRows
    }

    function customSort(rows, sortBy, descending) {
      const data = [...rows]

      if (sortBy) {
        data.sort((a, b) => {
          const x = descending ? b : a
          const y = descending ? a : b

          if (sortBy === 'name' || sortBy === 'ordertype') {
            // string sort
            return x[ sortBy ] > y[ sortBy ] ? 1 : x[ sortBy ] < y[ sortBy ] ? -1 : 0
          } else if (sortBy === 'created' || sortBy === 'date') {
            //date sort
            let dateFormat = 'DD-MM-YYYY'
            let xDate =  date.extractDate(x[ sortBy ], dateFormat)
            let yDate =  date.extractDate(y[ sortBy ], dateFormat)
            return date.getDateDiff(xDate, yDate)
          } else {
            // numeric sort
            let xN = parseFloat(x[ sortBy ])
            xN = Number.isNaN(xN) ? Number.MIN_VALUE : xN
            let yN = parseFloat(y[ sortBy ])
            yN = Number.isNaN(yN) ? Number.MIN_VALUE : yN
            return xN - yN
          }
        })
      }

      return data
    }

    function handleUnexpectedError(e) {
      rows.value = []
      errorText.value = e.message
      isError.value = true
    }

    function reset() {
      rows.value = []
      loading.value = false
      getLatestData()
    }

    onMounted(() => {
      console.log(props.apiURL, props.jsonDataPath)
      getLatestData()
    })

    return {
      rows,
      columns,
      loading,
      filter: ref(''),
      show_filter,
      isError,
      errorText,
      customSort,
      initialPagination: {
        sortBy: 'desc',
        descending: false,
        page: 1,
        rowsPerPage: 10
        // rowsNumber: xx if getting data from a server
      }
    }
  }
 })
</script>
