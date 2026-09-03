import dayjs from 'dayjs'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchProtocolTvlChart, fetchProtocolTreasuryChart } from '~/containers/ProtocolOverview/api'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import { fetchProtocolEmission } from '~/containers/Unlocks/api'
import { getProtocolEmissionsCharts } from '~/containers/Unlocks/queries'
import { fetchProtocolMedianHistory } from '~/containers/Yields/protocolMedian'
import { slug } from '~/utils'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRuntimeError } from '~/utils/telemetry'
import { normalizeUnlocksDataType } from '../chartSource'
import { isProDashboardChartType } from '../types'
import { convertToNumberFormat, normalizeHourlyToDaily } from '../utils'

export interface ProtocolChartDataOptions {
	geckoId?: string | null
	dataType?: string
	fetchRatio?: (protocol: string, type: 'pf' | 'ps') => Promise<[number, number][]>
}

function toProChartSeconds(data: IProtocolValueChart | null): [number, number][] {
	if (!data) return []
	const points: [number, number][] = []
	// Protocol V2 charts are canonical milliseconds; Pro's tuple pipeline is seconds.
	for (const [timestampMs, value] of data) {
		points.push([Math.floor(timestampMs / 1e3), value])
	}
	return points
}

async function fetchProtocolTvlData(protocolId: string): Promise<[number, number][]> {
	if (!protocolId) return []
	try {
		return toProChartSeconds(await fetchProtocolTvlChart({ protocol: protocolId }))
	} catch (error) {
		recordRuntimeError(error, 'pageBuild')
		return []
	}
}

async function fetchProtocolAdapterData(
	protocol: string,
	type: `${ADAPTER_TYPES}`,
	dataType?: `${ADAPTER_DATA_TYPES}`
): Promise<[number, number][]> {
	if (!protocol) return []
	const data = await fetchAdapterProtocolChartData({
		adapterType: type,
		protocol,
		...(dataType ? { dataType } : {})
	})
	return data
}

async function fetchProtocolIncentivesData(protocol: string): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		const emission = await fetchProtocolEmission(protocol)
		const chart = emission?.unlockUsdChart
		if (!Array.isArray(chart)) return []

		const points: [number, number][] = []
		for (const point of chart) {
			if (!Array.isArray(point) || point.length < 2) continue
			const ts = Number(point[0])
			const value = Number(point[1])
			if (!Number.isFinite(ts) || !Number.isFinite(value)) continue
			points.push([ts, value])
		}

		return points
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

async function fetchProtocolUnlocksData(
	protocol: string,
	dataType: 'documented' | 'realtime' = 'documented'
): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		const resolvedDataType = dataType === 'realtime' ? 'documented' : dataType
		const data = await getProtocolEmissionsCharts(slug(protocol))
		const chart = data?.chartData?.[resolvedDataType] ?? []
		if (!chart.length) return []
		const totals: [number, number][] = []
		for (const { timestamp, ...rest } of chart) {
			let total = 0
			for (const key in rest) total += rest[key] ?? 0
			totals.push([Math.floor(timestamp / 1e3), total])
		}
		return totals
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

async function fetchProtocolTokenData(geckoId: string) {
	const result = await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, { timeframe: 'MAX' })
	return result?.data ?? { mcaps: [], prices: [], volumes: [] }
}

async function fetchProtocolTokenMcapData(geckoId: string): Promise<[number, number][]> {
	const data = await fetchProtocolTokenData(geckoId)
	const converted = convertToNumberFormat(data.mcaps ?? [], true)
	return normalizeHourlyToDaily(converted, 'last')
}

async function fetchProtocolTokenPriceData(geckoId: string): Promise<[number, number][]> {
	const data = await fetchProtocolTokenData(geckoId)
	const converted = convertToNumberFormat(data.prices ?? [], true)
	return normalizeHourlyToDaily(converted, 'last')
}

async function fetchProtocolTokenVolumeData(geckoId: string): Promise<[number, number][]> {
	const data = await fetchProtocolTokenData(geckoId)
	const converted = convertToNumberFormat(data.volumes ?? [], true)
	return normalizeHourlyToDaily(converted, 'sum')
}

async function fetchProtocolTreasuryData(protocol: string): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		const data = await fetchProtocolTreasuryChart({ protocol: slug(protocol) })
		if (!data) return []
		return data.map(([timestampMs, value]) => [Math.floor(timestampMs / 1e3), value] as [number, number])
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

async function fetchProtocolMedianApyData(protocol: string): Promise<[number, number][]> {
	const res: [number, number][] = []
	for (const item of await fetchProtocolMedianHistory(protocol)) {
		res.push([dayjs(item.date).unix(), item.medianApy])
	}
	return res
}

async function fetchProtocolBorrowedData(protocol: string): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		return toProChartSeconds(await fetchProtocolTvlChart({ protocol, key: 'borrowed' }))
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

async function fetchProtocolPfRatioData(protocol: string): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		const res = await fetchWithPoolingOnServer(
			`/api/public/pro-dashboard/pf-ps-chart?protocol=${encodeURIComponent(protocol)}&type=pf`
		)
		if (!res.ok) return []
		return (await res.json()) as [number, number][]
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

async function fetchProtocolPsRatioData(protocol: string): Promise<[number, number][]> {
	if (!protocol) return []
	try {
		const res = await fetchWithPoolingOnServer(
			`/api/public/pro-dashboard/pf-ps-chart?protocol=${encodeURIComponent(protocol)}&type=ps`
		)
		if (!res.ok) return []
		return (await res.json()) as [number, number][]
	} catch (e) {
		recordRuntimeError(e, 'pageBuild')
		return []
	}
}

export async function fetchProProtocolChartData(
	chartType: string,
	protocol: string,
	options: ProtocolChartDataOptions = {}
): Promise<[number, number][]> {
	if (!isProDashboardChartType(chartType)) return []
	switch (chartType) {
		case 'tvl':
			return fetchProtocolTvlData(protocol)
		case 'volume':
			return fetchProtocolAdapterData(protocol, 'dexs')
		case 'fees':
			return fetchProtocolAdapterData(protocol, 'fees', 'dailyFees')
		case 'revenue':
			return fetchProtocolAdapterData(protocol, 'fees', 'dailyRevenue')
		case 'holdersRevenue':
			return fetchProtocolAdapterData(protocol, 'fees', 'dailyHoldersRevenue')
		case 'perps':
			return fetchProtocolAdapterData(protocol, 'derivatives')
		case 'openInterest':
			return fetchProtocolAdapterData(protocol, 'open-interest', 'openInterestAtEnd')
		case 'aggregators':
			return fetchProtocolAdapterData(protocol, 'aggregators')
		case 'perpsAggregators':
			return fetchProtocolAdapterData(protocol, 'aggregator-derivatives')
		case 'bridgeAggregators':
			return fetchProtocolAdapterData(protocol, 'bridge-aggregators')
		case 'optionsPremium':
			return fetchProtocolAdapterData(protocol, 'options', 'dailyPremiumVolume')
		case 'optionsNotional':
			return fetchProtocolAdapterData(protocol, 'options', 'dailyNotionalVolume')
		case 'activeUsers':
			return fetchProtocolAdapterData(protocol, ADAPTER_TYPES.ACTIVE_USERS)
		case 'newUsers':
			return fetchProtocolAdapterData(protocol, ADAPTER_TYPES.NEW_USERS)
		case 'txs':
			return fetchProtocolAdapterData(protocol, ADAPTER_TYPES.ACTIVE_USERS, ADAPTER_DATA_TYPES.DAILY_TRANSACTIONS_COUNT)
		case 'gasUsed':
			return fetchProtocolAdapterData(protocol, ADAPTER_TYPES.ACTIVE_USERS, ADAPTER_DATA_TYPES.DAILY_GAS_USED)
		case 'treasury':
			return fetchProtocolTreasuryData(protocol)
		case 'incentives':
			return fetchProtocolIncentivesData(protocol)
		case 'unlocks':
			return fetchProtocolUnlocksData(protocol, normalizeUnlocksDataType(options.dataType))
		case 'tokenMcap':
		case 'tokenPrice':
		case 'tokenVolume': {
			if (!options.geckoId) throw new Error(`Missing CoinGecko ID for ${protocol} ${chartType} chart`)
			if (chartType === 'tokenMcap') return fetchProtocolTokenMcapData(options.geckoId)
			if (chartType === 'tokenPrice') return fetchProtocolTokenPriceData(options.geckoId)
			return fetchProtocolTokenVolumeData(options.geckoId)
		}
		case 'medianApy':
			return fetchProtocolMedianApyData(protocol)
		case 'borrowed':
			return fetchProtocolBorrowedData(protocol)
		case 'pfRatio':
			return options.fetchRatio ? options.fetchRatio(protocol, 'pf') : fetchProtocolPfRatioData(protocol)
		case 'psRatio':
			return options.fetchRatio ? options.fetchRatio(protocol, 'ps') : fetchProtocolPsRatioData(protocol)
		default:
			return []
	}
}
