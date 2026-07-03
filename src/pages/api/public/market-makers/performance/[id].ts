import { marketMakerPerformanceDetail } from '~/containers/MarketMakers/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(marketMakerPerformanceDetail)
