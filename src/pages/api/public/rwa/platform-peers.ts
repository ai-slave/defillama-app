import { rwaPlatformPeers } from '~/containers/RWA/server/platformPeers'
import { toNextHandler } from '~/server/api/nextAdapter'

export default toNextHandler(rwaPlatformPeers)
