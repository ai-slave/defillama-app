import { describe, expect, test } from 'vitest'
import {
	buildAdapterProtocolBreakdownApiUrl,
	breakdownSplitQueryValue,
	buildProtocolBreakdownChartPresentation,
	resolveBreakdownSplit
} from '../ProtocolChart'

const toSeconds = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day) / 1e3
const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('buildProtocolBreakdownChartPresentation', () => {
	test('keeps sparse values dense while preserving zeroes after a series begins', () => {
		const presentation = buildProtocolBreakdownChartPresentation({
			data: [
				[toSeconds(2024, 1, 1), { A: 0 }],
				[toSeconds(2024, 1, 2), { A: 5 }],
				[toSeconds(2024, 1, 3), { A: 0, B: 2 }]
			],
			seriesNames: ['A', 'B'],
			chartInterval: 'daily'
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'A', 'B'],
			source: [
				[toMs(2024, 1, 1), null, null],
				[toMs(2024, 1, 2), 5, null],
				[toMs(2024, 1, 3), 0, 2]
			]
		})
		expect(presentation.charts).toEqual([
			expect.objectContaining({ name: 'A', encode: { x: 0, y: 1 }, color: expect.any(String) }),
			expect.objectContaining({ name: 'B', encode: { x: 0, y: 2 }, color: expect.any(String) })
		])
	})

	test('sorts cumulative buckets and addresses a series named timestamp by position', () => {
		const presentation = buildProtocolBreakdownChartPresentation({
			data: [
				[toSeconds(2024, 1, 2), { timestamp: 3 }],
				[toSeconds(2024, 1, 1), { timestamp: 2 }]
			],
			seriesNames: ['timestamp'],
			chartInterval: 'cumulative'
		})

		expect(presentation.dataset).toEqual({
			dimensions: ['timestamp', 'timestamp'],
			source: [
				[toMs(2024, 1, 1), 2],
				[toMs(2024, 1, 2), 5]
			]
		})
		expect(presentation.charts).toEqual([
			expect.objectContaining({ type: 'line', name: 'timestamp', encode: { x: 0, y: 1 } })
		])
	})
})

describe('buildAdapterProtocolBreakdownApiUrl', () => {
	test('omits the dataType query parameter when it is absent', () => {
		const url = buildAdapterProtocolBreakdownApiUrl({
			adapterType: 'fees',
			protocol: 'Example Protocol',
			type: 'chain'
		})

		expect(url).toBe(
			'/api/public/protocols/charts?kind=adapter-breakdown&adapterType=fees&protocol=Example+Protocol&type=chain'
		)
		expect(url).not.toContain('dataType')
	})
})

describe('resolveBreakdownSplit', () => {
	const splits = [
		{ type: 'chain' as const, names: ['Ethereum'] },
		{ type: 'version' as const, names: ['V1', 'V2'] },
		{ type: 'label' as const, names: ['Perp Fees', 'Spot Fees'] }
	]

	test('offers only splits with more than one series and opens on the first of them', () => {
		const { options, split } = resolveBreakdownSplit(splits, undefined)
		expect(options.map((option) => option.type)).toEqual(['version', 'label'])
		expect(split?.type).toBe('version')
	})

	test('reopens each picked split from the URL value its pick writes, and writes nothing for the default', () => {
		const { options } = resolveBreakdownSplit(splits, undefined)
		expect(breakdownSplitQueryValue(options, 'version')).toBeUndefined()
		for (const type of ['version', 'label'] as const) {
			expect(resolveBreakdownSplit(splits, breakdownSplitQueryValue(options, type)).split?.type).toBe(type)
		}
	})

	test('opens the default for a split it does not offer or a repeated param', () => {
		expect(resolveBreakdownSplit(splits, 'chain').split?.type).toBe('version')
		expect(resolveBreakdownSplit(splits, ['label', 'version']).split?.type).toBe('version')
	})

	test('has no split when every split has one series or none', () => {
		expect(resolveBreakdownSplit([{ type: 'chain', names: ['Ethereum'] }], 'chain').split).toBeUndefined()
	})
})
