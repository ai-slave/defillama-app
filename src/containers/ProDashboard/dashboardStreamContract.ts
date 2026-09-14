import type {
	CexAnalyticsMarketSharePoint,
	CexAnalyticsSnapshotResponse,
	CexAnalyticsTotalsPoint
} from '~/containers/Cexs/api.types'
import type { ChainsDatasetRow } from '~/containers/ChainsByCategory/types'
import type {
	IEquitiesCompanyApiItem,
	IEquitiesFilingApiItem,
	IEquitiesStatementsResponse
} from '~/containers/Equities/api.types'
import type {
	StablecoinAssetCacheValue,
	StablecoinsChartCacheValue,
	StablecoinsTableData
} from '~/containers/ProDashboard/stablecoinData'
import type { ProYieldRow } from '~/containers/ProDashboard/yieldData'
import type {
	IProtocolChainBreakdownChart,
	IProtocolTokenBreakdownChart,
	IProtocolValueChart
} from '~/containers/ProtocolOverview/api.types'
import type { getProtocolIncomeStatement } from '~/containers/ProtocolOverview/queries'
import type {
	IFetchedRWAProject,
	IRWAAssetData,
	IRWAStatsResponse,
	RWAChartMetricKey,
	RWAOverviewBreakdownRequest
} from '~/containers/RWA/api.types'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import type { getProtocolEmissionsPieData, getProtocolEmissionsScheduleData } from '~/containers/Unlocks/queries'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { Dashboard } from './dashboardTypes'
import type { ChartBuilderSeriesData, ProDashboardAppMetadata } from './dataContracts'
import type { ProDashboardProtocolCatalog } from './protocolCatalog'
import type { TokenUsageStreamData } from './tokenUsageSourcePlan'
import type { ProtocolsUnifiedTableResponse } from './unifiedTable/contracts'

export const INITIAL_DASHBOARD_STREAM_ITEM_COUNT = 8

export type DashboardQueryKey = ReadonlyArray<unknown>
export type DashboardChartPoint = [number, number]
export type ProtocolTvlChartData = IProtocolValueChart | IProtocolChainBreakdownChart | IProtocolTokenBreakdownChart
type ProtocolIncomeStatementData = NonNullable<Awaited<ReturnType<typeof getProtocolIncomeStatement>>>
type EmissionsPieData = Awaited<ReturnType<typeof getProtocolEmissionsPieData>>
type EmissionsScheduleData = Awaited<ReturnType<typeof getProtocolEmissionsScheduleData>>

type CexAnalyticsStreamChunk =
	| { type: 'cexAnalyticsData'; view: 'snapshot'; key: string; data: CexAnalyticsSnapshotResponse }
	| { type: 'cexAnalyticsData'; view: 'totals'; key: string; data: Array<CexAnalyticsTotalsPoint> }
	| { type: 'cexAnalyticsData'; view: 'market-share'; key: string; data: Array<CexAnalyticsMarketSharePoint> }

type EmissionStreamChunk =
	| { type: 'emissionData'; view: 'pie'; key: string; data: EmissionsPieData }
	| { type: 'emissionData'; view: 'schedule'; key: string; data: EmissionsScheduleData }

export type DashboardStreamChunk =
	| { type: 'dashboard'; data: Dashboard | null }
	| { type: 'protocolsAndChains'; data: ProDashboardProtocolCatalog | null }
	| { type: 'appMetadata'; data: ProDashboardAppMetadata | null }
	| { type: 'chartData'; queryKey: DashboardQueryKey; data: Array<DashboardChartPoint> }
	| ({ type: 'tokenUsageData' } & TokenUsageStreamData)
	| {
			type: 'yieldsChartData'
			id: string
			data: { supply?: PoolHistory | null; borrow?: BorrowMarketHistory | null }
	  }
	| { type: 'protocolTvlChartData'; queryKey: DashboardQueryKey; data: ProtocolTvlChartData }
	| { type: 'unifiedTableData'; key: string; data: ProtocolsUnifiedTableResponse }
	| { type: 'stablecoinsChartData'; chain: string; data: StablecoinsChartCacheValue }
	| {
			type: 'rwaBreakdownData'
			breakdown: RWAOverviewBreakdownRequest['breakdown']
			metric: RWAChartMetricKey
			chain: string
			data: RWAPositionalChartDataset
	  }
	| { type: 'rwaAssetChartData'; id: string; data: IRWAAssetData['chartDataset'] }
	| { type: 'rwaAssetsTableData'; data: Array<IFetchedRWAProject> }
	| { type: 'rwaChainsTableData'; data: IRWAStatsResponse }
	| { type: 'equitiesCompaniesData'; data: Array<IEquitiesCompanyApiItem> }
	| { type: 'equitiesStatementsData'; ticker: string; data: IEquitiesStatementsResponse }
	| { type: 'equitiesFilingsData'; ticker: string; data: Array<IEquitiesFilingApiItem> }
	| EmissionStreamChunk
	| { type: 'chartBuilderData'; key: string; data: ChartBuilderSeriesData }
	| { type: 'incomeStatementData'; key: string; data: ProtocolIncomeStatementData }
	| CexAnalyticsStreamChunk
	| { type: 'chainsDatasetData'; key: string; data: Array<ChainsDatasetRow> }
	| { type: 'yieldsDatasetData'; key: string; data: Array<ProYieldRow> }
	| { type: 'stablecoinsTableData'; key: string; data: StablecoinsTableData }
	| { type: 'stablecoinAssetData'; key: string; data: StablecoinAssetCacheValue }
	| { type: 'itemReady'; itemIds: Array<string> }
	| { type: 'done' }
