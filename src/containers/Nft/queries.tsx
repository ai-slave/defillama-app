import { formatBarChart } from '~/components/ECharts/shared/timeSeries'
import { CHART_COLORS } from '~/constants/colors'
import { roundNumber } from '~/utils/numberFormat'
import {
	fetchNftCollection,
	fetchNftCollectionFloorHistory,
	fetchNftCollectionOrderbook,
	fetchNftCollectionSales,
	fetchNftCollectionStats,
	fetchNftCollections,
	fetchNftMarketplaceStats,
	fetchNftMarketplaceVolumes,
	fetchNftRoyalties,
	fetchNftRoyalty,
	fetchNftRoyaltyHistory,
	fetchNftVolumes,
	fetchParentCompanies
} from './api'
import type { RawNftCollection } from './api.types'
import { buildNFTMarketplaceChartData } from './marketplaceCharts'
import { NFT_MINT_EARNINGS } from './mintEarnings'

export type VolumeChartEntry = {
	volumeUSD?: number
	volume?: number
}
type NftDataResult = {
	chart: VolumeChartEntry[]
	collections: ExtendedNftCollection[]
	statistics: unknown[]
}

type ExtendedNftCollection = RawNftCollection & {
	volume1d: number
	volume7d: number
	volume30d: number
	sales1d: number
}

export const getNFTData = async (): Promise<NftDataResult> => {
	try {
		const [collections, volumes] = await Promise.all([fetchNftCollections(), fetchNftVolumes().catch(() => [])])
		const volumeByCollection = new Map(volumes.map((volume) => [volume.collection, volume] as const))

		const data = collections.map((collection) => {
			const volume = volumeByCollection.get(collection.collectionId)

			return {
				...collection,
				volume1d: roundNumber(volume?.['1DayVolume'] ?? 0, 2),
				volume7d: roundNumber(volume?.['7DayVolume'] ?? 0, 2),
				volume30d: roundNumber(volume?.['30DayVolume'] ?? 0, 2),
				sales1d: roundNumber(volume?.['1DaySales'] ?? 0, 2)
			}
		})

		data.sort((a, b) => b.volume1d - a.volume1d)

		return {
			chart: [],
			collections: data,
			statistics: []
		}
	} catch (e) {
		console.log(e)
		return {
			chart: [],
			collections: [],
			statistics: []
		}
	}
}

export const getNFTMarketplacesData = async () => {
	const [data, volume] = await Promise.all([
		fetchNftMarketplaceStats().catch(() => {
			return []
		}),
		fetchNftMarketplaceVolumes().catch(() => {
			return []
		})
	])

	const chartData = buildNFTMarketplaceChartData(volume)

	data.sort((a, b) => Number(b['1DayVolume'] ?? 0) - Number(a['1DayVolume'] ?? 0))

	return {
		data,
		...chartData
	}
}

const normalizeEthereumCollectionId = (collectionId: string) =>
	`0x${collectionId.replace(/^(?:0x)+/i, '').toLowerCase()}`

type NFTCollectionEarningsRow = {
	defillamaId: string
	name: string
	displayName: string
	logo: string
	chains: string[]
	total24h: number | null
	total7d: number | null
	total30d: number | null
	totalRoyaltyEarnings: number | null
	totalMintEarnings: number | null
	totalEarnings: number
}

export const getNFTCollectionEarnings = async () => {
	try {
		const [parentCompanies, royalties, collections] = await Promise.all([
			fetchParentCompanies().catch(() => []),
			fetchNftRoyalties(),
			fetchNftCollections()
		])

		const royaltiesByCollection = new Map<string, (typeof royalties)[0]>()
		for (const royalty of royalties) {
			const collectionId = normalizeEthereumCollectionId(royalty.collection)
			if (!royaltiesByCollection.has(collectionId)) {
				royaltiesByCollection.set(collectionId, royalty)
			}
		}

		const mintEarningsByContract = new Map<string, (typeof NFT_MINT_EARNINGS)[0]>()
		for (const earning of NFT_MINT_EARNINGS) {
			const collectionId = normalizeEthereumCollectionId(earning.contractAddress)
			if (!mintEarningsByContract.has(collectionId)) {
				mintEarningsByContract.set(collectionId, earning)
			}
		}

		const collectionEarnings: NFTCollectionEarningsRow[] = []
		const collectionEarningsById = new Map<string, NFTCollectionEarningsRow>()
		for (const c of collections) {
			const collectionId = normalizeEthereumCollectionId(c.collectionId)
			const royalty = royaltiesByCollection.get(collectionId)
			const mintEarnings = mintEarningsByContract.get(collectionId)

			if (royalty || mintEarnings) {
				const earnings = {
					defillamaId: collectionId,
					name: c.name,
					displayName: c.name,
					logo: c.image,
					chains: ['Ethereum'],
					total24h: royalty?.usd1D ?? null,
					total7d: royalty?.usd7D ?? null,
					total30d: royalty?.usd30D ?? null,
					totalRoyaltyEarnings: royalty?.usdLifetime ?? null,
					totalMintEarnings: mintEarnings != null ? Number(mintEarnings.usdSales) || null : null,
					totalEarnings: (royalty?.usdLifetime ?? 0) + (mintEarnings != null ? Number(mintEarnings.usdSales) || 0 : 0)
				}
				collectionEarnings.push(earnings)
				if (!collectionEarningsById.has(collectionId)) collectionEarningsById.set(collectionId, earnings)
			}
		}

		const duplicateCollections = new Set<string>()

		const parentEarnings = parentCompanies.map((parent) => {
			const subCollections = parent.nftCollections.map(([collectionId]) => {
				const address = normalizeEthereumCollectionId(collectionId)
				duplicateCollections.add(address)
				return address
			})
			const subCollectionEarnings: NFTCollectionEarningsRow[] = []
			const seenCollections = new Set<string>()

			let total24h = 0
			let total7d = 0
			let total30d = 0
			let totalRoyaltyEarnings = 0
			let totalMintEarnings = 0
			let totalEarnings = 0

			for (const collectionId of subCollections) {
				if (seenCollections.has(collectionId)) continue
				seenCollections.add(collectionId)
				const c = collectionEarningsById.get(collectionId)
				if (!c) continue
				subCollectionEarnings.push(c)
				total24h += c.total24h ?? 0
				total7d += c.total7d ?? 0
				total30d += c.total30d ?? 0
				totalRoyaltyEarnings += c.totalRoyaltyEarnings ?? 0
				totalMintEarnings += c.totalMintEarnings ?? 0
				totalEarnings += c.totalEarnings ?? 0
			}

			return {
				defillamaId: subCollections.join('+'),
				name: parent.name,
				displayName: parent.name,
				chains: ['Ethereum'],
				total24h,
				total7d,
				total30d,
				totalRoyaltyEarnings,
				totalMintEarnings,
				totalEarnings,
				subRows: subCollectionEarnings
			}
		})

		return {
			earnings: [...parentEarnings, ...collectionEarnings.filter((c) => !duplicateCollections.has(c.defillamaId))].sort(
				(a, b) => b.totalEarnings - a.totalEarnings
			)
		}
	} catch (err) {
		console.log(err)
		return {
			earnings: []
		}
	}
}

export const getNFTRoyaltyHistory = async (slug: string) => {
	try {
		const [royaltyChart, collection, royalty] = await Promise.all([
			fetchNftRoyaltyHistory(slug).catch(() => []),
			fetchNftCollection(slug),
			fetchNftRoyalty(slug)
		])
		if (!Array.isArray(collection) || collection.length === 0 || !Array.isArray(royalty) || royalty.length === 0) {
			return {
				royaltyHistory: []
			}
		}

		const safeChart: Array<[number, number]> = Array.isArray(royaltyChart) ? royaltyChart : []
		const formattedData = formatBarChart({
			data: safeChart,
			groupBy: 'daily',
			denominationPriceHistory: null,
			dateInMs: false
		})
		const earningsChart = {
			dataset: {
				source: formattedData.map(([timestamp, value]) => [timestamp, value ?? 0]),
				dimensions: ['timestamp', 'Earnings']
			},
			charts: [
				{
					type: 'bar' as const,
					name: 'Earnings',
					encode: { x: 0, y: 1 },
					color: CHART_COLORS[0],
					stack: 'Earnings'
				}
			]
		}

		const data = [
			{
				defillamaId: slug,
				name: collection[0].name,
				displayName: collection[0].name,
				logo: `https://nft-icons.llamao.fi/icons/nfts/${slug}?w=48&h=48`,
				fallbackLogo: collection[0].image,
				address: slug,
				url: collection[0].projectUrl,
				twitter: collection[0].twitterUsername,
				category: 'Nft',
				totalDataChart: safeChart,
				earningsChart,
				total24h: royalty[0].usd1D,
				total7d: royalty[0].usd7D,
				total30d: royalty[0].usd30D,
				totalAllTime: royalty[0].usdLifetime
			}
		]

		return {
			royaltyHistory: data
		}
	} catch (err) {
		console.log(err)
		return {
			royaltyHistory: []
		}
	}
}

const filterOutlierSales = (sales: Array<[number, number]>): Array<[number, number]> => {
	if (sales.length < 2) return sales.slice()

	let total = 0
	for (const sale of sales) total += sale[1]
	const mean = total / sales.length
	let squaredDifferenceTotal = 0
	for (const sale of sales) {
		const difference = sale[1] - mean
		squaredDifferenceTotal += difference * difference
	}
	const std = Math.sqrt(squaredDifferenceTotal / (sales.length - 1))
	if (!Number.isFinite(std) || std === 0) {
		return sales.slice()
	}

	const filtered: Array<[number, number]> = []
	for (const sale of sales) {
		if (Math.abs((sale[1] - mean) / std) < 4) filtered.push(sale)
	}
	return filtered
}

const median = (sales: number[]): number => {
	if (sales.length === 0) return 0

	const middle = Math.floor(sales.length / 2)

	if (sales.length % 2 === 0) {
		return (sales[middle - 1] + sales[middle]) / 2
	}
	return sales[middle]
}

const ROLLING_MEDIAN_INTERVAL_MS = 6 * 60 * 60 * 1000

/** Build rolling medians from ascending millisecond sales without rescanning the full history per interval. */
export function buildRollingMedianSeries(sales: Array<[number, number]>): Array<[number, number]> {
	if (sales.length === 0) return []

	const medianWindowHours = sales.length > 300 ? 24 : 24 * 7
	const windowMs = medianWindowHours * 60 * 60 * 1000
	const start = Math.ceil(sales[0][0] / ROLLING_MEDIAN_INTERVAL_MS) * ROLLING_MEDIAN_INTERVAL_MS
	const stop = Math.ceil(sales[sales.length - 1][0] / ROLLING_MEDIAN_INTERVAL_MS) * ROLLING_MEDIAN_INTERVAL_MS
	const output: Array<[number, number]> = []
	let left = 0
	let right = 0

	for (let timestamp = start; timestamp <= stop; timestamp += ROLLING_MEDIAN_INTERVAL_MS) {
		const windowStart = timestamp - windowMs
		while (left < sales.length && sales[left][0] < windowStart) left++
		if (right < left) right = left
		while (right < sales.length && sales[right][0] <= timestamp) right++

		const values = new Array<number>(right - left)
		for (let i = left; i < right; i++) values[i - left] = sales[i][1]
		values.sort((a, b) => a - b)
		output.push([timestamp, median(values)])
	}

	return output
}

export const getNFTCollection = async (slug: string) => {
	try {
		const [data, sales, stats, floorHistory, orderbook] = await Promise.all([
			fetchNftCollection(slug),
			fetchNftCollectionSales(slug).catch(() => []),
			fetchNftCollectionStats(slug).catch(() => []),
			fetchNftCollectionFloorHistory(slug).catch(() => []),
			fetchNftCollectionOrderbook(slug).catch(() => null)
		])

		const salesExOutliers = filterOutlierSales(sales)

		// sort on timestamp
		const X = salesExOutliers.sort((a, b) => a[0] - b[0])

		const salesMedian1d = buildRollingMedianSeries(X)

		return {
			data,
			sales,
			salesExOutliers,
			salesMedian1d,
			stats: stats.map((item) => [Math.floor(Date.parse(item.day) / 1000), item.sum] as [number, number]),
			name: data?.[0]?.name ?? null,
			address: slug,
			floorHistory: {
				source: floorHistory.map((item) => [Math.floor(Date.parse(item.timestamp)), item.floorPrice]),
				dimensions: ['timestamp', 'Floor Price']
			},
			orderbook
		}
	} catch (e) {
		console.log(e)
		return undefined
	}
}
