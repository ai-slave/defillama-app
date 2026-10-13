import { fetchCoinGeckoExchanges, fetchCoinGeckoSimplePrice } from '~/api/coingecko'
import type { MultiSeriesTimeSeriesDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { V2_SERVER_URL } from '~/constants'
import { slug } from '~/utils'
import { fetchJson } from '~/utils/async'
import type {
	AdapterChainProtocolTotalsResponse,
	IAdapterChainMetrics,
	IAdapterBreakdownChartData,
	IAdapterChart,
	IAdapterProtocolMetrics
} from './api.types'
import type { ADAPTER_TYPES, ADAPTER_DATA_TYPES } from './constants'

interface AdapterChainMetricsRequest {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	category?: string
}

async function fetchAdapterChainMetricsResponse({
	adapterType,
	chain,
	dataType,
	category
}: AdapterChainMetricsRequest): Promise<IAdapterChainMetrics> {
	const metricsUrl = new URL(
		`${V2_SERVER_URL}/metrics/${adapterType}${category ? `/category/${slug(category)}` : ''}${chain && chain !== 'All' ? `/chain/${slug(chain)}` : ''}`
	)

	if (dataType) metricsUrl.searchParams.set('dataType', dataType)

	return fetchJson<IAdapterChainMetrics>(metricsUrl.toString(), {
		timeout: 30_000,
		telemetry: {
			attributes: {
				adapter_type: adapterType,
				...(dataType ? { data_type: dataType } : null),
				chain,
				...(category ? { category } : null)
			}
		}
	})
}

/**
 * Fetch adapter metrics for a chain and data type.
 */
export async function fetchAdapterChainMetrics({
	adapterType,
	chain,
	dataType,
	category
}: AdapterChainMetricsRequest): Promise<IAdapterChainMetrics> {
	return fetchAdapterChainMetricsResponse({
		adapterType,
		chain,
		...(dataType !== undefined ? { dataType } : {}),
		...(category !== undefined ? { category } : {})
	})
}

/** Fetch the small protocol-total projection needed by chain comparison tables. */
export async function fetchAdapterChainProtocolTotals(
	options: AdapterChainMetricsRequest
): Promise<AdapterChainProtocolTotalsResponse> {
	const metrics = await fetchAdapterChainMetricsResponse(options)
	const protocols: AdapterChainProtocolTotalsResponse['protocols'] = []
	for (const protocol of metrics.protocols) {
		protocols.push({
			defillamaId: protocol.defillamaId,
			displayName: protocol.displayName,
			total24h: protocol.total24h ?? null,
			total7d: protocol.total7d ?? null,
			total30d: protocol.total30d ?? null
		})
	}
	return { protocols }
}

/**
 * Fetch adapter metrics for a protocol and data type.
 */
export async function fetchAdapterProtocolMetrics({
	adapterType,
	protocol,
	dataType
}: {
	adapterType: `${ADAPTER_TYPES}`
	protocol: string
	dataType?: `${ADAPTER_DATA_TYPES}`
}): Promise<IAdapterProtocolMetrics> {
	let metricsUrl = `${V2_SERVER_URL}/metrics/${adapterType}/protocol/${slug(protocol)}`

	if (dataType) {
		metricsUrl += `?dataType=${dataType}`
	}

	return fetchJson<IAdapterProtocolMetrics>(metricsUrl, { timeout: 30_000 })
}

/**
 * Fetch adapter chart data for a chain and data type.
 */
export async function fetchAdapterChainChartData({
	adapterType,
	chain,
	dataType,
	category
}: {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	category?: string
}): Promise<IAdapterChart> {
	let totalDataChartUrl = `${V2_SERVER_URL}/chart/${adapterType}${category ? `/category/${slug(category)}` : ''}${chain && chain !== 'All' ? `/chain/${slug(chain)}` : ''}`

	if (dataType === 'dailyEarnings') {
		// earnings do not filter by chain at fetch time
		totalDataChartUrl = `${V2_SERVER_URL}/chart/${adapterType}`
	}

	const totalDataChart = new URL(totalDataChartUrl)

	if (dataType) {
		totalDataChart.searchParams.set('dataType', dataType)
	}

	return fetchJson<IAdapterChart>(totalDataChart.toString(), {
		timeout: 30_000,
		telemetry: {
			attributes: {
				adapter_type: adapterType,
				...(dataType ? { data_type: dataType } : null),
				chain,
				...(category ? { category } : null)
			}
		}
	})
}

/**
 * Fetch adapter chart data for a single protocol.
 */
export async function fetchAdapterProtocolChartData({
	adapterType,
	protocol,
	dataType
}: {
	adapterType: `${ADAPTER_TYPES}`
	protocol: string
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
}): Promise<IAdapterChart> {
	let totalDataChartUrl = `${V2_SERVER_URL}/chart/${adapterType}/protocol/${slug(protocol)}`

	if (dataType) {
		totalDataChartUrl += `?dataType=${dataType}`
	}

	return fetchJson<IAdapterChart>(totalDataChartUrl, { timeout: 30_000 })
}

/**
 * Fetch adapter protocol chart data by breakdown type.
 */
export async function fetchAdapterProtocolChartDataByBreakdownType({
	adapterType,
	protocol,
	dataType,
	type
}: {
	adapterType: `${ADAPTER_TYPES}`
	protocol: string
	dataType?: `${ADAPTER_DATA_TYPES}` | 'dailyEarnings'
	type: 'chain' | 'version' | 'label'
}): Promise<IAdapterBreakdownChartData> {
	let totalDataChartUrl = `${V2_SERVER_URL}/chart/${adapterType}/protocol/${slug(protocol)}/${type}-breakdown`

	if (dataType) {
		totalDataChartUrl += `?dataType=${dataType}`
	}

	return fetchJson<IAdapterBreakdownChartData>(totalDataChartUrl, { timeout: 30_000 })
}

/**
 * Fetch adapter chain chart data broken down by protocol.
 */
export async function fetchAdapterChainChartDataByProtocolBreakdown({
	adapterType,
	chain,
	dataType,
	category
}: {
	adapterType: `${ADAPTER_TYPES}`
	chain: string
	dataType?: `${ADAPTER_DATA_TYPES}`
	category?: string
}): Promise<IAdapterBreakdownChartData> {
	const categorySegment = category ? `/category/${slug(category)}` : ''
	let totalDataChartUrl =
		chain && chain !== 'All'
			? `${V2_SERVER_URL}/chart/${adapterType}${categorySegment}/chain/${slug(chain)}/protocol-breakdown`
			: `${V2_SERVER_URL}/chart/${adapterType}${categorySegment}/protocol-breakdown`

	if (dataType) {
		totalDataChartUrl += `?dataType=${dataType}`
	}

	return fetchJson<IAdapterBreakdownChartData>(totalDataChartUrl, { timeout: 30_000 })
}

/** Fetch the complete chain breakdown for an adapter metric, optionally narrowed to one category. */
export async function fetchAdapterChainChartDataByChainBreakdown({
	adapterType,
	dataType,
	category
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType?: `${ADAPTER_DATA_TYPES}`
	category?: string
}): Promise<IAdapterBreakdownChartData> {
	const totalDataChartUrl = new URL(
		`${V2_SERVER_URL}/chart/${adapterType}${category ? `/category/${slug(category)}` : ''}/chain-breakdown`
	)
	if (dataType) totalDataChartUrl.searchParams.set('dataType', dataType)
	return fetchJson<IAdapterBreakdownChartData>(totalDataChartUrl.toString(), { timeout: 30_000 })
}

export async function fetchChainsByAdapterPageChartData({
	adapterType,
	dataType
}: {
	adapterType: `${ADAPTER_TYPES}`
	dataType: `${ADAPTER_DATA_TYPES}`
}): Promise<MultiSeriesTimeSeriesDataset> {
	const searchParams = new URLSearchParams({ adapterType, dataType })
	return fetchJson<MultiSeriesTimeSeriesDataset>(
		`/api/public/page-data/dimension-adapters/chains-chart?${searchParams.toString()}&cachebust=091626`
	)
}

/**
 * Fetch estimated global CEX volume from CoinGecko exchange data.
 */
export async function fetchCexVolume(): Promise<number | null> {
	try {
		const [cexs, btcPriceRes] = await Promise.all([
			fetchCoinGeckoExchanges({ perPage: 250 }),
			fetchCoinGeckoSimplePrice({ ids: 'bitcoin', vsCurrencies: 'usd' })
		])

		const btcPrice = btcPriceRes?.bitcoin?.usd
		if (btcPrice == null) return null

		let totalVolumeBtc = 0
		let validCexCount = 0
		for (const cex of cexs) {
			const trustScore = cex?.trust_score
			const volumeBtc = cex?.trade_volume_24h_btc
			if (trustScore == null || trustScore < 9 || volumeBtc == null) continue
			totalVolumeBtc += volumeBtc
			validCexCount++
		}

		return validCexCount === 0 ? null : totalVolumeBtc * btcPrice
	} catch (error) {
		console.error('Error fetching CEX volume:', error)
		return null
	}
}
