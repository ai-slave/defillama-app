import type {
	IEquitiesCompanyApiItem,
	IEquitiesFilingApiItem,
	IEquitiesStatementsResponse
} from '~/containers/Equities/api.types'
import type { StablecoinsChartCacheValue } from '~/containers/ProDashboard/stablecoinData'
import type {
	IFetchedRWAProject,
	IRWAAssetData,
	IRWAStatsResponse,
	RWAChartMetricKey,
	RWAOverviewBreakdownRequest
} from '~/containers/RWA/api.types'
import type { RWAPositionalChartDataset } from '~/containers/RWA/chartDataset'
import type { StablecoinDetailResponse, StablecoinsListResponse } from '~/containers/Stablecoins/api.types'
import type { BorrowMarketHistory, PoolHistory } from '~/containers/Yields/poolDetail/types'
import type { ProDashboardChartRequest } from './dataContracts'

interface ProDashboardProxyContract {
	chart: { params: { chart: ProDashboardChartRequest }; response: Array<[number, number]> }
	stablecoins: { params: { chain: string }; response: StablecoinsChartCacheValue }
	yields: { params: { poolConfigId: string }; response: PoolHistory }
	yieldsLendBorrow: { params: { poolConfigId: string }; response: BorrowMarketHistory }
	rwaBreakdown: {
		params: {
			breakdown: RWAOverviewBreakdownRequest['breakdown']
			metric: RWAChartMetricKey
			chain?: string
		}
		response: RWAPositionalChartDataset | null
	}
	rwaAssetChart: { params: { assetId: string }; response: IRWAAssetData['chartDataset'] }
	rwaAssetsList: { params: Record<string, never>; response: Array<IFetchedRWAProject> }
	rwaStats: { params: Record<string, never>; response: IRWAStatsResponse }
	equitiesCompanies: { params: Record<string, never>; response: Array<IEquitiesCompanyApiItem> }
	equitiesStatements: { params: { ticker: string; country: string }; response: IEquitiesStatementsResponse }
	equitiesFilings: { params: { ticker: string; country: string }; response: Array<IEquitiesFilingApiItem> }
	stablecoinsList: { params: Record<string, never>; response: StablecoinsListResponse }
	stablecoinAsset: { params: { slug: string }; response: StablecoinDetailResponse | null }
}

export type ProDashboardProxyType = keyof ProDashboardProxyContract
export type ProDashboardProxyParams<TType extends ProDashboardProxyType> = ProDashboardProxyContract[TType]['params']
export type ProDashboardProxyResponse<TType extends ProDashboardProxyType> =
	ProDashboardProxyContract[TType]['response']
export type ProDashboardProxyResponseValue = ProDashboardProxyContract[ProDashboardProxyType]['response']
export type ProDashboardProxyRequest = {
	[TType in ProDashboardProxyType]: { type: TType; params: ProDashboardProxyParams<TType> }
}[ProDashboardProxyType]
