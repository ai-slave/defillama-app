import { describe, expect, test } from 'vitest'
import { getPeriodCsvCells, getPeriodCsvHeaders, prepareChartCsv } from '../csv'

const toMs = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day)

describe('prepareChartCsv', () => {
	test('merges multiple series into timestamped rows', () => {
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
			'test.csv',
			'daily'
		)

		expect(result.rows).toEqual([
			['Timestamp', 'Date', 'TVL', 'Volume'],
			['1704067200000', '2024-01-01', 100, 50],
			['1704153600000', '2024-01-02', 200, 75]
		])
	})

	test('fills missing values with empty string', () => {
		const result = prepareChartCsv(
			{
				A: [[toMs(2024, 1, 1), 10]],
				B: [[toMs(2024, 1, 2), 20]]
			},
			'sparse.csv',
			'daily'
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

	test('preserves explicit null gaps instead of treating them as missing cells', () => {
		const timestamp = toMs(2024, 1, 1)
		const result = prepareChartCsv({ TVL: [[timestamp, null]] }, 'null-gap.csv', 'daily')

		expect(result.rows[1]).toEqual([timestamp.toString(), '2024-01-01', null])
	})

	test('sorts rows chronologically', () => {
		const result = prepareChartCsv(
			{
				A: [
					[toMs(2024, 1, 3), 30],
					[toMs(2024, 1, 1), 10]
				]
			},
			'sorted.csv',
			'daily'
		)

		const timestamps = result.rows.slice(1).map((r) => Number(r[0]))
		expect(timestamps).toEqual([toMs(2024, 1, 1), toMs(2024, 1, 3)])
	})
})

describe('period CSV columns', () => {
	test.each([
		['daily', ['Date'], Date.UTC(2024, 1, 29), ['2024-02-29']],
		['cumulative', ['Date'], Date.UTC(2024, 1, 29), ['2024-02-29']],
		['weekly', ['Week start', 'Week end'], Date.UTC(2027, 0, 3), ['2026-12-28', '2027-01-03']],
		['monthly', ['Month start', 'Month end'], Date.UTC(2024, 1, 15), ['2024-02-01', '2024-02-29']],
		['quarterly', ['Quarter start', 'Quarter end'], Date.UTC(2026, 10, 5), ['2026-10-01', '2026-12-31']],
		['yearly', ['Year start', 'Year end'], Date.UTC(2026, 5, 1), ['2026-01-01', '2026-12-31']]
	] as const)('names the %s period a row belongs to', (groupBy, headers, timestampMs, cells) => {
		expect(getPeriodCsvHeaders(groupBy)).toEqual(headers)
		expect(getPeriodCsvCells(timestampMs, groupBy)).toEqual(cells)
	})

	test('exports grouped overview rows with their period bounds', () => {
		const result = prepareChartCsv({ Fees: [[Date.UTC(2026, 8, 1), 30]] }, 'fees.csv', 'monthly')

		expect(result.rows).toEqual([
			['Timestamp', 'Month start', 'Month end', 'Fees'],
			[String(Date.UTC(2026, 8, 1)), '2026-09-01', '2026-09-30', 30]
		])
	})
})
