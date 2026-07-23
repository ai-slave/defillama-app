import dayjs from 'dayjs'
import { fetchLiquidityTokensDataset, fetchProtocolTokenLiquidityChart } from '~/api'
import { fetchCoinGeckoChartByIdWithCacheFallback } from '~/api/coingecko'
import { fetchAdapterProtocolChartData } from '~/containers/AdapterMetrics/api'
import { ADAPTER_DATA_TYPES, ADAPTER_TYPES } from '~/containers/AdapterMetrics/constants'
import { fetchProtocolTvlChart, fetchProtocolTreasuryChart } from '~/containers/ProtocolOverview/api'
import type { IProtocolValueChart } from '~/containers/ProtocolOverview/api.types'
import { fetchProtocolEmission } from '~/containers/Unlocks/api'
import { getProtocolEmissionsCharts } from '~/containers/Unlocks/queries'
import { getYieldsHistoryUrl } from '~/containers/Yields/constants'
import { slug } from '~/utils'
import { fetchWithPoolingOnServer } from '~/utils/http-client'
import { recordRuntimeError } from '~/utils/telemetry'
import { convertToNumberFormat, normalizeHourlyToDaily } from '../utils'

interface MedianApyHistoryResponse {
	data: Array<{ date: string; median_apy: number }>
}

function toProChartSeconds(data: IProtocolValueChart | null): [number, number][] {
	if (!data) return []
	const points = new Array<[number, number]>(data.length)
	// Protocol V2 charts are canonical milliseconds; Pro's tuple pipeline is seconds.
	for (let index = 0; index < data.length; index++) {
		points[index] = [Math.floor(data[index][0] / 1e3), data[index][1]]
	}
	return points
}

const LIQUIDITY_TOKENS_TTL_MS = 10 * 60 * 1000
let liquidityTokensCache: { data: Awaited<ReturnType<typeof fetchLiquidityTokensDataset>>; ts: number } | null = null
let liquidityTokensPromise: Promise<Awaited<ReturnType<typeof fetchLiquidityTokensDataset>>> | null = null

async function getCachedLiquidityTokens() {
	if (liquidityTokensCache && Date.now() - liquidityTokensCache.ts < LIQUIDITY_TOKENS_TTL_MS) {
		return liquidityTokensCache.data
	}
	if (liquidityTokensPromise != null) {
		return liquidityTokensPromise
	}
	liquidityTokensPromise = fetchLiquidityTokensDataset()
		.then((data) => {
			liquidityTokensCache = { data, ts: Date.now() }
			return data
		})
		.finally(() => {
			liquidityTokensPromise = null
		})
	return liquidityTokensPromise
}

export default class ProtocolCharts {
	static async tvl(protocolId: string): Promise<[number, number][]> {
		if (!protocolId) return []
		try {
			return toProChartSeconds(await fetchProtocolTvlChart({ protocol: protocolId }))
		} catch (error) {
			recordRuntimeError(error, 'pageBuild')
			return []
		}
	}
	static async summary(
		protocol: string,
		type: `${ADAPTER_TYPES}`,
		dataType?: `${ADAPTER_DATA_TYPES}`
	): Promise<[number, number][]> {
		if (!protocol) return []
		const data = await fetchAdapterProtocolChartData({
			adapterType: type,
			protocol,
			dataType
		})
		return convertToNumberFormat(data ?? [])
	}

	static async volume(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'dexs')
	}

	static async incentives(protocol: string): Promise<[number, number][]> {
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

	static async unlocks(
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

	static async fees(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'fees', 'dailyFees')
	}

	static async revenue(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'fees', 'dailyRevenue')
	}

	static async holdersRevenue(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'fees', 'dailyHoldersRevenue')
	}

	static async perps(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'derivatives')
	}

	static async openInterest(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'open-interest', 'openInterestAtEnd')
	}

	static async aggregators(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'aggregators')
	}

	static async perpsAggregators(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'aggregator-derivatives')
	}

	static async bridgeAggregators(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'bridge-aggregators')
	}

	static async optionsPremium(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'options', 'dailyPremiumVolume')
	}

	static async optionsNotional(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, 'options', 'dailyNotionalVolume')
	}

	static async activeUsers(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, ADAPTER_TYPES.ACTIVE_USERS)
	}

	static async newUsers(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, ADAPTER_TYPES.NEW_USERS)
	}

	static async txs(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, ADAPTER_TYPES.ACTIVE_USERS, ADAPTER_DATA_TYPES.DAILY_TRANSACTIONS_COUNT)
	}

	static async gasUsed(protocol: string): Promise<[number, number][]> {
		return this.summary(protocol, ADAPTER_TYPES.ACTIVE_USERS, ADAPTER_DATA_TYPES.DAILY_GAS_USED)
	}

	static async getTokenData(geckoId: string) {
		if (!geckoId) return { mcaps: [], prices: [], volumes: [] }

		const result = await fetchCoinGeckoChartByIdWithCacheFallback(geckoId, { fullChart: true })
		return result?.data ?? { mcaps: [], prices: [], volumes: [] }
	}

	static async tokenMcap(_: string, geckoId: string): Promise<[number, number][]> {
		const data = await this.getTokenData(geckoId)
		const converted = convertToNumberFormat(data.mcaps ?? [], true)
		return normalizeHourlyToDaily(converted, 'last')
	}

	static async tokenPrice(_: string, geckoId: string): Promise<[number, number][]> {
		const data = await this.getTokenData(geckoId)
		const converted = convertToNumberFormat(data.prices ?? [], true)
		return normalizeHourlyToDaily(converted, 'last')
	}

	static async tokenVolume(_: string, geckoId: string): Promise<[number, number][]> {
		const data = await this.getTokenData(geckoId)
		const converted = convertToNumberFormat(data.volumes ?? [], true)
		return normalizeHourlyToDaily(converted, 'sum')
	}

	static async liquidity(protocol: string, symbol?: string | null): Promise<[number, number][]> {
		if (!protocol || !symbol) return []
		try {
			const tokens = await getCachedLiquidityTokens()
			const normalizedSymbol = symbol.toUpperCase()
			const entry = tokens.find((token) => token.symbol?.toUpperCase() === normalizedSymbol)
			const tokenId = entry?.id
			if (!tokenId) return []

			const hist = await fetchProtocolTokenLiquidityChart(String(tokenId))
			if (!hist) return []
			const points = new Array<[number, number]>(hist.length)
			for (let index = 0; index < hist.length; index++) {
				points[index] = [Number(hist[index][0]), hist[index][1]]
			}
			return points
		} catch (e) {
			recordRuntimeError(e, 'pageBuild')
			return []
		}
	}

	static async treasury(protocol: string): Promise<[number, number][]> {
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

	static async medianApy(protocol: string): Promise<[number, number][]> {
		const response = await fetchWithPoolingOnServer(
			getYieldsHistoryUrl(`/v2/protocol-median/${encodeURIComponent(protocol)}/history`)
		)
		const { data } = (await response.json()) as MedianApyHistoryResponse
		const res: [number, number][] = []
		for (const item of data) {
			res.push([dayjs(item.date).unix(), item.median_apy])
		}
		return res
	}

	static async borrowed(protocol: string): Promise<[number, number][]> {
		if (!protocol) return []
		try {
			return toProChartSeconds(await fetchProtocolTvlChart({ protocol, key: 'borrowed' }))
		} catch (e) {
			recordRuntimeError(e, 'pageBuild')
			return []
		}
	}

	static async pfRatio(protocol: string): Promise<[number, number][]> {
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

	static async psRatio(protocol: string): Promise<[number, number][]> {
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
}
