import { utrLeaderboardApi } from '~/containers/UniversalTokenRating/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(utrLeaderboardApi)
