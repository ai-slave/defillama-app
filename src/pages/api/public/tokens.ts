import { tokensDataset } from '~/containers/Tokens/server/api'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(tokensDataset)
