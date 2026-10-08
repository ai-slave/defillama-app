import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import { ASSET_BRAND_COLORS, CHART_COLORS, chartColor, oldBlue } from '~/constants/colors'
import { getDominancePercent } from '~/utils'
import { fetchDATInstitutions, fetchDATInstitutionDetail, toUnixMsTimestamp } from './api'
import type { IDATInstitutionsResponse } from './api.types'
import type {
	IDATOverviewPageProps,
	IDATInstitutionOverview,
	IDATOverviewFlowSeries,
	IDATOverviewDataByAssetProps,
	IDATInstitutionOverviewByAsset,
	IDATCompanyPageProps,
	IDATCompanyAssetBreakdown,
	IDATCompanyChartByAsset,
	IDATTransactionRow
} from './types'

// Asset brand colours by name, [light, dark]; XRP and Tron pass 3:1 in both modes as they are.
const DAT_ASSET_BRAND_COLORS: Record<string, readonly [light: string, dark: string]> = {
	...ASSET_BRAND_COLORS,
	XRP: ['#6b7280', '#6b7280'],
	'Tron Network': ['#E91E63', '#E91E63']
}

// Assets without a brand colour take the palette colour for their rank by USD value.
function buildColorByAsset(res: IDATInstitutionsResponse): Record<string, readonly [light: string, dark: string]> {
	const assets = Object.keys(res.assetMetadata).sort(
		(a, b) => (res.assetMetadata[b].totalUsdValue ?? 0) - (res.assetMetadata[a].totalUsdValue ?? 0)
	)
	const colorByAsset: Record<string, readonly [light: string, dark: string]> = {}
	for (const [index, asset] of assets.entries()) {
		const color = chartColor(index)
		colorByAsset[asset] = DAT_ASSET_BRAND_COLORS[res.assetMetadata[asset].name] ?? [color, color]
	}
	return colorByAsset
}

function buildAllAssetLinks(res: IDATInstitutionsResponse): Array<{ label: string; to: string }> {
	const assetEntries: Array<[string, number]> = []
	for (const key in res.assetMetadata) {
		assetEntries.push([key, res.assetMetadata[key].totalUsdValue ?? 0])
	}
	assetEntries.sort((a, b) => b[1] - a[1])
	return [
		{ label: 'All', to: '/digital-asset-treasuries' },
		...assetEntries.map(([asset]) => ({
			label: res.assetMetadata[asset].name,
			to: `/digital-asset-treasuries/${asset}`
		}))
	]
}

function mergeAscendingFlowPoints(
	left: IDATOverviewFlowSeries['points'],
	right: IDATOverviewFlowSeries['points']
): Array<IDATOverviewFlowSeries['points'][number]> {
	const merged: Array<IDATOverviewFlowSeries['points'][number]> = []
	let leftIndex = 0
	let rightIndex = 0
	while (leftIndex < left.length || rightIndex < right.length) {
		if (rightIndex >= right.length || (leftIndex < left.length && left[leftIndex][0] <= right[rightIndex][0])) {
			merged.push(left[leftIndex++])
		} else {
			merged.push(right[rightIndex++])
		}
	}
	return merged
}

export async function getDATOverviewData(): Promise<IDATOverviewPageProps> {
	const res = await fetchDATInstitutions()

	const allAssets = buildAllAssetLinks(res)
	const colorByAsset = buildColorByAsset(res)

	const dailyFlowSeriesByAsset = new Map<string, IDATOverviewFlowSeries>()
	for (const asset in res.flows) {
		const name = res.assetMetadata[asset]?.name ?? asset
		const existing = dailyFlowSeriesByAsset.get(name)
		const assetFlows = res.flows[asset]
		const points = new Array<readonly [number, number]>(assetFlows.length)

		for (let i = 0; i < assetFlows.length; i++) {
			const [date, _net, _inflow, _outflow, purchasePrice, usdValueOfPurchase] = assetFlows[i]
			points[i] = [toUnixMsTimestamp(date), purchasePrice ?? usdValueOfPurchase ?? 0] as const
		}

		dailyFlowSeriesByAsset.set(name, {
			name,
			stack: 'asset',
			color: existing?.color ?? colorByAsset[asset],
			// Asset streams are ascending; only merge when two asset ids share a display name.
			points: existing ? mergeAscendingFlowPoints(existing.points, points) : points
		})
	}

	const institutions: Array<IDATInstitutionOverview> = res.institutions.map((institution) => {
		const metadata = res.institutionMetadata[institution.institutionId]
		return {
			...metadata,
			holdings: Object.entries(metadata.holdings)
				.map(([asset, holding]) => ({
					asset,
					name: res.assetMetadata[asset].name,
					ticker: res.assetMetadata[asset].ticker,
					amount: holding.amount,
					cost: holding.cost ?? null,
					usdValue: holding.usdValue ?? null,
					avgPrice: holding.avgPrice ?? null,
					dominance: getDominancePercent(holding.usdValue ?? 0, metadata.totalUsdValue),
					color: colorByAsset[asset]
				}))
				.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
		}
	})

	return { allAssets, institutions, dailyFlowsByAsset: Object.fromEntries(dailyFlowSeriesByAsset) }
}

export async function getDATOverviewDataByAsset(asset: string): Promise<IDATOverviewDataByAssetProps | null> {
	const res = await fetchDATInstitutions()

	const allAssets = buildAllAssetLinks(res)
	const metadata = res.assetMetadata[asset]
	const institutions = res.assets[asset]

	if (!metadata || !institutions) {
		return null
	}

	const finalInstitutions: Array<IDATInstitutionOverviewByAsset> = institutions
		.map((institution) => {
			const meta = res.institutionMetadata[institution.institutionId]
			return {
				institutionId: meta.institutionId,
				ticker: meta.ticker,
				name: meta.name,
				type: meta.type,
				price: meta.price,
				priceChange24h: meta.priceChange24h,
				volume24h: meta.volume24h,
				mcapRealized: meta.mcapRealized,
				mcapRealistic: meta.mcapRealistic,
				mcapMax: meta.mcapMax,
				realized_mNAV: meta.realized_mNAV,
				realistic_mNAV: meta.realistic_mNAV,
				max_mNAV: meta.max_mNAV,
				holdings: meta.holdings[asset]
			}
		})
		.sort((a, b) => (b.holdings.usdValue ?? 0) - (a.holdings.usdValue ?? 0))

	const mNAVRealized = new Map<number, Map<string, number | null | undefined>>()
	const mNAVRealistic = new Map<number, Map<string, number | null | undefined>>()
	const mNAVMax = new Map<number, Map<string, number | null | undefined>>()

	const mnavAsset = res.mNAV[asset]
	if (mnavAsset != null) {
		for (const institution in mnavAsset) {
			for (const [date, realized, realistic, max] of mnavAsset[institution]) {
				let realizedByInstitution = mNAVRealized.get(date)
				let realisticByInstitution = mNAVRealistic.get(date)
				let maxByInstitution = mNAVMax.get(date)
				if (!realizedByInstitution) {
					realizedByInstitution = new Map()
					realisticByInstitution = new Map()
					maxByInstitution = new Map()
					mNAVRealized.set(date, realizedByInstitution)
					mNAVRealistic.set(date, realisticByInstitution)
					mNAVMax.set(date, maxByInstitution)
				}
				realizedByInstitution.set(institution, realized)
				realisticByInstitution!.set(institution, realistic)
				maxByInstitution!.set(institution, max)
			}
		}
	}

	const dimensions = ['timestamp', ...finalInstitutions.map((inst) => inst.ticker)]

	const buildDataset = (mnavByDate: Map<number, Map<string, number | null | undefined>>): MultiSeriesChartDataset => {
		const source: Array<Array<number | null>> = []

		for (const [date, values] of mnavByDate) {
			const row = new Array<number | null>(finalInstitutions.length + 1)
			row[0] = toUnixMsTimestamp(date)
			for (let i = 0; i < finalInstitutions.length; i++) {
				row[i + 1] = values.get(finalInstitutions[i].ticker) ?? null
			}
			source.push(row)
		}

		source.sort((a, b) => a[0]! - b[0]!)
		return { source, dimensions }
	}

	const assetFlows = res.flows[asset] ?? []
	const dailyFlowSource = new Array<Array<number>>(assetFlows.length)
	for (let i = 0; i < assetFlows.length; i++) {
		const [timestamp, net] = assetFlows[i]
		dailyFlowSource[i] = [toUnixMsTimestamp(timestamp), net]
	}

	return {
		institutions: finalInstitutions,
		asset,
		metadata,
		allAssets,
		dailyFlowsChart: {
			dataset: {
				source: dailyFlowSource,
				dimensions: ['timestamp', metadata.name]
			},
			charts: [
				{
					type: 'bar' as const,
					name: metadata.name,
					encode: { x: 0, y: 1 },
					stack: metadata.name,
					color: oldBlue
				}
			]
		},
		institutionsNames: finalInstitutions.map((inst) => inst.ticker),
		mNAVRealizedChart: {
			charts: finalInstitutions.map((inst, i) => ({
				name: inst.ticker,
				stack: inst.ticker,
				type: 'line' as const,
				color: chartColor(i),
				encode: { x: 0, y: i + 1 }
			})),
			dataset: buildDataset(mNAVRealized)
		},
		mNAVRealisticChart: {
			charts: finalInstitutions.map((inst, i) => ({
				name: inst.ticker,
				stack: inst.ticker,
				type: 'line' as const,
				color: chartColor(i),
				encode: { x: 0, y: i + 1 }
			})),
			dataset: buildDataset(mNAVRealistic)
		},
		mNAVMaxChart: {
			charts: finalInstitutions.map((inst, i) => ({
				name: inst.ticker,
				stack: inst.ticker,
				type: 'line' as const,
				color: chartColor(i),
				encode: { x: 0, y: i + 1 }
			})),
			dataset: buildDataset(mNAVMax)
		}
	}
}

// ── Company detail page query ───────────────────────────────────────────

export function buildDATTransactionRowsByAsset(
	transactions: Array<IDATTransactionRow>
): Map<string, Array<[number, number, number | null, number | null]>> {
	const transactionsByAsset = new Map<string, Array<[number, number, number | null, number | null]>>()
	const assetsToSort = new Set<string>()
	for (let i = transactions.length - 1; i >= 0; i--) {
		const item = transactions[i]
		let rows = transactionsByAsset.get(item.asset)
		if (!rows) {
			rows = []
			transactionsByAsset.set(item.asset, rows)
		}
		const timestamp = Math.floor(Date.parse(item.end_date ?? item.start_date) / 1000)
		if (rows.length > 0 && timestamp < rows[rows.length - 1][0]) assetsToSort.add(item.asset)
		rows.push([timestamp, item.type === 'sale' ? -item.amount : item.amount, item.avg_price, item.usd_value])
	}
	for (const asset of assetsToSort) transactionsByAsset.get(asset)?.sort((a, b) => a[0] - b[0])
	return transactionsByAsset
}

export async function getDATCompanyData(company: string): Promise<IDATCompanyPageProps | null> {
	const data = await fetchDATInstitutionDetail(company)
	if (!data) return null

	const transactions: Array<IDATTransactionRow> = data.transactions.map((transaction) => ({
		...transaction,
		amount: Number(transaction.amount),
		avg_price: transaction.avg_price == null ? null : Number(transaction.avg_price),
		usd_value: transaction.usd_value == null ? null : Number(transaction.usd_value)
	}))

	// The endpoint is normally newest-first. The builder walks it backwards and only sorts an asset
	// when a local ordering anomaly is detected in the live response.
	const transactionsByAsset = buildDATTransactionRowsByAsset(transactions)

	const chartByAsset: Array<IDATCompanyChartByAsset> = []
	for (const assetKey in data.assets) {
		const assetMeta = data.assetsMeta[assetKey]
		const transactionRows = transactionsByAsset.get(assetKey) ?? []

		let totalAmount = 0
		const seriesName = assetMeta.ticker
		const source = transactionRows.map(([timestamp, amount, avgPrice, usdValue]) => {
			totalAmount += amount
			return [timestamp * 1000, totalAmount, amount, avgPrice, usdValue]
		})
		const holdingsChart = {
			dataset: {
				source,
				dimensions: ['timestamp', seriesName, 'delta', 'avgPrice', 'usdValue']
			},
			charts: [
				{
					type: (source.length < 2 ? 'bar' : 'line') as 'bar' | 'line',
					name: seriesName,
					encode: { x: 'timestamp', y: seriesName },
					stack: seriesName,
					color: CHART_COLORS[0],
					showSymbol: true,
					symbol: 'circle',
					symbolSize: 6
				}
			]
		}

		chartByAsset.push({
			asset: assetKey,
			name: assetMeta.name,
			ticker: assetMeta.ticker,
			holdingsChart
		})
	}

	const mNAVChart =
		data.stats.length > 0
			? {
					dataset: {
						source: data.stats.map((item) => [item[0], item[7], item[8], item[9]]),
						dimensions: ['timestamp', 'Realized mNAV', 'Realistic mNAV', 'Max mNAV']
					},
					charts: [
						{
							type: 'line' as const,
							name: 'Realized mNAV',
							encode: { x: 'timestamp', y: 'Realized mNAV' },
							stack: 'Realized mNAV',
							color: CHART_COLORS[0]
						},
						{
							type: 'line' as const,
							name: 'Realistic mNAV',
							encode: { x: 'timestamp', y: 'Realistic mNAV' },
							stack: 'Realistic mNAV',
							color: CHART_COLORS[1]
						},
						{
							type: 'line' as const,
							name: 'Max mNAV',
							encode: { x: 'timestamp', y: 'Max mNAV' },
							stack: 'Max mNAV',
							color: CHART_COLORS[2]
						}
					]
				}
			: null

	const fdChart =
		data.stats.length > 0
			? {
					dataset: {
						source: data.stats.map((item) => [item[0], item[1], item[2], item[3]]),
						dimensions: ['timestamp', 'FD Realized', 'FD Realistic', 'FD Max']
					},
					charts: [
						{
							type: 'line' as const,
							name: 'FD Realized',
							encode: { x: 'timestamp', y: 'FD Realized' },
							stack: 'FD Realized',
							color: CHART_COLORS[3]
						},
						{
							type: 'line' as const,
							name: 'FD Realistic',
							encode: { x: 'timestamp', y: 'FD Realistic' },
							stack: 'FD Realistic',
							color: CHART_COLORS[4]
						},
						{
							type: 'line' as const,
							name: 'FD Max',
							encode: { x: 'timestamp', y: 'FD Max' },
							stack: 'FD Max',
							color: CHART_COLORS[5]
						}
					]
				}
			: null

	const totalAssetValueChart =
		data.assetValue.length > 0
			? {
					dataset: {
						source: data.assetValue.map(([timestamp, value]) => [timestamp, value]),
						dimensions: ['timestamp', 'Total Asset Value']
					},
					charts: [
						{
							type: 'line' as const,
							name: 'Total Asset Value',
							encode: { x: 'timestamp', y: 'Total Asset Value' },
							stack: 'Total Asset Value',
							color: CHART_COLORS[6]
						}
					]
				}
			: null

	const ohlcvChartData: Array<[number, number, number, number, number, number]> | null =
		data.ohlcv.length > 0
			? data.ohlcv.map(([date, open, high, low, close, volume]) => [date, open, close, low, high, volume])
			: null

	// Compute sorted assets
	const assetEntries: Array<[string, { usdValue: number }]> = []
	for (const key in data.assets) {
		assetEntries.push([key, data.assets[key]])
	}
	assetEntries.sort((a, b) => (b[1].usdValue ?? 0) - (a[1].usdValue ?? 0))
	const sortedAssetTickers: Array<string> = []
	for (const [asset] of assetEntries) {
		sortedAssetTickers.push(data.assetsMeta[asset].ticker)
	}

	// Compute assets breakdown
	const assetsBreakdownData: Array<IDATCompanyAssetBreakdown> = []
	for (const asset in data.assets) {
		const { amount, cost, usdValue, avgPrice } = data.assets[asset]
		assetsBreakdownData.push({
			name: data.assetsMeta[asset].name,
			ticker: data.assetsMeta[asset].ticker,
			amount,
			cost: cost ?? null,
			usdValue: usdValue ?? null,
			avgPrice: avgPrice ?? null
		})
	}
	assetsBreakdownData.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))

	let firstAnnouncementDate: string | null = null
	let lastAnnouncementDate: string | null = null
	let firstAnnouncementTimestamp = Number.POSITIVE_INFINITY
	let lastAnnouncementTimestamp = Number.NEGATIVE_INFINITY

	for (const transaction of transactions) {
		const reportDate = transaction.report_date
		const reportTimestamp = new Date(reportDate).getTime()
		if (!Number.isFinite(reportTimestamp)) continue

		if (reportTimestamp < firstAnnouncementTimestamp) {
			firstAnnouncementTimestamp = reportTimestamp
			firstAnnouncementDate = reportDate
		}
		if (reportTimestamp > lastAnnouncementTimestamp) {
			lastAnnouncementTimestamp = reportTimestamp
			lastAnnouncementDate = reportDate
		}
	}

	return {
		name: data.name,
		ticker: data.ticker,
		transactions,
		price: data.price,
		priceChange24h: data.priceChange24h,
		totalCost: data.totalCost,
		totalUsdValue: data.totalUsdValue,
		firstAnnouncementDate,
		lastAnnouncementDate,
		realized_mNAV: data.stats.length > 0 ? data.stats[data.stats.length - 1][7] : null,
		realistic_mNAV: data.stats.length > 0 ? data.stats[data.stats.length - 1][8] : null,
		max_mNAV: data.stats.length > 0 ? data.stats[data.stats.length - 1][9] : null,
		assets: sortedAssetTickers,
		assetsBreakdown: assetsBreakdownData,
		chartByAsset,
		mNAVChart,
		fdChart,
		totalAssetValueChart,
		ohlcvChartData
	}
}
