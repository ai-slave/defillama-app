import { rwaPerpsMarketBreakdown } from '~/containers/RWA/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export { parsePerpsMarketBreakdownRequest as parseMarketBreakdownRequest } from '~/containers/RWA/server/api'

export default toNextHandler(rwaPerpsMarketBreakdown)
