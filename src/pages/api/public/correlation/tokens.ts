import { correlationTokens } from '~/containers/Correlations/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(correlationTokens)
