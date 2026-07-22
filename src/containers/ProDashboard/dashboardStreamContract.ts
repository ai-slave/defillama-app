import type {
	IEquitiesCompanyApiItem,
	IEquitiesFilingApiItem,
	IEquitiesStatementsResponse
} from '~/containers/Equities/api.types'
import type {
	IProtocolChainBreakdownChart,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart
} from '~/containers/ProtocolOverview/api.types'
import type {
	IFetchedRWAProject,
	IRWAAssetData,
	IRWAStatsResponse,
	RWAChartMetricKey,
	RWAOverviewBreakdownRequest
} from '~/containers/RWA/api.types'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { Dashboard } from './dashboardTypes'
import type { ProDashboardAppMetadata } from './dataContracts'
import type { ProDashboardProtocolCatalog } from './protocolCatalog'
import type { StablecoinsChartCacheValue } from './server/stablecoinFetchers'
import type { TableServerData } from './server/tableQueries'

export type DashboardQueryKey = readonly unknown[]
export type DashboardChartPoint = [number, number]
export type ProtocolTvlChartData = IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart

type SerializedCacheChunkType =
	| 'dimensionDatasetData'
	| 'incomeStatementData'
	| 'chartBuilderData'
	| 'cexAnalyticsData'
	| 'chainsDatasetData'
	| 'yieldsDatasetData'
	| 'stablecoinsTableData'
	| 'stablecoinAssetData'

export type DashboardStreamChunk =
	| { type: 'dashboard'; data: Dashboard | null }
	| { type: 'protocolsAndChains'; data: ProDashboardProtocolCatalog | null }
	| { type: 'appMetadata'; data: ProDashboardAppMetadata | null }
	| { type: 'chartData'; queryKey: DashboardQueryKey; data: DashboardChartPoint[] }
	| { type: 'tableData'; data: TableServerData }
	| {
			type: 'yieldsChartData'
			id: string
			data: { supply?: PoolHistory | null; borrow?: BorrowMarketHistory | null }
	  }
	| { type: 'protocolTvlChartData'; queryKey: DashboardQueryKey; data: ProtocolTvlChartData }
	| { type: 'unifiedTableData'; key: string; data: unknown }
	| { type: 'stablecoinsChartData'; chain: string; data: StablecoinsChartCacheValue }
	| {
			type: 'rwaBreakdownData'
			breakdown: RWAOverviewBreakdownRequest['breakdown']
			metric: RWAChartMetricKey
			chain: string
			data: RWAPositionalChartDataset
	  }
	| { type: 'rwaAssetChartData'; id: string; data: IRWAAssetData['chartDataset'] }
	| { type: 'rwaAssetsTableData'; data: IFetchedRWAProject[] }
	| { type: 'rwaChainsTableData'; data: IRWAStatsResponse }
	| { type: 'rwaChainAssetsTableData'; chain: string; data: IFetchedRWAProject[] }
	| { type: 'equitiesCompaniesData'; data: IEquitiesCompanyApiItem[] }
	| { type: 'equitiesStatementsData'; ticker: string; data: IEquitiesStatementsResponse }
	| { type: 'equitiesFilingsData'; ticker: string; data: IEquitiesFilingApiItem[] }
	| { type: 'emissionData'; key: string; data: unknown }
	| { type: SerializedCacheChunkType; key: string; data: unknown }
	| { type: 'done' }
