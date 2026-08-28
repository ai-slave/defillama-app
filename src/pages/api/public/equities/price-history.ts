import { equitiesPriceHistoryProxy } from '~/containers/Equities/server/priceHistory.api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(equitiesPriceHistoryProxy)
