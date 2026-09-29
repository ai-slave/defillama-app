import { cryptoCardIssuers } from '~/containers/CryptoCards/server/upstream'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(cryptoCardIssuers)
