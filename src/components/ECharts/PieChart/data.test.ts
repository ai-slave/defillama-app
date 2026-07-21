import { describe, expect, it } from 'vitest'
import { preparePieChartData } from './data'

describe('preparePieChartData', () => {
	it('converts a Record into sorted { name, value } array', () => {
		expect(
			preparePieChartData({
				data: { Ethereum: 100, Solana: 300, Arbitrum: 200 }
			})
		).toEqual([
			{ name: 'Solana', value: 300 },
			{ name: 'Arbitrum', value: 200 },
			{ name: 'Ethereum', value: 100 }
		])
	})

	it('converts an array of records using custom identifiers', () => {
		expect(
			preparePieChartData({
				data: [
					{ chain: 'Ethereum', tvl: 100 },
					{ chain: 'Solana', tvl: 50 }
				],
				sliceIdentifier: 'chain',
				sliceValue: 'tvl'
			})
		).toEqual([
			{ name: 'Ethereum', value: 100 },
			{ name: 'Solana', value: 50 }
		])
	})

	it('limits slices and merges remainder into Others', () => {
		expect(
			preparePieChartData({
				data: { A: 100, B: 50, C: 30, D: 20, E: 10 },
				limit: 3
			})
		).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'B', value: 50 },
			{ name: 'C', value: 30 },
			{ name: 'Others', value: 30 } // 20 + 10
		])
	})

	it('consolidates existing Others entry in top slices with overflow', () => {
		expect(
			preparePieChartData({
				data: { A: 100, Others: 80, C: 30, D: 20 },
				limit: 2
			})
		).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'Others', value: 130 } // existing 80 + C(30) + D(20)
		])
	})

	it('returns all slices when limit is not specified', () => {
		const result = preparePieChartData({ data: { A: 1, B: 2, C: 3 } })
		expect(result).toHaveLength(3)
	})

	it('ignores inherited enumerable fields on record input', () => {
		const inherited = Object.create({ Phantom: 99 }) as Record<string, number>
		inherited.Real = 5

		expect(preparePieChartData({ data: inherited })).toEqual([{ name: 'Real', value: 5 }])
	})

	it('normalizes numeric-string values from record-shaped JSON', () => {
		const data = { A: '10', B: '5', C: '2' } as unknown as Record<string, number>

		expect(preparePieChartData({ data, limit: 1 })).toEqual([
			{ name: 'A', value: 10 },
			{ name: 'Others', value: 7 }
		])
	})

	it('does not read inherited fields from row-shaped input', () => {
		expect(
			preparePieChartData({
				data: [{ value: 5 }],
				sliceIdentifier: 'constructor'
			})
		).toEqual([{ name: 'undefined', value: 5 }])
	})

	it('omits Others when overflow sum is 0', () => {
		const result = preparePieChartData({ data: { A: 100, B: 50 }, limit: 2 })
		expect(result).toEqual([
			{ name: 'A', value: 100 },
			{ name: 'B', value: 50 }
		])
	})
})
