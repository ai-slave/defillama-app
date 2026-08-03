import { dashboardSqlRunApiHandler } from '~/containers/ProDashboard/server/sqlRunRoute'

export const config = { api: { responseLimit: false } }

export default dashboardSqlRunApiHandler
