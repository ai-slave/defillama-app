import { yieldsProxy } from '~/containers/Yields/server/proxy'
import { toNextHandler } from '~/server/api/nextAdapter'

export { buildYieldsProxyUrl } from '~/containers/Yields/server/proxy'

export default toNextHandler(yieldsProxy)
