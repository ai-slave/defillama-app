import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { IKeyMetricsProps } from '../KeyMetrics'
import type { IProtocolPageMetrics } from '../types'

vi.mock('~/ui/Icon', () => ({
	Icon: () => null
}))

vi.mock('~/ui/Tooltip', () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
}))

vi.mock('~/components/ReportIncorrectData', () => ({
	ReportIncorrectData: () => null
}))

vi.mock('../KeyMetricsPngExport', () => ({
	KeyMetricsPngExportButton: () => null
}))

const metrics: IProtocolPageMetrics = {
	tvl: false,
	dexs: false,
	dexsNotionalVolume: false,
	perps: false,
	openInterest: false,
	optionsPremiumVolume: false,
	optionsNotionalVolume: false,
	dexAggregators: false,
	perpsAggregators: false,
	bridgeAggregators: false,
	stablecoins: false,
	bridge: false,
	treasury: false,
	unlocks: false,
	incentives: false,
	yields: false,
	fees: true,
	revenue: false,
	forks: false,
	governance: false,
	nfts: false,
	dev: false,
	inflows: false,
	liquidity: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false
}

const renderKeyMetrics = async (props: IKeyMetricsProps) => {
	const { KeyMetrics } = await import('../KeyMetrics')

	return renderToStaticMarkup(<KeyMetrics {...props} />)
}

const baseProps = {
	name: 'Gauntlet',
	metrics,
	isOracleProtocol: false,
	oracleTvs: null,
	hasKeyMetrics: true,
	category: 'Analytics',
	openSmolStatsSummaryByDefault: true,
	formatPrice: (value: number | string | null) => (value == null ? null : `$${Math.round(Number(value))}`)
}

describe('KeyMetrics', () => {
	it('renders chain rows for fee breakdown metrics', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			fees: {
				total24h: 12,
				total7d: 70,
				total30d: 300,
				total1y: 3500,
				annualized1y: 3500,
				totalAllTime: 1500,
				chainBreakdown: {
					Ethereum: {
						total24h: 4,
						total7d: 28,
						total30d: 120,
						totalAllTime: 700
					},
					Base: {
						total24h: 8,
						total7d: 42,
						total30d: 180,
						totalAllTime: 800
					}
				}
			}
		})

		expect(markup).toContain('Fees 30d')
		expect(markup).toContain('Ethereum')
		expect(markup).toContain('Base')
		expect(markup).toContain('$120')
		expect(markup).toContain('$180')
		expect(markup.indexOf('Base')).toBeLessThan(markup.indexOf('Ethereum'))
	})

	it('does not repeat StableJack perp volume after promoting it to the primary metric', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			name: 'StableJack',
			perpVolume: {
				total24h: 2_000,
				total7d: 14_000,
				total30d: 68_290,
				total1y: null,
				annualized1y: null,
				totalAllTime: 100_000,
				chainBreakdown: null
			}
		})

		expect(markup).not.toContain('Perp Volume 30d')
	})

	it('renders liquidation adapter summaries like other standard adapter metrics', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			liquidationVolume: {
				total24h: 12,
				total7d: 70,
				total30d: 300,
				total1y: null,
				annualized1y: null,
				totalAllTime: 1500,
				chainBreakdown: null
			},
			collateralLiquidated: {
				total24h: 4,
				total7d: 28,
				total30d: 120,
				total1y: null,
				annualized1y: null,
				totalAllTime: 700,
				chainBreakdown: {
					Ethereum: {
						total24h: 1,
						total7d: 8,
						total30d: 20,
						totalAllTime: 100
					},
					Base: {
						total24h: 3,
						total7d: 20,
						total30d: 100,
						totalAllTime: 600
					}
				}
			}
		})

		expect(markup).toContain('Liquidation Volume 30d')
		expect(markup).toContain('Collateral Liquidated 30d')
		expect(markup).toContain('Cumulative Collateral Liquidated')
		expect(markup).toContain('Base')
		expect(markup).toContain('Ethereum')
		expect(markup).toContain('$100')
		expect(markup).toContain('$20')
	})

	it('renders a zero outstanding FDV instead of treating it as unavailable', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			outstandingFDV: 0,
			tokenCGData: {
				price: { current: null, ath: null, athDate: null, atl: null, atlDate: null },
				marketCap: { current: null },
				totalSupply: null,
				fdv: { current: null },
				volume24h: { total: null, cex: null, dex: null },
				symbol: null
			}
		})

		expect(markup).toContain('Outstanding FDV')
		expect(markup).toContain('$0')
	})

	it('shows measured zero metrics without invalid percentages and retains valid positive shares', async () => {
		const tokenCGData = {
			price: { current: null, ath: null, athDate: null, atl: null, atlDate: null },
			marketCap: { current: 0 },
			totalSupply: null,
			fdv: { current: null },
			volume24h: { total: 0, cex: 0, dex: 10 },
			symbol: 'TEST'
		}
		const zeroMarkup = await renderKeyMetrics({
			...baseProps,
			currentTvlByChain: { staking: 10 },
			tokenCGData
		})

		expect(zeroMarkup).toContain('Staked')
		expect(zeroMarkup).toContain('Token Volume 24h')
		expect(zeroMarkup).not.toContain('of mcap')
		expect(zeroMarkup).not.toContain('of total')
		expect(zeroMarkup).not.toMatch(/Infinity|NaN/)

		const positiveMarkup = await renderKeyMetrics({
			...baseProps,
			currentTvlByChain: { staking: 10 },
			tokenCGData: {
				...tokenCGData,
				marketCap: { current: 100 },
				volume24h: { total: 100, cex: 90, dex: 10 }
			}
		})
		expect(positiveMarkup).toContain('10% of mcap')
		expect(positiveMarkup).toContain('10% of total')
	})

	it('shows the disclosed subtotal with mixed funding amounts and preserves the explicit-zero round', async () => {
		const raise = (date: number, amountUsd: number | null) => ({
			date,
			name: 'Gauntlet',
			round: 'Seed',
			amountUsd,
			valuationUsd: null,
			chains: ['Ethereum'],
			sector: null,
			category: null,
			categoryGroup: null,
			leadInvestors: [],
			otherInvestors: [],
			source: ''
		})
		const markup = await renderKeyMetrics({
			...baseProps,
			raises: [raise(1_700_000_000, 10_000_000), raise(1_700_086_400, null), raise(1_700_172_800, 0)]
		})

		expect(markup).toContain('Total Raised')
		expect(markup.match(/\$10m/g)).toHaveLength(2)
		expect(markup).toContain('$0')
	})

	it('uses canonical TVL availability for an Oracle secondary zero TVL row', async () => {
		const availableMarkup = await renderKeyMetrics({
			...baseProps,
			isOracleProtocol: true,
			metrics: { ...metrics, tvl: true },
			oracleTvs: { Ethereum: 10 },
			computedOracleTvs: 10,
			tvl: 0,
			tvlByChain: [],
			currentTvlByChain: {}
		})
		const unavailableMarkup = await renderKeyMetrics({
			...baseProps,
			isOracleProtocol: true,
			metrics: { ...metrics, tvl: false },
			oracleTvs: { Ethereum: 10 },
			computedOracleTvs: 10,
			tvl: 0,
			tvlByChain: [],
			currentTvlByChain: null
		})

		expect(availableMarkup).toContain('Total Value Locked')
		expect(availableMarkup).toContain('$0')
		expect(unavailableMarkup).not.toContain('Total Value Locked')
	})

	it('uses the annualized1y fees value for annualized metrics when available', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			fees: {
				total24h: null,
				total7d: null,
				total30d: 100,
				total1y: 3500,
				annualized1y: 3500,
				totalAllTime: null,
				chainBreakdown: null
			}
		})

		expect(markup).toContain('Fees (Annualized)')
		expect(markup).toContain('$3500')
		expect(markup).not.toContain('$1220')
	})

	it('renders annualized1y fees even when 30d fees are missing', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			fees: {
				total24h: null,
				total7d: null,
				total30d: null,
				total1y: 3500,
				annualized1y: 3500,
				totalAllTime: null,
				chainBreakdown: null
			}
		})

		expect(markup).toContain('Fees (Annualized)')
		expect(markup).toContain('$3500')
		expect(markup).not.toContain('Fees 30d')
	})

	it('shows a 30d run-rate fees label when using the 30d fallback value', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			fees: {
				total24h: null,
				total7d: null,
				total30d: 100,
				total1y: null,
				annualized1y: null,
				totalAllTime: null,
				chainBreakdown: null
			}
		})

		expect(markup).toContain('Fees (30d Run Rate)')
		expect(markup).not.toContain('Fees (Annualized)')
		expect(markup).toContain('$1220')
	})

	it('does not render fee rows for unavailable base periods', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			fees: {
				total24h: null,
				total7d: 70,
				total30d: null,
				total1y: null,
				annualized1y: null,
				totalAllTime: null,
				chainBreakdown: null
			}
		})

		expect(markup).toContain('Fees 7d')
		expect(markup).toContain('$70')
		expect(markup).not.toContain('Fees 24h')
		expect(markup).not.toContain('Fees 30d')
		expect(markup).not.toContain('Cumulative Fees')
		expect(markup).not.toContain('$0')
	})

	it('labels incentives as observed 1y or 30d run-rate, not annualized', async () => {
		const oneYearMarkup = await renderKeyMetrics({
			...baseProps,
			incentives: {
				emissions24h: null,
				emissions7d: null,
				emissions30d: 100,
				emissions1y: 1400,
				emissionsAllTime: null,
				emissionsMonthlyAverage1y: null
			}
		})

		expect(oneYearMarkup).toContain('Incentives 1y')
		expect(oneYearMarkup).not.toContain('Incentives (Annualized)')

		const runRateMarkup = await renderKeyMetrics({
			...baseProps,
			incentives: {
				emissions24h: null,
				emissions7d: null,
				emissions30d: 100,
				emissions1y: null,
				emissionsAllTime: null,
				emissionsMonthlyAverage1y: null
			}
		})

		expect(runRateMarkup).toContain('Incentives (30d Run Rate)')
		expect(runRateMarkup).not.toContain('Incentives (Annualized)')
	})

	it('calculates and labels annualized earnings', async () => {
		const markup = await renderKeyMetrics({
			...baseProps,
			revenue: {
				total24h: null,
				total7d: null,
				total30d: 400,
				total1y: 5000,
				annualized1y: 5000,
				totalAllTime: null,
				chainBreakdown: null
			},
			incentives: {
				emissions24h: 0,
				emissions7d: 0,
				emissions30d: 100,
				emissions1y: 1400,
				emissionsAllTime: 0,
				emissionsMonthlyAverage1y: 0
			}
		})

		expect(markup).toContain('Earnings (Annualized)')
		expect(markup).toContain('$3600')
		expect(markup).not.toContain('$3660')
	})
})
