import type { NextApiHandler } from 'next'
import { getDimensionDatasetTypeByPublicRoute } from '~/containers/AdapterMetrics/datasetTypes'
import { normalizeCacheList } from '~/server/api/cacheKey'
import { validateQueryList } from '~/server/api/params'
import { recordRouteRuntimeError, withApiRouteTelemetry } from '~/utils/telemetry'
import { fetchDimensionDataset, getDimensionDatasetSpec } from './datasets'

export function createAdapterMetricDatasetHandler(publicMetric: string): NextApiHandler {
	const datasetType = getDimensionDatasetTypeByPublicRoute(publicMetric)
	const spec = datasetType ? getDimensionDatasetSpec(datasetType) : undefined
	const route = `/api/dynamic/adapter-metrics/${publicMetric}`

	return withApiRouteTelemetry(route, async (req, res) => {
		if (!spec) {
			res.status(404).json({ error: 'Unsupported adapter metric dataset' })
			return
		}

		try {
			const { chains } = req.query
			const chainList = normalizeCacheList(typeof chains === 'string' ? [chains] : chains || [])
			const validationError = validateQueryList('chains', chainList, { maxItems: 50, maxItemLength: 200 })
			if (validationError) {
				res.status(400).json({ error: validationError })
				return
			}
			const result = await fetchDimensionDataset({ ...spec.options, chains: chainList })
			res.status(200).json(result)
		} catch (error) {
			recordRouteRuntimeError(error, 'apiRoute')
			res.status(500).json({ error: `Failed to fetch ${publicMetric} data` })
		}
	})
}
