import { tokenExchangeListings } from '~/containers/Markets/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(tokenExchangeListings)
