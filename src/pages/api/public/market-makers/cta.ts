import { leadCta } from '~/containers/MarketMakers/server/leads'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(leadCta)
