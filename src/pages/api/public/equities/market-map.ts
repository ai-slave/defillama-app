import { equitiesMarketMapDataset } from '~/containers/Equities/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(equitiesMarketMapDataset)
