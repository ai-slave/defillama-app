import { describe, expect, test } from 'vitest'
import {
	buildExtraTvlCharts,
	buildTvlChart,
	buildUsdInflowsFromTvlChart,
	getProtocolExtraTvlChartFetchState,
	getSelectedProtocolExtraTvlKeys
} from '../tvlChart'

const DAY = 24 * 60 * 60

const toMs = (timestampSec: number) => timestampSec * 1e3

describe('ProtocolOverview TVL chart helpers', () => {
	test('keeps valid staking and borrowed standalone fetch behavior separate from composite-only extras', () => {
		expect(
			getProtocolExtraTvlChartFetchState({
				isRouterReady: true,
				currentTvlByChain: {
					staking: 1,
					borrowed: 1,
					pool2: 1,
					vesting: 1
				},
				tvlSettings: {
					staking: true,
					borrowed: true,
					pool2: true,
					vesting: true
				},
				needsCompositeTvlChart: false,
				isStakingTvlToggled: true,
				isBorrowedTvlToggled: true
			})
		).toEqual({
			staking: true,
			borrowed: true,
			pool2: false,
			vesting: false
		})
	})

	test('requires composite TVL, enabled settings, and current TVL keys for non-standalone extras', () => {
		expect(
			getProtocolExtraTvlChartFetchState({
				isRouterReady: true,
				currentTvlByChain: {
					staking: 1,
					borrowed: 1,
					pool2: 1,
					vesting: 1
				},
				tvlSettings: {
					staking: true,
					borrowed: true,
					pool2: true,
					vesting: true
				},
				needsCompositeTvlChart: true,
				isStakingTvlToggled: false,
				isBorrowedTvlToggled: false
			})
		).toEqual({
			staking: true,
			borrowed: true,
			pool2: true,
			vesting: true
		})
	})

	test('keeps grouped points ordered and retains the last base point in a bucket', () => {
		const firstDay = Date.UTC(2026, 0, 1) / 1e3
		expect(
			buildTvlChart({
				tvlChartData: [
					[firstDay + 1, 100],
					[firstDay + 2, 110],
					[firstDay + DAY + 2, 220]
				],
				extraTvlCharts: buildExtraTvlCharts({
					staking: [
						[firstDay + 1, 0],
						[firstDay + 2, 0],
						[firstDay + DAY + 2, 0]
					]
				}),
				selectedExtraTvls: ['staking'],
				groupBy: 'daily',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(firstDay), 110],
			[toMs(firstDay + DAY), 220]
		])
	})

	test('resolves selected extra charts from settings and the protocol current-TVL keys', () => {
		expect(
			getSelectedProtocolExtraTvlKeys({ staking: true, pool2: true, borrowed: true }, { staking: 1, pool2: 1 })
		).toEqual(['staking', 'pool2'])
	})

	test('adds only the already-resolved extra charts', () => {
		const extraTvlCharts = buildExtraTvlCharts({
			staking: [
				[DAY, 10],
				[DAY * 2, 20]
			],
			pool2: [
				[DAY, 50],
				[DAY * 2, 60]
			],
			borrowed: [
				[DAY, 5],
				[DAY * 2, 6]
			]
		})

		expect(
			buildTvlChart({
				tvlChartData: [
					[DAY, 100],
					[DAY * 2, 200]
				],
				extraTvlCharts,
				selectedExtraTvls: ['staking', 'pool2'],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(DAY), 160],
			[toMs(DAY * 2), 280]
		])
	})

	test('aligns the latest base TVL timestamp to a nearby latest extra TVL timestamp', () => {
		const shiftedLatestTimestamp = DAY * 2 + 60 * 60
		const extraTvlCharts = buildExtraTvlCharts({
			staking: [
				[DAY, 10],
				[shiftedLatestTimestamp, 20]
			]
		})

		expect(
			buildTvlChart({
				tvlChartData: [
					[DAY, 100],
					[DAY * 2, 200]
				],
				extraTvlCharts,
				selectedExtraTvls: ['staking'],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(DAY), 110],
			[toMs(shiftedLatestTimestamp), 220]
		])
	})

	test('accepts latest extra TVL alignment exactly one day from the base', () => {
		const exactBoundaryTimestamp = DAY * 3
		const extraTvlCharts = buildExtraTvlCharts({
			staking: [
				[DAY, 10],
				[exactBoundaryTimestamp, 20]
			]
		})

		expect(
			buildTvlChart({
				tvlChartData: [
					[DAY, 100],
					[DAY * 2, 200]
				],
				extraTvlCharts,
				selectedExtraTvls: ['staking'],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(DAY), 110],
			[toMs(exactBoundaryTimestamp), 220]
		])
	})

	test('marks a required latest extra missing and does not manufacture inflow when it is over one day away', () => {
		const extraTvlCharts = buildExtraTvlCharts({
			staking: [
				[DAY, 10],
				[DAY * 3 + 1, 20]
			]
		})

		const chart = buildTvlChart({
			tvlChartData: [
				[DAY, 100],
				[DAY * 2, 200]
			],
			extraTvlCharts,
			selectedExtraTvls: ['staking'],
			groupBy: 'cumulative',
			denominationPriceHistory: null
		})

		expect(chart).toEqual([
			[toMs(DAY), 110],
			[toMs(DAY * 2), null]
		])
		expect(buildUsdInflowsFromTvlChart(chart)).toEqual([])
	})

	test('marks required points missing when a populated extra is too old', () => {
		const chart = buildTvlChart({
			tvlChartData: [
				[DAY * 2, 100],
				[DAY * 3 + 1, 200]
			],
			extraTvlCharts: buildExtraTvlCharts({ staking: [[DAY, 20]] }),
			selectedExtraTvls: ['staking'],
			groupBy: 'cumulative',
			denominationPriceHistory: null
		})

		expect(chart).toEqual([
			[toMs(DAY * 2), null],
			[toMs(DAY * 3 + 1), null]
		])
	})

	test('distinguishes an unavailable required extra from a successful empty extra', () => {
		const input: Omit<Parameters<typeof buildTvlChart>[0], 'extraTvlCharts'> = {
			tvlChartData: [
				[DAY, 100],
				[DAY * 2, 200]
			] as Array<[number, number]>,
			selectedExtraTvls: ['staking'],
			groupBy: 'cumulative' as const,
			denominationPriceHistory: null
		}

		expect(buildTvlChart({ ...input, extraTvlCharts: buildExtraTvlCharts({}) })).toEqual([
			[toMs(DAY), null],
			[toMs(DAY * 2), null]
		])
		expect(buildTvlChart({ ...input, extraTvlCharts: buildExtraTvlCharts({ staking: [] }) })).toEqual([
			[toMs(DAY), 100],
			[toMs(DAY * 2), 200]
		])
	})

	test('preserves exact zero extra values', () => {
		expect(
			buildTvlChart({
				tvlChartData: [
					[DAY, 100],
					[DAY * 2, 200]
				],
				extraTvlCharts: buildExtraTvlCharts({
					staking: [
						[DAY, 0],
						[DAY * 2, 0]
					]
				}),
				selectedExtraTvls: ['staking'],
				groupBy: 'cumulative',
				denominationPriceHistory: null
			})
		).toEqual([
			[toMs(DAY), 100],
			[toMs(DAY * 2), 200]
		])
	})

	test('drops denominated points only when denomination history exists and lacks the retained timestamp rate', () => {
		const extraTvlCharts = buildExtraTvlCharts({
			staking: [
				[DAY, 10],
				[DAY * 2, 20]
			]
		})
		const input: Omit<Parameters<typeof buildTvlChart>[0], 'denominationPriceHistory'> = {
			tvlChartData: [
				[DAY, 100],
				[DAY * 2, 200]
			] as Array<[number, number]>,
			extraTvlCharts,
			selectedExtraTvls: ['staking'],
			groupBy: 'cumulative' as const
		}

		expect(buildTvlChart({ ...input, denominationPriceHistory: { [String(DAY)]: 10 } })).toEqual([[toMs(DAY), 11]])
		expect(buildTvlChart({ ...input, denominationPriceHistory: null })).toEqual([
			[toMs(DAY), 110],
			[toMs(DAY * 2), 220]
		])
	})

	test('derives USD inflows from adjacent non-null TVL chart points', () => {
		expect(
			buildUsdInflowsFromTvlChart([
				[toMs(DAY), 100],
				[toMs(DAY * 2), 130],
				[toMs(DAY * 3), null],
				[toMs(DAY * 4), 160]
			])
		).toEqual([[DAY * 2, 30]])
	})
})
