import { rwaPerpsOverviewBreakdown } from '~/containers/RWA/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(rwaPerpsOverviewBreakdown)
