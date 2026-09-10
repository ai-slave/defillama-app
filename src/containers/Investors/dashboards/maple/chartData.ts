import type { MultiSeriesChartDataset } from '~/components/ECharts/MultiSeriesChart/types'
import type { MaplePool, MaplePoolWithLoans } from './api'
import { parseFeeRate, parseInterestRate, parseTokenAmount, parseWad } from './api'

export interface PoolRow {
	name: string
	asset: string
	tvlUsd: number
	spotApy: number
	numOpenTermLoans: number
	utilization: number
	numPositions: number
	feeRate: number
	openToPublic: boolean
	unrealizedLosses: number
}

export interface LoanRow {
	id: string
	borrower: string
	pool: string
	asset: string
	principal: number
	interestRate: number
	isCalled: boolean
	isImpaired: boolean
	interestPaid: number
	fundingDate: number
	ageDays: number
	state: string
	paymentIntervalDays: number
}

const RATE_BUCKETS = [
	{ label: '0-2%', min: 0, max: 2 },
	{ label: '2-4%', min: 2, max: 4 },
	{ label: '4-6%', min: 4, max: 6 },
	{ label: '6-10%', min: 6, max: 10 },
	{ label: '10%+', min: 10, max: Infinity }
]

const AGE_BUCKETS = [
	{ label: '< 1mo', min: 0, max: 30 },
	{ label: '1-3mo', min: 30, max: 90 },
	{ label: '3-6mo', min: 90, max: 180 },
	{ label: '6-12mo', min: 180, max: 365 },
	{ label: '1y+', min: 365, max: Infinity }
]

export function buildMaplePoolsData(pools: Array<MaplePool>) {
	const rows = pools
		.map((pool): PoolRow => {
			const totalAssets = Number(pool.totalAssets)
			const principalOut = Number(pool.principalOut)
			return {
				name: pool.name,
				asset: pool.asset.symbol,
				tvlUsd: Number(pool.tvlUsd),
				spotApy: parseWad(pool.spotApy, 28),
				numOpenTermLoans: Number(pool.numOpenTermLoans),
				utilization: totalAssets > 0 ? (principalOut / totalAssets) * 100 : 0,
				numPositions: Number(pool.numPositions),
				feeRate: parseFeeRate(pool.delegateManagementFeeRate) + parseFeeRate(pool.platformManagementFeeRate),
				openToPublic: pool.openToPublic,
				unrealizedLosses: Number(pool.unrealizedLosses)
			}
		})
		.sort((a, b) => b.tvlUsd - a.tvlUsd)

	let totalTvl = 0
	let totalDepositors = 0
	let weightedApySum = 0
	let weightedUtilizationSum = 0
	const tvlSource: Array<Array<string | number>> = []
	const utilizationSource: Array<Array<string | number>> = []
	const apySource: Array<Array<string | number>> = []

	for (const pool of rows) {
		totalTvl += pool.tvlUsd
		totalDepositors += pool.numPositions
		weightedApySum += pool.spotApy * pool.tvlUsd
		weightedUtilizationSum += pool.utilization * pool.tvlUsd
		if (pool.tvlUsd >= 10_000) {
			tvlSource.push([pool.name, pool.tvlUsd])
			if (pool.utilization > 0) utilizationSource.push([pool.name, pool.utilization])
		}
		if (pool.spotApy > 0) apySource.push([pool.name, pool.spotApy])
	}

	utilizationSource.sort((a, b) => (b[1] as number) - (a[1] as number))
	apySource.sort((a, b) => (b[1] as number) - (a[1] as number))

	return {
		rows,
		totals: {
			totalTvl,
			totalDepositors,
			weightedAverageApy: totalTvl > 0 ? weightedApySum / totalTvl : 0,
			weightedAverageUtilization: totalTvl > 0 ? weightedUtilizationSum / totalTvl : 0
		},
		tvl: { dimensions: ['Name', 'TVL'], source: tvlSource } satisfies MultiSeriesChartDataset,
		utilization: {
			dimensions: ['Name', 'Utilization'],
			source: utilizationSource
		} satisfies MultiSeriesChartDataset,
		apy: { dimensions: ['Name', 'Spot APY'], source: apySource } satisfies MultiSeriesChartDataset
	}
}

const bucketDataset = (buckets: typeof RATE_BUCKETS, values: Array<number>): MultiSeriesChartDataset => ({
	dimensions: ['Name', 'Principal'],
	source: buckets.flatMap((bucket, index) => (values[index] > 0 ? [[bucket.label, values[index]]] : []))
})

export function buildMapleLoansData(pools: Array<MaplePoolWithLoans>, nowSec: number) {
	const rows: Array<LoanRow> = []
	for (const pool of pools) {
		for (const loan of pool.openTermLoans) {
			const fundingDate = Number(loan.fundingDate)
			rows.push({
				id: loan.id,
				borrower: loan.borrower.id,
				pool: pool.name,
				asset: pool.asset.symbol,
				principal: parseTokenAmount(loan.principalOwed, pool.asset.decimals),
				interestRate: parseInterestRate(loan.interestRate),
				isCalled: loan.isCalled,
				isImpaired: loan.isImpaired,
				interestPaid: parseTokenAmount(loan.interestPaid, pool.asset.decimals),
				fundingDate,
				ageDays: fundingDate > 0 ? Math.max(0, Math.floor((nowSec - fundingDate) / 86_400)) : 0,
				state: loan.state,
				paymentIntervalDays: Number(loan.paymentIntervalDays)
			})
		}
	}
	rows.sort((a, b) => b.principal - a.principal)

	const principalByPool = new Map<string, number>()
	const ratePrincipal = new Array<number>(RATE_BUCKETS.length).fill(0)
	const agePrincipal = new Array<number>(AGE_BUCKETS.length).fill(0)
	let totalPrincipal = 0
	let totalInterestPaid = 0
	let weightedRateSum = 0
	let totalAge = 0

	for (const loan of rows) {
		principalByPool.set(loan.pool, (principalByPool.get(loan.pool) ?? 0) + loan.principal)
		totalPrincipal += loan.principal
		totalInterestPaid += loan.interestPaid
		weightedRateSum += loan.interestRate * loan.principal
		totalAge += loan.ageDays
		const rateIndex = RATE_BUCKETS.findIndex(
			(bucket) => loan.interestRate >= bucket.min && loan.interestRate < bucket.max
		)
		if (rateIndex >= 0) ratePrincipal[rateIndex] += loan.principal
		const ageIndex = AGE_BUCKETS.findIndex((bucket) => loan.ageDays >= bucket.min && loan.ageDays < bucket.max)
		if (ageIndex >= 0) agePrincipal[ageIndex] += loan.principal
	}

	return {
		rows,
		totals: {
			totalPrincipal,
			totalInterestPaid,
			weightedAverageRate: totalPrincipal > 0 ? weightedRateSum / totalPrincipal : 0,
			averageAgeDays: rows.length > 0 ? totalAge / rows.length : 0
		},
		principalByPool: {
			dimensions: ['Name', 'Principal'],
			source: Array.from(principalByPool.entries())
				.sort((a, b) => b[1] - a[1])
				.map(([name, principal]) => [name, principal])
		} satisfies MultiSeriesChartDataset,
		rateDistribution: bucketDataset(RATE_BUCKETS, ratePrincipal),
		ageDistribution: bucketDataset(AGE_BUCKETS, agePrincipal)
	}
}

export interface TxRow {
	id: string
	timestamp: number
	type: 'deposit' | 'withdraw'
	assetsAmount: number
	account: string
}

export interface DripRow {
	id: string
	timestamp: number
	type: string
	amount: number
	account: string
}

export function monthTimestampMs(ts: number): number {
	const d = new Date(ts * 1000)
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function aggregateByMonth(txes: Array<TxRow>): MultiSeriesChartDataset {
	const map = new Map<number, { deposits: number; withdrawals: number }>()

	for (const tx of txes) {
		const mk = monthTimestampMs(tx.timestamp)
		const entry = map.get(mk) ?? { deposits: 0, withdrawals: 0 }
		if (tx.type === 'deposit') entry.deposits += tx.assetsAmount
		else entry.withdrawals += tx.assetsAmount
		map.set(mk, entry)
	}

	const entries = Array.from(map.entries()).sort(([a], [b]) => a - b)
	const source = new Array<MultiSeriesChartDataset['source'][number]>(entries.length)
	for (let index = 0; index < entries.length; index++) {
		const [timestamp, value] = entries[index]
		source[index] = [timestamp, value.deposits, value.withdrawals]
	}
	return { dimensions: ['timestamp', 'Deposits', 'Withdrawals'], source }
}

export function aggregateDripByMonth(txes: Array<DripRow>): MultiSeriesChartDataset {
	const map = new Map<number, number>()

	for (const tx of txes) {
		const mk = monthTimestampMs(tx.timestamp)
		map.set(mk, (map.get(mk) ?? 0) + tx.amount)
	}

	const entries = Array.from(map.entries()).sort(([a], [b]) => a - b)
	const source = new Array<MultiSeriesChartDataset['source'][number]>(entries.length)
	for (let index = 0; index < entries.length; index++) {
		const [timestamp, amount] = entries[index]
		source[index] = [timestamp, amount]
	}
	return { dimensions: ['timestamp', 'Claimed'], source }
}
