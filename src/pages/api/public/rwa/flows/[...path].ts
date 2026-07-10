import { rwaFlowsProxy } from '~/containers/RWA/server/flows'
import { toNextHandler } from '~/server/api/nextAdapter'

export { buildRWAFlowProxyUrl } from '~/containers/RWA/server/flows'

export default toNextHandler(rwaFlowsProxy)
