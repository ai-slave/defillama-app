import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { PageClockProvider } from '~/hooks/usePageClock'
import { definitions } from '~/public/definitions'
import {
	buildEarningsMetrics,
	buildMetrics,
	buildStandardMetricSections,
	getSharePercent,
	type IKeyMetricsProps,
	KeyMetrics
} from '../KeyMetrics'
import type { IProtocolPageMetrics } from '../types'

vi.mock('~/components/ReportIncorrectData', () => ({
	ReportIncorrectData: () => null
}))

vi.mock('~/components/KeyMetricsPngExport/KeyMetricsPngExportButton', () => ({
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
	optionsOpenInterest: false,
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
	dev: false,
	inflows: false,
	activeUsers: false,
	newUsers: false,
	txCount: false,
	gasUsed: false,
	liquidationVolume: false,
	collateralLiquidated: false,
	borrowed: false,
	tokenRights: false,
	rwa: false,
	cryptoCards: false
}

const renderKeyMetrics = async (props: IKeyMetricsProps) =>
	renderToStaticMarkup(
		<PageClockProvider pageClockSec={1_700_000_000}>
			<KeyMetrics {...props} />
		</PageClockProvider>
	)
const visibleText = (markup: string) =>
	markup
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
const rows = (built: ReturnType<typeof buildMetrics>) =>
	built.map(({ name, value, chainBreakdown }) => ({
		name,
		value,
		chains: chainBreakdown ? Object.entries(chainBreakdown) : null
	}))

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
	test('builds fee rows with chain values sorted by size', () => {
		const fees = {
			total24h: null,
			total7d: null,
			total30d: 300,
			total1y: null,
			annualized1y: null,
			totalAllTime: null,
			chainBreakdown: {
				Ethereum: { total24h: 4, total7d: 28, total30d: 120, totalAllTime: 700 },
				Base: { total24h: 8, total7d: 42, total30d: 180, totalAllTime: 800 }
			}
		}

		expect(rows(buildMetrics(fees, definitions.fees.protocol, 'Fees', false, fees.chainBreakdown))).toEqual([
			{
				name: 'Fees 30d',
				value: 300,
				chains: [
					['Base', 180],
					['Ethereum', 120]
				]
			}
		])
	})

	test('does not repeat StableJack perp volume after promoting it to the primary metric', async () => {
		const perpVolume = {
			total24h: 2000,
			total7d: 14_000,
			total30d: 68_290,
			total1y: null,
			annualized1y: null,
			totalAllTime: 100_000,
			chainBreakdown: null
		}

		expect(await renderKeyMetrics({ ...baseProps, name: 'Gauntlet', perpVolume })).toContain('Perp Volume 30d')
		expect(await renderKeyMetrics({ ...baseProps, name: 'StableJack', perpVolume })).not.toContain('Perp Volume 30d')
	})

	test('builds liquidation sections like other standard adapter metrics', () => {
		const summary = (total30d: number, totalAllTime: number) => ({
			total24h: null,
			total7d: null,
			total30d,
			total1y: null,
			annualized1y: null,
			totalAllTime,
			chainBreakdown: null
		})
		const sections = buildStandardMetricSections(
			{ ...baseProps, liquidationVolume: summary(300, 1500), collateralLiquidated: summary(120, 700) },
			undefined
		)

		expect(sections.map((section) => ({ dataType: section.dataType, rows: rows(section.metrics) }))).toEqual([
			{
				dataType: 'Liquidation Volume',
				rows: [
					{ name: 'Liquidation Volume 30d', value: 300, chains: null },
					{ name: 'Cumulative Liquidation Volume', value: 1500, chains: null }
				]
			},
			{
				dataType: 'Collateral Liquidated',
				rows: [
					{ name: 'Collateral Liquidated 30d', value: 120, chains: null },
					{ name: 'Cumulative Collateral Liquidated', value: 700, chains: null }
				]
			}
		])
	})

	test('renders a zero outstanding FDV instead of treating it as unavailable', async () => {
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

		expect(visibleText(markup)).toBe('Key Metrics Outstanding FDV $0')
	})

	test('omits shares of a zero or missing total instead of showing Infinity% or NaN%', () => {
		expect(getSharePercent(10, 0)).toBeNull()
		expect(getSharePercent(10, null)).toBeNull()
		expect(getSharePercent(null, 100)).toBeNull()
		expect(getSharePercent(10, 100)).toBe(10)
	})

	test('shows the disclosed subtotal with mixed funding amounts and preserves the explicit-zero round', async () => {
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

		expect(visibleText(markup)).toBe(
			'Key Metrics Total Raised $10m Nov 14, 2023 $10m Round: Seed Nov 15, 2023 Round: Seed Nov 16, 2023 $0 Round: Seed'
		)
	})

	test('uses canonical TVL availability for an Oracle secondary zero TVL row', async () => {
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

	test('does not build fee rows for unavailable base periods', () => {
		const fees = {
			total24h: null,
			total7d: 70,
			total30d: null,
			total1y: null,
			annualized1y: null,
			totalAllTime: null,
			chainBreakdown: null
		}

		expect(rows(buildMetrics(fees, definitions.fees.protocol, 'Fees'))).toEqual([
			{ name: 'Fees 7d', value: 70, chains: null }
		])
	})

	test('labels incentives as observed 1y, or a 30d run rate when 1y is missing', () => {
		const incentives = (emissions1y: number | null) => ({
			emissions24h: null,
			emissions7d: null,
			emissions30d: 100,
			emissions1y,
			emissionsAllTime: null,
			emissionsMonthlyAverage1y: null
		})
		const build = (emissions1y: number | null) =>
			rows(buildMetrics(incentives(emissions1y), definitions.incentives.protocol, 'Incentives', true))

		expect(build(1400)).toEqual([
			{ name: 'Incentives 1y', value: 1400, chains: null },
			{ name: 'Incentives 30d', value: 100, chains: null }
		])
		expect(build(null)).toEqual([
			{ name: 'Incentives (30d Run Rate)', value: 100 * 12.2, chains: null },
			{ name: 'Incentives 30d', value: 100, chains: null }
		])
	})

	test('annualizes earnings from observed 1y incentives, not the 30d run rate', () => {
		const earnings = buildEarningsMetrics(
			{
				total24h: null,
				total7d: null,
				total30d: 400,
				total1y: 5000,
				annualized1y: 5000,
				totalAllTime: null,
				chainBreakdown: null
			},
			{
				emissions24h: 0,
				emissions7d: 0,
				emissions30d: 100,
				emissions1y: 1400,
				emissionsAllTime: 0,
				emissionsMonthlyAverage1y: 0
			}
		)

		expect(rows(earnings)).toEqual([
			{ name: 'Earnings (Annualized)', value: 3600, chains: null },
			{ name: 'Earnings 30d', value: 300, chains: null }
		])
	})
})
