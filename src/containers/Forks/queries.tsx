import { chartColor, OTHERS_COLOR } from '~/constants/colors'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import { resolveProtocolParamFromMetadata } from '~/containers/ProtocolOverview/server/routes'
import { getProtocolsByChain } from '~/containers/ProtocolRankings/queries.server'
import { slug } from '~/utils'
import { fetchForkMetrics, fetchForkProtocolBreakdownChart } from './api'
import type { IForkProtocolBreakdownChart } from './api.types'
import { getForkToOriginalTvlPercent } from './tvl'
import type { ForkByProtocolPageResult, ForkOverviewPageData, ForkProtocolChartData } from './types'

function getLatestTvlByFork(chartData: IForkProtocolBreakdownChart): Partial<Record<string, number>> {
	const latestTvlByFork: Partial<Record<string, number>> = {}
	const lastDay = chartData.at(-1)
	if (!lastDay) return latestTvlByFork

	for (const key in lastDay) {
		if (key === 'timestamp') continue
		const value = lastDay[key]
		if (value !== undefined) latestTvlByFork[key] = value
	}
	return latestTvlByFork
}

function sortForksByLatestTvl(
	forkNames: Array<string>,
	latestTvlByFork: Partial<Record<string, number>>
): Array<string> {
	return forkNames.toSorted((a, b) => (latestTvlByFork[b] ?? 0) - (latestTvlByFork[a] ?? 0))
}

// - /forks
export async function getForksListPageData(): Promise<ForkOverviewPageData | null> {
	try {
		const [metrics, { protocols: fetchedProtocols }, chartData] = await Promise.all([
			fetchForkMetrics(),
			fetchProtocols(),
			fetchForkProtocolBreakdownChart()
		])
		const forkNames: Array<string> = []
		for (const forkName in metrics) forkNames.push(forkName)
		const latestTvlByFork = getLatestTvlByFork(chartData)
		const sortedForks = sortForksByLatestTvl(forkNames, latestTvlByFork)
		const forkNameBySlug = new Map<string, string>()
		const forkedProtocolNamesByFork = new Map<string, Set<string>>()
		for (const forkName of forkNames) forkNameBySlug.set(slug(forkName), forkName)
		for (const protocol of fetchedProtocols) {
			for (const forkedFrom of protocol.forkedFrom ?? []) {
				const forkName = forkNameBySlug.get(slug(forkedFrom))
				if (!forkName) continue
				const protocolNames = forkedProtocolNamesByFork.get(forkName)
				if (protocolNames) protocolNames.add(protocol.name)
				else forkedProtocolNamesByFork.set(forkName, new Set([protocol.name]))
			}
		}

		const forkColors: Record<string, string> = { Others: OTHERS_COLOR }
		for (const [index, forkName] of sortedForks.entries()) forkColors[forkName] = chartColor(index)

		const protocolsByName = new Map<string, (typeof fetchedProtocols)[number]>()
		for (const protocol of fetchedProtocols) protocolsByName.set(protocol.name, protocol)
		const tableData: ForkOverviewPageData['tableData'] = []
		for (const forkName of sortedForks) {
			const forkedProtocols = forkedProtocolNamesByFork.get(forkName)?.size ?? 0
			const tvl = latestTvlByFork[forkName] ?? 0
			const parentProtocol = protocolsByName.get(forkName)
			const parentTvl = parentProtocol?.tvl

			tableData.push({
				name: forkName,
				logo: parentProtocol?.logo ?? null,
				deprecated: parentProtocol?.deprecated === true,
				tvl,
				forkedProtocols,
				parentTvl: parentTvl ?? null,
				ftot: getForkToOriginalTvlPercent(tvl, parentTvl)
			})
		}

		const forkLinks = [{ label: 'All', to: '/forks' }].concat(
			sortedForks.map((forkName) => ({ label: forkName, to: `/forks/${slug(forkName)}` }))
		)

		return { forks: sortedForks, forkLinks, forkColors, tableData, chartData }
	} catch (error) {
		console.error('Error fetching forks list page data', error)
		return null
	}
}

// - /forks/:fork
export async function getForksByProtocolPageData({ fork }: { fork: string }): Promise<ForkByProtocolPageResult> {
	try {
		const metadataCache = await import('~/utils/metadata').then((m) => m.default)
		const route = resolveProtocolParamFromMetadata(fork, metadataCache)
		if (!route?.metadata.forks) return { status: 'not-found' }

		const metrics = await fetchForkMetrics()
		const forkNames: Array<string> = []
		for (const forkName in metrics) {
			forkNames.push(forkName)
		}
		const canonicalFork = forkNames.find((forkName) => slug(forkName) === route.canonicalSlug)

		if (!canonicalFork) {
			return { status: 'unavailable' }
		}
		if (!metrics[canonicalFork]) return { status: 'unavailable' }

		const [protocolsByChainData, forkBreakdownChartData] = await Promise.all([
			// Deliberately NOT the shared rankings snapshot: the fork filter runs
			// BEFORE parent aggregation, so a parent's totals cover only its
			// fork-matching children. Post-filtering the 'All' snapshot cannot
			// reproduce that without recomputing parent rows.
			getProtocolsByChain({
				chain: 'All',
				chainMetadata: metadataCache.chainMetadata,
				protocolMetadata: metadataCache.protocolMetadata,
				fork: canonicalFork
			}),
			fetchForkProtocolBreakdownChart()
		])
		const protocolTableData = protocolsByChainData?.protocols ?? []
		const chartData: ForkProtocolChartData = []
		for (const row of forkBreakdownChartData) {
			const value = row[canonicalFork]
			if (value !== undefined) chartData.push([row.timestamp, value])
		}

		// Build fork links with same TVL ordering as overview page
		const sortedForks = sortForksByLatestTvl(forkNames, getLatestTvlByFork(forkBreakdownChartData))
		const forkLinks = [{ label: 'All', to: '/forks' }].concat(
			sortedForks.map((f) => ({ label: f, to: `/forks/${slug(f)}` }))
		)

		return {
			status: 'success',
			data: { fork: canonicalFork, forkLinks, protocolTableData, chartData }
		}
	} catch (error) {
		console.error('Error fetching fork details page data', error)
		return { status: 'unavailable' }
	}
}
