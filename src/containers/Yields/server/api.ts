import { ok, upstreamError } from '~/server/api/respond'
import { defineApiRoute } from '~/server/api/types'
import { recordRouteRuntimeError } from '~/utils/telemetry'

// Public Yields v2 API entry points pin one immutable generation and memoize enrichment by artifact ref,
// so per-request work is limited to query shaping.
// no-store outside production: cacheable dev responses can poison the browser's HTTP
// cache during code churn (a stale empty 200 then serves every client-side navigation).
const YIELDS_DATASET_CACHE_CONTROL =
	process.env.NODE_ENV === 'production' ? 'public, s-maxage=300, stale-while-revalidate=3600' : 'no-store'

export const yieldsEarnDataset = defineApiRoute({
	route: '/api/public/yields/earn',
	cacheControl: YIELDS_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const [{ getEarnPage }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Yields/data/earn.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			return ok(await getEarnPage(await acquireYieldsSnapshot('background'), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yields earn data')
		}
	}
})

export const yieldsBorrowMarketsDataset = defineApiRoute({
	route: '/api/public/yields/borrow-markets',
	cacheControl: YIELDS_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const [{ getBorrowMarketsPage }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Yields/data/borrow.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			return ok(await getBorrowMarketsPage(await acquireYieldsSnapshot('background'), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yields borrow markets data')
		}
	}
})

export const yieldsBorrowRoutesDataset = defineApiRoute({
	route: '/api/public/yields/borrow-routes',
	cacheControl: YIELDS_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const [{ getBorrowRoutesPage }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Yields/data/borrow.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			return ok(await getBorrowRoutesPage(await acquireYieldsSnapshot('background'), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yields borrow routes data')
		}
	}
})

export const yieldsLoopsDataset = defineApiRoute({
	route: '/api/public/yields/loops',
	cacheControl: YIELDS_DATASET_CACHE_CONTROL,
	handle: async (req) => {
		try {
			const [{ getLoopsPage }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Yields/data/loops.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			return ok(await getLoopsPage(await acquireYieldsSnapshot('background'), req.query))
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			return upstreamError('Failed to fetch yields loops data')
		}
	}
})
