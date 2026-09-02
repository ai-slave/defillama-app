import { utrClaimSubmit } from '~/containers/UniversalTokenRating/server/claimProxy'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(utrClaimSubmit)
