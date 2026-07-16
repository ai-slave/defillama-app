import type { NextApiRequest, NextApiResponse } from 'next'
import { datasetsBySlug, type DatasetDefinition, type DatasetItem } from '~/containers/Downloads/datasets'
import { withDownloadRoute, type DownloadAccess } from '~/server/api/withDownloadRoute'
import { flattenItemsToCsv } from '~/server/sql/csv'
import { slug as toSlug } from '~/utils'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value)
}

function recordField(value: unknown, field: string): unknown {
	return isRecord(value) ? value[field] : undefined
}
function insertChainIntoOverviewUrl(baseUrl: string, chain: string): string {
	const url = new URL(baseUrl)
	url.pathname = `${url.pathname}/${toSlug(chain)}`
	return url.toString()
}

function extractChainsForDataset(dataset: DatasetDefinition, json: unknown): string[] {
	if (dataset.chainFilterType === 'overview') {
		const allChains = recordField(json, 'allChains')
		if (!Array.isArray(allChains)) return []

		const chainTotals = new Map<string, number>()
		for (const chain of allChains) {
			if (typeof chain === 'string') chainTotals.set(chain, 0)
		}

		const protocols = recordField(json, 'protocols')
		if (!Array.isArray(protocols)) return [...chainTotals.keys()]
		for (const protocol of protocols) {
			const breakdown = recordField(protocol, 'breakdown24h')
			if (!isRecord(breakdown)) continue
			for (const [chainSlug, values] of Object.entries(breakdown)) {
				if (!isRecord(values)) continue
				const total = Object.values(values).reduce<number>((sum, value) => sum + (Number(value) || 0), 0)
				for (const [name, current] of chainTotals) {
					if (toSlug(name) === chainSlug) {
						chainTotals.set(name, current + total)
						break
					}
				}
			}
		}

		return [...chainTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
	}

	if (dataset.chainFilterType === 'protocols') {
		const items = dataset.extractItems(json)
		const chainTotals = new Map<string, number>()
		for (const item of items) {
			const chains = item.chains
			const chainTvls = item.chainTvls
			if (!Array.isArray(chains)) continue
			for (const c of chains) {
				if (typeof c !== 'string') continue
				const entry = isRecord(chainTvls) ? chainTvls[c] : undefined
				const tvl = isRecord(entry) && typeof entry.tvl === 'number' ? entry.tvl : typeof entry === 'number' ? entry : 0
				chainTotals.set(c, (chainTotals.get(c) ?? 0) + tvl)
			}
		}
		return [...chainTotals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
	}

	return []
}

function pctChange(current: number | null | undefined, prev: number | null | undefined): number | null {
	if (current == null || prev == null || prev === 0) return null
	return ((current - prev) / prev) * 100
}

function filterProtocolsByChain(items: DatasetItem[], chain: string): DatasetItem[] {
	return items
		.filter((item) => {
			const chains = item.chains
			return Array.isArray(chains) && chains.includes(chain)
		})
		.map((item) => {
			const entry = isRecord(item.chainTvls) ? item.chainTvls[chain] : undefined
			let tvl: number | null = null
			let tvlPrevDay: number | null = null
			let tvlPrevWeek: number | null = null
			let tvlPrevMonth: number | null = null

			if (isRecord(entry)) {
				tvl = typeof entry.tvl === 'number' ? entry.tvl : null
				tvlPrevDay = typeof entry.tvlPrevDay === 'number' ? entry.tvlPrevDay : null
				tvlPrevWeek = typeof entry.tvlPrevWeek === 'number' ? entry.tvlPrevWeek : null
				tvlPrevMonth = typeof entry.tvlPrevMonth === 'number' ? entry.tvlPrevMonth : null
			} else if (typeof entry === 'number') {
				tvl = entry
			}

			return {
				...item,
				chain,
				tvl,
				tvlPrevDay,
				tvlPrevWeek,
				tvlPrevMonth,
				change_1d: pctChange(tvl, tvlPrevDay),
				change_7d: pctChange(tvl, tvlPrevWeek),
				change_1m: pctChange(tvl, tvlPrevMonth)
			}
		})
}

function getRouteParams(req: NextApiRequest, res: NextApiResponse) {
	const { dataset: datasetSlug, mode, chain } = req.query
	if (typeof datasetSlug !== 'string') {
		res.status(400).json({ error: 'Invalid dataset parameter' })
		return null
	}

	const dataset = datasetsBySlug.get(datasetSlug)
	if (!dataset) {
		res.status(404).json({ error: `Dataset "${datasetSlug}" not found` })
		return null
	}

	return { datasetSlug, dataset, mode, chain }
}

async function handler(
	_req: NextApiRequest,
	res: NextApiResponse,
	access: DownloadAccess,
	{
		datasetSlug,
		dataset,
		mode,
		chain
	}: { datasetSlug: string; dataset: DatasetDefinition; mode: unknown; chain: unknown }
) {
	const chainParam = typeof chain === 'string' ? chain.trim() : null
	const isChainMode = mode === 'chains'

	if ((isChainMode || chainParam) && !dataset.chainFilterType) {
		return res.status(400).json({ error: `Dataset "${datasetSlug}" does not support chain filtering` })
	}

	const isCsvDownload = !isChainMode
	if (access === 'trial' && isCsvDownload) {
		return res.status(403).json({ error: 'CSV downloads are available only for paid users.' })
	}

	let json: unknown = null
	let items: Array<Record<string, unknown>>
	switch (datasetSlug) {
		case 'yields': {
			const [{ getYieldsExportRows }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Downloads/yields.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			items = await getYieldsExportRows(await acquireYieldsSnapshot('background'))
			break
		}
		case 'yields-borrow': {
			const [{ getBorrowMarketsExportRows }, { acquireYieldsSnapshot }] = await Promise.all([
				import('~/containers/Downloads/yields.server'),
				import('~/containers/Yields/server/dataset.server')
			])
			items = await getBorrowMarketsExportRows(await acquireYieldsSnapshot('background'))
			break
		}
		case 'perp-funding':
		case 'lsd-rates': {
			const { YIELDS_SERVER_URL } = await import('~/constants')
			const upstreamPath = datasetSlug === 'perp-funding' ? 'perps' : 'lsdRates'
			const upstream = await fetchWithPoolingOnServer(`${YIELDS_SERVER_URL}/${upstreamPath}`)
			if (!upstream.ok) {
				return res.status(502).json({ error: `Upstream API returned ${upstream.status}` })
			}
			json = await upstream.json()
			items = dataset.extractItems(json)
			break
		}
		default: {
			let fetchUrl = dataset.url
			if (chainParam && dataset.chainFilterType === 'overview') {
				fetchUrl = insertChainIntoOverviewUrl(dataset.url, chainParam)
			}

			const upstream = await fetchWithPoolingOnServer(fetchUrl)
			if (!upstream.ok) {
				return res.status(502).json({ error: `Upstream API returned ${upstream.status}` })
			}
			json = await upstream.json()
			items = dataset.extractItems(json)
		}
	}

	if (isChainMode) {
		const chains = extractChainsForDataset(dataset, json)
		return res.status(200).json({ chains })
	}

	if (chainParam && dataset.chainFilterType === 'protocols') {
		items = filterProtocolsByChain(items, chainParam)
	}

	if (access === 'preview') {
		items = items.slice(0, 10)
	}

	const csv = flattenItemsToCsv(items, dataset.fields)

	res.setHeader('Content-Type', 'text/csv; charset=utf-8')
	res.setHeader('Content-Disposition', `attachment; filename="${datasetSlug}.csv"`)
	if (access === 'preview') {
		res.setHeader('X-Preview', 'true')
	}
	return res.status(200).send(csv)
}

export default withDownloadRoute({
	route: '/api/private/downloads/[dataset]',
	getRouteParams,
	handler
})
