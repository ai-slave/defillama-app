import { describe, expect, test } from 'vitest'
import { buildRuntimePieChartPresentation } from '~/components/ECharts/PieChart/data'
import {
	buildOraclesByChainDominanceData,
	buildOraclesByChainTableAndPieData,
	getTopMeasuredOracleProtocol
} from '../byChainData'
import type { OraclesByChainPageData } from '../types'

describe('getTopMeasuredOracleProtocol', () => {
	test('finds the largest measured TVS without depending on canonical member order', () => {
		const protocols = [
			{ name: 'First member', tvl: 10 },
			{ name: 'Unmeasured member', tvl: null },
			{ name: 'Largest member', tvl: 50 }
		]

		expect(getTopMeasuredOracleProtocol(protocols)?.name).toBe('Largest member')
		expect(getTopMeasuredOracleProtocol([{ name: 'Zero member', tvl: 0 }])?.name).toBe('Zero member')
	})
})

const tableData = [
	{
		name: 'Chainlink',
		tvl: 100,
		extraTvl: { doublecounted: 30, liquidstaking: 20, dcAndLsOverlap: 10 },
		protocolsSecured: 3,
		chains: ['Ethereum']
	},
	{
		name: 'Pyth',
		tvl: 120,
		extraTvl: {},
		protocolsSecured: 2,
		chains: ['Solana']
	}
] satisfies OraclesByChainPageData['tableData']

const extraTvlsEnabled = {
	doublecounted: true,
	liquidstaking: true
}

describe('buildOraclesByChainTableAndPieData', () => {
	test('returns original table rows when extras are disabled', () => {
		const result = buildOraclesByChainTableAndPieData({
			tableData,
			extraTvlsEnabled,
			hasEnabledExtras: false
		})

		expect(result.tableData).toBe(tableData)
		expect(buildRuntimePieChartPresentation({ series: result.pieSeries }).chartData).toEqual([
			{ name: 'Pyth', value: 120 },
			{ name: 'Chainlink', value: 100 }
		])
	})

	test('keeps unavailable TVS out of the pie without converting it to zero', () => {
		const unavailableTableData = [
			{
				name: 'Chainlink',
				tvl: null,
				extraTvl: { doublecounted: 30, liquidstaking: 20, dcAndLsOverlap: 10 },
				protocolsSecured: 3,
				chains: ['Ethereum']
			}
		] satisfies OraclesByChainPageData['tableData']
		const result = buildOraclesByChainTableAndPieData({
			tableData: unavailableTableData,
			extraTvlsEnabled,
			hasEnabledExtras: false
		})

		expect(result.tableData).toBe(unavailableTableData)
		expect(result.pieSeries.peers).toEqual([])
	})

	test('adjusts table and pie tvs with enabled extra tvl settings', () => {
		const result = buildOraclesByChainTableAndPieData({
			tableData,
			extraTvlsEnabled,
			hasEnabledExtras: true
		})

		expect(result.tableData).toEqual([
			{ ...tableData[0], tvl: 140 },
			{ ...tableData[1], tvl: 120 }
		])
		expect(buildRuntimePieChartPresentation({ series: result.pieSeries }).chartData).toEqual([
			{ name: 'Chainlink', value: 140 },
			{ name: 'Pyth', value: 120 }
		])
		expect(tableData.map(({ tvl }) => tvl)).toEqual([100, 120])
	})

	test('keeps unavailable TVS null through toggles and excludes it from pie arithmetic', () => {
		const result = buildOraclesByChainTableAndPieData({
			tableData: [
				...tableData,
				{ name: 'Unavailable', tvl: null, extraTvl: { staking: 500 }, protocolsSecured: 1, chains: [] }
			],
			extraTvlsEnabled: { staking: true },
			hasEnabledExtras: true
		})

		expect(result.tableData.at(-1)).toEqual(expect.objectContaining({ name: 'Unavailable', tvl: null }))
		expect(buildRuntimePieChartPresentation({ series: result.pieSeries }).chartData).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ name: 'Unavailable' })])
		)
	})
})

describe('buildOraclesByChainDominanceData', () => {
	test('uses base chart values while extra chart formatting is disabled or loading', () => {
		const result = buildOraclesByChainDominanceData({
			chartData: [{ timestamp: 1, Chainlink: 100, Pyth: 50 }],
			oracles: ['Chainlink', 'Pyth'],
			oraclesColors: { Chainlink: '#111', Pyth: '#222' },
			extraBreakdownsByApiKey: {
				doublecounted: [{ timestamp: 1, Chainlink: 1000 }]
			},
			extraTvlsEnabled,
			shouldApplyExtraTvlFormatting: false
		})

		expect(result.dominanceDataset).toEqual({
			dimensions: ['timestamp', 'Chainlink', 'Pyth'],
			source: [[1000, 100, 50]]
		})
	})

	test('applies extra chart breakdowns by timestamp and keeps missing extras at base tvs', () => {
		const result = buildOraclesByChainDominanceData({
			chartData: [
				{ timestamp: 1, Chainlink: 100, Pyth: 50 },
				{ timestamp: 2, Chainlink: 0, Pyth: 0 }
			],
			oracles: ['Chainlink', 'Pyth'],
			oraclesColors: { Chainlink: '#111', Pyth: '#222' },
			extraBreakdownsByApiKey: {
				doublecounted: [{ timestamp: 1, Chainlink: 30 }],
				liquidstaking: [{ timestamp: 1, Chainlink: 20, Pyth: 10 }],
				dcAndLsOverlap: [{ timestamp: 1, Chainlink: 10 }]
			},
			extraTvlsEnabled,
			shouldApplyExtraTvlFormatting: true
		})

		expect(result.dominanceDataset).toEqual({
			dimensions: ['timestamp', 'Chainlink', 'Pyth'],
			source: [
				[1000, 140, 60],
				[2000, 0, 0]
			]
		})
		expect(result.dominanceCharts).toEqual([
			{
				type: 'line',
				name: 'Chainlink',
				encode: { x: 0, y: 1 },
				color: '#111',
				stack: 'dominance'
			},
			{ type: 'line', name: 'Pyth', encode: { x: 0, y: 2 }, color: '#222', stack: 'dominance' }
		])
	})

	test('keeps absent chart measurements null while preserving explicit zero', () => {
		const result = buildOraclesByChainDominanceData({
			chartData: [{ timestamp: 1, Pyth: 0 }],
			oracles: ['Chainlink', 'Pyth'],
			oraclesColors: { Chainlink: '#111', Pyth: '#222' },
			extraBreakdownsByApiKey: {},
			extraTvlsEnabled: {},
			shouldApplyExtraTvlFormatting: false
		})

		expect(result.dominanceDataset.source).toEqual([[1000, null, 0]])
	})

	test('adds extra-only timestamps without zero-filling other Oracle gaps', () => {
		const result = buildOraclesByChainDominanceData({
			chartData: [{ timestamp: 1, Chainlink: 100 }],
			oracles: ['Chainlink', 'Pyth'],
			oraclesColors: { Chainlink: '#111', Pyth: '#222' },
			extraBreakdownsByApiKey: {
				staking: [{ timestamp: 2, Chainlink: 20 }]
			},
			extraTvlsEnabled: { staking: true },
			shouldApplyExtraTvlFormatting: true
		})

		expect(result.dominanceDataset.source).toEqual([
			[1000, 100, null],
			[2000, 20, null]
		])
	})

	test('does not create coverage from empty extra breakdown rows', () => {
		const result = buildOraclesByChainDominanceData({
			chartData: [{ timestamp: 1, Chainlink: 100 }],
			oracles: ['Chainlink'],
			oraclesColors: { Chainlink: '#111' },
			extraBreakdownsByApiKey: { staking: [{ timestamp: 2 }] },
			extraTvlsEnabled: { staking: true },
			shouldApplyExtraTvlFormatting: true
		})

		expect(result.dominanceDataset.source).toEqual([[1000, 100]])
	})
})
