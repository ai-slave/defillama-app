import { describe, expect, test } from 'vitest'
import type { MaplePool, MaplePoolWithLoans, MapleOpenTermLoan } from './api'
import {
	aggregateByMonth,
	aggregateDripByMonth,
	buildMapleLoansData,
	buildMaplePoolsData,
	type DripRow,
	type TxRow
} from './chartData'

function maplePool(overrides: Partial<MaplePool> = {}): MaplePool {
	return {
		id: 'pool-1',
		name: 'High Yield',
		asset: { symbol: 'USDC', decimals: 6 },
		tvlUsd: '250000',
		spotApy: '75000000000000000000000000000',
		numOpenTermLoans: '2',
		unrealizedLosses: '0',
		liquidityCap: '1000000',
		loanManager: { principalOut: '50000000000', accountedInterest: '0' },
		totalAssets: '250000000000',
		principalOut: '50000000000',
		numPositions: '12',
		numActiveLoans: '2',
		numDefaultedLoans: 0,
		depositedAssets: '0',
		withdrawnAssets: '0',
		coverLiquidated: '0',
		delegateManagementFeeRate: '10000',
		platformManagementFeeRate: '5000',
		openToPublic: true,
		symbol: 'MPL-USDC',
		poolMeta: null,
		withdrawalManager: null,
		...overrides
	}
}

function mapleLoan(overrides: Partial<MapleOpenTermLoan> = {}): MapleOpenTermLoan {
	return {
		id: 'loan-1',
		borrower: { id: '0xabc' },
		principalOwed: '2500000000',
		interestRate: '45000',
		isCalled: false,
		isImpaired: false,
		interestPaid: '125000000',
		fundingDate: '1769904000',
		startDate: '1769904000',
		state: 'Active',
		paymentIntervalDays: '30',
		gracePeriodSeconds: '86400',
		delegateServiceFeeRate: '0',
		platformServiceFeeRate: '0',
		lateInterestPremium: '0',
		lateFeeRate: '0',
		...overrides
	}
}

describe('Maple chart data', () => {
	test('normalizes raw pool strings into rows, totals, and chart datasets', () => {
		const result = buildMaplePoolsData([
			maplePool(),
			maplePool({
				id: 'pool-2',
				name: 'Small Pool',
				tvlUsd: '9000',
				spotApy: '0',
				totalAssets: '0',
				principalOut: '0',
				numPositions: '3'
			})
		])

		expect(result.rows[0]).toMatchObject({
			name: 'High Yield',
			tvlUsd: 250_000,
			spotApy: 7.5,
			utilization: 20,
			numPositions: 12,
			feeRate: 1.5
		})
		expect(result.totals).toEqual({
			totalTvl: 259_000,
			totalDepositors: 15,
			weightedAverageApy: (7.5 * 250_000) / 259_000,
			weightedAverageUtilization: (20 * 250_000) / 259_000
		})
		expect(result.tvl).toEqual({
			dimensions: ['Name', 'TVL'],
			source: [['High Yield', 250_000]]
		})
		expect(result.utilization.source).toEqual([['High Yield', 20]])
		expect(result.apy.source).toEqual([['High Yield', 7.5]])
	})

	test('normalizes raw loan amounts and Unix seconds into every chart dataset', () => {
		const pools: Array<MaplePoolWithLoans> = [
			{
				id: 'pool-1',
				name: 'Blue Chip',
				asset: { symbol: 'USDC', decimals: 6 },
				tvlUsd: '1000000',
				spotApy: '0',
				numOpenTermLoans: '2',
				openTermLoans: [
					mapleLoan(),
					mapleLoan({
						id: 'loan-2',
						borrower: { id: '0xdef' },
						principalOwed: '500000000',
						interestRate: '120000',
						interestPaid: '25000000',
						fundingDate: '1762128000',
						startDate: '1762128000',
						isCalled: true,
						isImpaired: true,
						state: 'Called',
						paymentIntervalDays: '14'
					})
				]
			}
		]
		const result = buildMapleLoansData(pools, Date.parse('2026-03-02T00:00:00Z') / 1000)

		expect(result.rows).toEqual([
			expect.objectContaining({ id: 'loan-1', principal: 2500, interestRate: 4.5, interestPaid: 125, ageDays: 29 }),
			expect.objectContaining({ id: 'loan-2', principal: 500, interestRate: 12, interestPaid: 25, ageDays: 119 })
		])
		expect(result.totals).toEqual({
			totalPrincipal: 3000,
			totalInterestPaid: 150,
			weightedAverageRate: 5.75,
			averageAgeDays: 74
		})
		expect(result.principalByPool.source).toEqual([['Blue Chip', 3000]])
		expect(result.rateDistribution.source).toEqual([
			['4-6%', 2500],
			['10%+', 500]
		])
		expect(result.ageDistribution.source).toEqual([
			['< 1mo', 2500],
			['3-6mo', 500]
		])
	})

	test('aggregates deposits and withdrawals into UTC months', () => {
		const tx = (id: string, date: string, type: TxRow['type'], assetsAmount: number): TxRow => ({
			id,
			timestamp: Date.parse(date) / 1e3,
			type,
			assetsAmount,
			account: '0x1'
		})

		expect(
			aggregateByMonth([
				tx('2', '2026-02-01T00:00:00Z', 'deposit', 7),
				tx('1', '2026-01-31T23:59:59Z', 'deposit', 10),
				tx('3', '2026-01-15T00:00:00Z', 'withdraw', 3)
			])
		).toEqual({
			dimensions: ['timestamp', 'Deposits', 'Withdrawals'],
			source: [
				[Date.parse('2026-01-01T00:00:00Z'), 10, 3],
				[Date.parse('2026-02-01T00:00:00Z'), 7, 0]
			]
		})
	})

	test('aggregates drip claims independently of their event type', () => {
		const rows: Array<DripRow> = [
			{ id: '1', timestamp: Date.parse('2026-01-02T00:00:00Z') / 1e3, type: 'claim', amount: 2, account: '0x1' },
			{ id: '2', timestamp: Date.parse('2026-01-03T00:00:00Z') / 1e3, type: 'other', amount: 3, account: '0x2' }
		]
		expect(aggregateDripByMonth(rows)).toEqual({
			dimensions: ['timestamp', 'Claimed'],
			source: [[Date.parse('2026-01-01T00:00:00Z'), 5]]
		})
	})
})
