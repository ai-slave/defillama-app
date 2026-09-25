import { describe, expect, test } from 'vitest'
import { sumRwaFlowSplit } from '../flowSplit'

describe('sumRwaFlowSplit', () => {
	test('sums every group of a row into one net flow with full coverage', () => {
		expect(
			sumRwaFlowSplit([
				{ timestamp: 1, Bonds: 100, 'Precious Metals': -40 },
				{ timestamp: 2, Bonds: 5, 'Precious Metals': 5, 'Private Credit': 10 }
			])
		).toEqual([
			{ timestamp: 1, netFlowUsd: 60, coverage: 1 },
			{ timestamp: 2, netFlowUsd: 20, coverage: 1 }
		])
	})

	test('keeps a row with no group as null with zero coverage', () => {
		expect(sumRwaFlowSplit([{ timestamp: 1 }, { timestamp: 2, Bonds: 0 }])).toEqual([
			{ timestamp: 1, netFlowUsd: null, coverage: 0 },
			{ timestamp: 2, netFlowUsd: 0, coverage: 1 }
		])
	})

	// A split point can carry null for a group with no value on that day.
	test('skips null group values without dropping the row', () => {
		expect(
			sumRwaFlowSplit([
				{ timestamp: 1, Bonds: null as unknown as number, 'Precious Metals': 7 },
				{ timestamp: 2, Bonds: null as unknown as number }
			])
		).toEqual([
			{ timestamp: 1, netFlowUsd: 7, coverage: 1 },
			{ timestamp: 2, netFlowUsd: null, coverage: 0 }
		])
	})
})
