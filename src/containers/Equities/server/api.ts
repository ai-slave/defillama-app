import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'
import { getEquitiesSnapshot, getEquitiesTablePage, getEquitiesTreemapPage } from './tableData.server'

// no-store outside production: cacheable dev responses can poison the browser's HTTP
// cache during code churn (a stale empty 200 then serves every client-side navigation).
const EQUITIES_DATASET_CACHE_CONTROL =
	process.env.NODE_ENV === 'production' ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store'

export const equitiesDataset = defineApiRoute({
	route: '/api/public/equities',
	cacheControl: EQUITIES_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			return ok(await getEquitiesTablePage(await getEquitiesSnapshot(), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch equities data')
		}
	}
})

export const equitiesMarketMapDataset = defineApiRoute({
	route: '/api/public/equities/market-map',
	cacheControl: EQUITIES_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			return ok(await getEquitiesTreemapPage(await getEquitiesSnapshot(), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch equities market map data')
		}
	}
})
