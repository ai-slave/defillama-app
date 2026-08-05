import { chartBuilderCsvApiHandler } from '~/containers/ProDashboard/server/chartBuilder/csvRoute'

export const config = { api: { responseLimit: false } }

export default chartBuilderCsvApiHandler
