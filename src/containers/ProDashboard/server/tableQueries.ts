import {
	DIMENSION_DATASET_SPEC_BY_TYPE,
	type DimensionDatasetResult
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
import { resolveProtocolTableConfigSourcePlan, type ProtocolTableMetricSource } from '../protocolTableSourcePlan'
import { getProLegacyTableDatasetQueryKey, getProTokenUsageQueryKey, normalizeProTokenSymbols } from '../tableQueryKeys'
import type { DashboardItemConfig, ProtocolsTableConfig } from '../types'
import { fetchProDimensionDataset } from './dimensionDataset'

export interface TableServerData {
	protocolsList: ProtocolsResponse | null
	volumeByChain: Record<string, ProTableChainOverview>
	feesByChain: Record<string, ProTableChainOverview>
	perpsByChain: Record<string, ProTableChainOverview>
	openInterestByChain: Record<string, ProTableChainOverview>
	datasetsByQueryKey: Record<string, DimensionDatasetResult>
	tokenUsageByQueryKey: Record<string, ProtocolTokenUsageData[]>
}

interface ProTableChainOverview {
	chain: string
	protocols: ProTableDimensionProtocol[]
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
	hasProtocolsTable: boolean
	chainSources: Array<{
		source: Extract<ProtocolTableMetricSource, 'volume' | 'fees' | 'perps' | 'openInterest'>
		chain: string
	}>
	datasetSources: Array<{
		cacheKey: string
		datasetType: (typeof TABLE_DATASET_SPECS)[number]['datasetType']
		chains: string[]
	}>
	tokenUsageConfigs: Array<TokenUsageConfig & { cacheKey: string }>
}

export function buildTableServerDataSourcePlan(items: DashboardItemConfig[]): TableServerDataSourcePlan {
	let hasProtocolsTable = false
	const chainSources = new Map<string, TableServerDataSourcePlan['chainSources'][number]>()
	const datasetSources: TableServerDataSourcePlan['datasetSources'] = []
	const datasetSourceKeys = new Set<string>()
	for (const item of items) {
		if (item.kind !== 'table' || item.tableType !== 'protocols') continue
		hasProtocolsTable = true
		const sourcePlan = resolveProtocolTableConfigSourcePlan(item)
		const chains = item.chains.length === 0 || item.chains.includes('All') ? ['All'] : item.chains

		for (const source of ['volume', 'fees', 'perps', 'openInterest'] as const) {
			if (!sourcePlan.enabled[source]) continue
			for (const chain of chains) chainSources.set(`${source}:${chain}`, { source, chain })
		}

		for (const config of TABLE_DATASET_SPECS) {
			const source = config.datasetType === 'bridge-aggregators' ? 'bridgeAggregators' : config.datasetType
			if (!sourcePlan.enabled[source]) continue
			const cacheKey = JSON.stringify(getProLegacyTableDatasetQueryKey(config.queryKeyPrefix, item.chains))
			if (datasetSourceKeys.has(cacheKey)) continue
			datasetSourceKeys.add(cacheKey)
			datasetSources.push({
				cacheKey,
				datasetType: config.datasetType,
				chains: item.chains
			})
		}
	}

	const tokenUsageConfigs = new Map<string, TokenUsageConfig & { cacheKey: string }>()
	for (const config of extractTokenUsageConfigs(items)) {
		const cacheKey = JSON.stringify(getProTokenUsageQueryKey(config.tokenSymbols, config.includeCex))
		if (!tokenUsageConfigs.has(cacheKey)) tokenUsageConfigs.set(cacheKey, { ...config, cacheKey })
	}

	return {
		hasProtocolsTable,
		chainSources: Array.from(chainSources.values()),
		datasetSources,
		tokenUsageConfigs: Array.from(tokenUsageConfigs.values())
	}
}

export async function fetchTableServerData(
	items: DashboardItemConfig[],
	claimSource: (kind: string, key: readonly unknown[]) => boolean = () => true,
	onData?: (data: TableServerData) => void,
	getProtocolsList: () => Promise<ProtocolsResponse> = fetchProtocols
): Promise<TableServerData | null> {
	const plan = buildTableServerDataSourcePlan(items)
	const fetchProtocolsList = plan.hasProtocolsTable && claimSource('table-protocols-list', [])
	const chainSources = plan.chainSources.filter(({ source, chain }) =>
		claimSource('table-chain-overview', [source, chain])
	)
	const datasetSources = plan.datasetSources.filter((source) => claimSource('table-dataset', [source.cacheKey]))
	const tokenUsageConfigs = plan.tokenUsageConfigs.filter((source) =>
		claimSource('table-token-usage', [source.cacheKey])
	)
	if (
		!fetchProtocolsList &&
		chainSources.length === 0 &&
		datasetSources.length === 0 &&
		tokenUsageConfigs.length === 0
	) {
		return null
	}

	const createTableData = (): TableServerData => ({
		protocolsList: null,
		volumeByChain: {},
		feesByChain: {},
		perpsByChain: {},
		openInterestByChain: {},
		datasetsByQueryKey: {},
		tokenUsageByQueryKey: {}
	})
	const tasks: Array<Promise<TableServerData>> = []

	if (fetchProtocolsList) {
		tasks.push(
			withTimeout(getProtocolsList(), FETCH_TIMEOUT).then((protocolsList) => ({
				...createTableData(),
				protocolsList
			}))
		)
	}

	for (const { source, chain } of chainSources) {
		switch (source) {
			case 'volume':
				tasks.push(
					withTimeout(
						getDexVolumeByChain({ chain, excludeTotalDataChart: false, excludeTotalDataChartBreakdown: true }),
						FETCH_TIMEOUT
					).then((data) => ({
						...createTableData(),
						volumeByChain: { [chain]: { chain, protocols: data?.protocols ?? [] } }
					}))
				)
				break
			case 'fees':
				tasks.push(
					withTimeout(getFeesAndRevenueProtocolsByChain({ chain }), FETCH_TIMEOUT).then((data) => ({
						...createTableData(),
						feesByChain: { [chain]: { chain, protocols: data ?? [] } }
					}))
				)
				break
			case 'perps':
				tasks.push(
					withTimeout(
						getPerpsVolumeByChain({ chain, excludeTotalDataChart: false, excludeTotalDataChartBreakdown: true }),
						FETCH_TIMEOUT
					).then((data) => ({
						...createTableData(),
						perpsByChain: { [chain]: { chain, protocols: data?.protocols ?? [] } }
					}))
				)
				break
			case 'openInterest':
				tasks.push(
					withTimeout(getOpenInterestByChain({ chain }), FETCH_TIMEOUT).then((data) => ({
						...createTableData(),
						openInterestByChain: { [chain]: { chain, protocols: data?.protocols ?? [] } }
					}))
				)
				break
		}
	}

	for (const source of datasetSources) {
		const spec = DIMENSION_DATASET_SPEC_BY_TYPE[source.datasetType]
		if (!spec) throw new Error(`Missing dimension dataset spec: ${source.datasetType}`)
		tasks.push(
			withTimeout(fetchProDimensionDataset(spec, source.chains), FETCH_TIMEOUT * 3).then((data) => ({
				...createTableData(),
				datasetsByQueryKey: { [source.cacheKey]: data }
			}))
		)
	}

	for (const config of tokenUsageConfigs) {
		tasks.push(
			withTimeout(fetchTokenUsageData(config.tokenSymbols, config.includeCex), FETCH_TIMEOUT).then((data) => ({
				...createTableData(),
				tokenUsageByQueryKey: { [config.cacheKey]: data }
			}))
		)
	}

	const results = await Promise.allSettled(
		tasks.map(async (task) => {
			const data = await task
			onData?.(data)
			return data
		})
	)
	const tableData = createTableData()
	for (const result of results) {
		if (result.status !== 'fulfilled') continue
		const data = result.value
		if (data.protocolsList) tableData.protocolsList = data.protocolsList
		Object.assign(tableData.volumeByChain, data.volumeByChain)
		Object.assign(tableData.feesByChain, data.feesByChain)
		Object.assign(tableData.perpsByChain, data.perpsByChain)
		Object.assign(tableData.openInterestByChain, data.openInterestByChain)
		Object.assign(tableData.datasetsByQueryKey, data.datasetsByQueryKey)
		Object.assign(tableData.tokenUsageByQueryKey, data.tokenUsageByQueryKey)
	}

	return tableData
}
