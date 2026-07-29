import { describe, expect, it } from 'vitest'
import { prepareChartCsv } from './csv'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('prepareChartCsv', () => {
	it('merges multiple series into timestamped rows', () => {
		const result = prepareChartCsv(
			{
				TVL: [
					[toMs(2024, 1, 1), 100],
					[toMs(2024, 1, 2), 200]
				],
				Volume: [
					[toMs(2024, 1, 1), 50],
					[toMs(2024, 1, 2), 75]
				]
			},
			'test.csv'
		)

		expect(result.filename).toBe('test.csv')
		expect(result.rows[0]).toEqual(['Timestamp', 'Date', 'TVL', 'Volume'])
		expect(result.rows).toHaveLength(3) // header + 2 data rows
	})

	it('fills missing values with empty string', () => {
		const result = prepareChartCsv(
			{
				A: [[toMs(2024, 1, 1), 10]],
				B: [[toMs(2024, 1, 2), 20]]
			},
			'sparse.csv'
		)

		const dataRows = result.rows.slice(1)
		// timestamps become string object keys in dateStore
		const row1 = dataRows.find((r) => String(r[0]) === String(toMs(2024, 1, 1)))
		const row2 = dataRows.find((r) => String(r[0]) === String(toMs(2024, 1, 2)))

		expect(row1?.[2]).toBe(10) // A column
		expect(row1?.[3]).toBe('') // B column missing
		expect(row2?.[2]).toBe('') // A column missing
		expect(row2?.[3]).toBe(20) // B column
	})

	it('preserves explicit null gaps instead of treating them as missing cells', () => {
		const timestamp = toMs(2024, 1, 1)
		const result = prepareChartCsv({ TVL: [[timestamp, null]] }, 'null-gap.csv')

		expect(result.rows[1]).toEqual([timestamp.toString(), '2024-01-01', null])
	})

	it('sorts rows chronologically', () => {
		const result = prepareChartCsv(
			{
				A: [
					[toMs(2024, 1, 3), 30],
					[toMs(2024, 1, 1), 10]
				]
			},
			'sorted.csv'
		)

		const timestamps = result.rows.slice(1).map((r) => Number(r[0]))
		expect(timestamps).toEqual([toMs(2024, 1, 1), toMs(2024, 1, 3)])
	})
})
