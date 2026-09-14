import { dashboardOgImageHandler } from '~/containers/ProDashboard/server/ogImage/route'
import { withApiRouteTelemetry } from '~/utils/telemetry'

export default withApiRouteTelemetry('/api/og/pro/[dashboardId]', dashboardOgImageHandler)
