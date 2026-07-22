import { leadClaim } from '~/containers/MarketMakers/server/leads'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(leadClaim)
