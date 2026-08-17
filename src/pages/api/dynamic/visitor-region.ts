import { toNextHandler } from '~/server/api/nextAdapter'
import { visitorRegionRoute } from '~/server/visitorRegionRoute'

export default toNextHandler(visitorRegionRoute)
