import {
	DIMENSION_DATASET_SPEC_BY_TYPE,
	type DimensionDatasetProtocol
} from '~/containers/AdapterMetrics/server/datasets'
import { fetchProtocols } from '~/containers/ProtocolLists/api'
import type { ProtocolsResponse } from '~/containers/ProtocolLists/api.types'
import { aggregateProtocolTokenUsage } from '~/containers/TokenUsage/aggregate'
import { fetchProtocolsByToken } from '~/containers/TokenUsage/api'
import type { ProtocolTokenUsageData } from '~/containers/TokenUsage/api.types'
import {
	getDexVolumeByChain,
	getFeesAndRevenueProtocolsByChain,
	getOpenInterestByChain,
	getPerpsVolumeByChain
} from '../components/ProTable/proTable.api'
import type { ProTableDimensionProtocol } from '../components/ProTable/proTable.types'
import { getProLegacyTableDatasetQueryKey, getProTokenUsageQueryKey, normalizeProTokenSymbols } from '../tableQueryKeys'
import type { DashboardItemConfig, ProtocolsTableConfig } from '../types'
import { fetchProDimensionDataset } from './dimensionDataset'

export interface TableServerData {
	protocolsList: ProtocolsResponse | null
	volumeByChain: Record<string, ProTableChainOverview>
	feesByChain: Record<string, ProTableChainOverview>
	perpsByChain: Record<string, ProTableChainOverview>
	openInterestByChain: Record<string, ProTableChainOverview>
	datasetsByQueryKey: Record<string, DimensionDatasetProtocol[]>
	tokenUsageByQueryKey: Record<string, ProtocolTokenUsageData[]>
}

interface ProTableChainOverview {
	chain: string
	protocols: ProTableDimensionProtocol[]
}

function extractTableChains(items: DashboardItemConfig[]): { chains: string[]; chainSets: string[][] } {
	const allChains = new Set<string>()
	const chainSets: string[][] = []

	for (const item of items) {
		if (item.kind !== 'table' || item.tableType !== 'protocols') continue
		const itemChains = item.chains
		chainSets.push(itemChains)
		if (itemChains.length === 0 || itemChains.includes('All')) {
			allChains.add('All')
		} else {
			for (const chain of itemChains) allChains.add(chain)
		}
	}

	return { chains: Array.from(allChains), chainSets }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])
}

const FETCH_TIMEOUT = 10_000

const TABLE_DATASET_SPECS = [
	{ queryKeyPrefix: 'protocols-earnings-multi-chain', datasetType: 'earnings' },
	{ queryKeyPrefix: 'protocols-aggregators-multi-chain', datasetType: 'aggregators' },
	{ queryKeyPrefix: 'protocols-bridge-aggregators-multi-chain', datasetType: 'bridge-aggregators' },
	{ queryKeyPrefix: 'protocols-options-multi-chain', datasetType: 'options' }
] as const

interface TokenUsageConfig {
	tokenSymbols: string[]
	includeCex: boolean
}

function extractTokenUsageConfigs(items: DashboardItemConfig[]): TokenUsageConfig[] {
	const configs: TokenUsageConfig[] = []
	for (const item of items) {
		if (item.kind === 'table') {
			const tableItem = item as ProtocolsTableConfig
			if (tableItem.datasetType === 'token-usage' && tableItem.tokenSymbols?.length) {
				configs.push({
					tokenSymbols: normalizeProTokenSymbols(tableItem.tokenSymbols),
					includeCex: tableItem.includeCex ?? false
				})
			}
		}
	}
	return configs
}

async function fetchTokenUsageData(tokenSymbols: string[], includeCex: boolean): Promise<ProtocolTokenUsageData[]> {
	const promises = tokenSymbols.map(async (symbol) => {
		const data = await fetchProtocolsByToken(symbol)
		return { symbol, data }
	})

	return aggregateProtocolTokenUsage(await Promise.all(promises), includeCex)
}

export interface TableServerDataSourcePlan {
	chainsToFetch: string[]
	datasetSources: Array<{
		cacheKey: string
		datasetType: (typeof TABLE_DATASET_SPECS)[number]['datasetType']
		chains: string[]
	}>
	tokenUsageConfigs: Array<TokenUsageConfig & { cacheKey: string }>
}

export function buildTableServerDataSourcePlan(items: DashboardItemConfig[]): TableServerDataSourcePlan {
	const { chains, chainSets } = extractTableChains(items)
	const uniqueChainSets = new Map<string, string[]>()
	for (const chainSet of chainSets) {
		let key = 'All'
		if (chainSet.length > 0 && !chainSet.includes('All')) {
			key = chainSet.length === 1 ? chainSet[0] : chainSet.toSorted().join(',')
		}
		if (!uniqueChainSets.has(key)) uniqueChainSets.set(key, chainSet)
	}

	const datasetSources: TableServerDataSourcePlan['datasetSources'] = []
	for (const chainSet of uniqueChainSets.values()) {
		for (const config of TABLE_DATASET_SPECS) {
			datasetSources.push({
				cacheKey: JSON.stringify(getProLegacyTableDatasetQueryKey(config.queryKeyPrefix, chainSet)),
				datasetType: config.datasetType,
				chains: chainSet
			})
		}
	}

	const tokenUsageConfigs = new Map<string, TokenUsageConfig & { cacheKey: string }>()
	for (const config of extractTokenUsageConfigs(items)) {
		const cacheKey = JSON.stringify(getProTokenUsageQueryKey(config.tokenSymbols, config.includeCex))
		if (!tokenUsageConfigs.has(cacheKey)) tokenUsageConfigs.set(cacheKey, { ...config, cacheKey })
	}

	return {
		chainsToFetch: chains,
		datasetSources,
		tokenUsageConfigs: Array.from(tokenUsageConfigs.values())
	}
}

export async function fetchTableServerData(
	items: DashboardItemConfig[],
	claimSource: (kind: string, key: readonly unknown[]) => boolean = () => true
): Promise<TableServerData | null> {
	const plan = buildTableServerDataSourcePlan(items)
	const fetchProtocolsList = plan.chainsToFetch.length > 0 && claimSource('table-protocols-list', [])
	const chainsToFetch = plan.chainsToFetch.filter((chain) => claimSource('table-chain-overview', [chain]))
	const datasetSources = plan.datasetSources.filter((source) => claimSource('table-dataset', [source.cacheKey]))
	const tokenUsageConfigs = plan.tokenUsageConfigs.filter((source) =>
		claimSource('table-token-usage', [source.cacheKey])
	)
	if (
		!fetchProtocolsList &&
		chainsToFetch.length === 0 &&
		datasetSources.length === 0 &&
		tokenUsageConfigs.length === 0
	) {
		return null
	}

	const tableData: TableServerData = {
		protocolsList: null,
		volumeByChain: {},
		feesByChain: {},
		perpsByChain: {},
		openInterestByChain: {},
		datasetsByQueryKey: {},
		tokenUsageByQueryKey: {}
	}

	if (fetchProtocolsList || chainsToFetch.length > 0 || datasetSources.length > 0) {
		const results = await Promise.allSettled([
			fetchProtocolsList ? withTimeout(fetchProtocols(), FETCH_TIMEOUT) : Promise.resolve(null),
			...chainsToFetch.flatMap((chain) => [
				withTimeout(
					getDexVolumeByChain({ chain, excludeTotalDataChart: false, excludeTotalDataChartBreakdown: true }).then(
						(data) => ({ type: 'volume' as const, chain, data: { chain, protocols: data?.protocols ?? [] } })
					),
					FETCH_TIMEOUT
				),
				withTimeout(
					getFeesAndRevenueProtocolsByChain({ chain }).then((data) => ({
						type: 'fees' as const,
						chain,
						data: { chain, protocols: data ?? [] }
					})),
					FETCH_TIMEOUT
				),
				withTimeout(
					getPerpsVolumeByChain({ chain, excludeTotalDataChart: false, excludeTotalDataChartBreakdown: true }).then(
						(data) => ({ type: 'perps' as const, chain, data: { chain, protocols: data?.protocols ?? [] } })
					),
					FETCH_TIMEOUT
				),
				withTimeout(
					getOpenInterestByChain({ chain }).then((data) => ({
						type: 'openInterest' as const,
						chain,
						data: { chain, protocols: data?.protocols ?? [] }
					})),
					FETCH_TIMEOUT
				)
			])
		])

		const [protocolsResult, ...overviewResults] = results

		if (protocolsResult.status === 'fulfilled' && protocolsResult.value) {
			tableData.protocolsList = protocolsResult.value
		}

		for (const result of overviewResults) {
			if (result.status !== 'fulfilled') continue
			const { type, chain, data } = result.value
			switch (type) {
				case 'volume':
					tableData.volumeByChain[chain] = data
					break
				case 'fees':
					tableData.feesByChain[chain] = data
					break
				case 'perps':
					tableData.perpsByChain[chain] = data
					break
				case 'openInterest':
					tableData.openInterestByChain[chain] = data
					break
			}
		}

		const datasetFetches: Promise<{ cacheKey: string; data: DimensionDatasetProtocol[] }>[] = []
		for (const source of datasetSources) {
			const spec = DIMENSION_DATASET_SPEC_BY_TYPE[source.datasetType]
			datasetFetches.push(
				withTimeout(fetchProDimensionDataset(spec, source.chains), FETCH_TIMEOUT * 3).then((data) => ({
					cacheKey: source.cacheKey,
					data
				}))
			)
		}

		const datasetResults = await Promise.allSettled(datasetFetches)
		for (const result of datasetResults) {
			if (result.status !== 'fulfilled') continue
			tableData.datasetsByQueryKey[result.value.cacheKey] = result.value.data
		}
	}

	if (tokenUsageConfigs.length > 0) {
		const tokenUsageFetches: Promise<{ cacheKey: string; data: ProtocolTokenUsageData[] }>[] = []
		for (const config of tokenUsageConfigs) {
			tokenUsageFetches.push(
				withTimeout(fetchTokenUsageData(config.tokenSymbols, config.includeCex), FETCH_TIMEOUT).then((data) => ({
					cacheKey: config.cacheKey,
					data
				}))
			)
		}

		const tokenUsageResults = await Promise.allSettled(tokenUsageFetches)
		for (const result of tokenUsageResults) {
			if (result.status !== 'fulfilled') continue
			tableData.tokenUsageByQueryKey[result.value.cacheKey] = result.value.data
		}
	}

	return tableData
}
