import { describe, expect, test } from 'vitest'
import {
	citedRowDate,
	findCitedCell,
	formatCellValue,
	formatDateValue,
	formatMetricValue,
	formatOutputValue,
	humanizeColumn,
	parseRefNumber
} from './citationPillHelpers'

describe('formatCellValue', () => {
	test('groups large integers with thousands separators', () => {
		expect(formatCellValue(11_814_381_045)).toBe('11,814,381,045')
	})

	test('trims and rounds large floats to an integer with grouping', () => {
		expect(formatCellValue(Number('11814381044.867093220099'))).toBe('11,814,381,045')
	})

	test('keeps mid-magnitude floats readable with 2 decimals', () => {
		expect(formatCellValue(12.3456)).toBe('12.35')
	})

	test('keeps small decimals readable with up to 4 decimals', () => {
		expect(formatCellValue(0.8111111)).toBe('0.8111')
	})

	test('parses numeric strings', () => {
		expect(formatCellValue('9626500437.66')).toBe('9,626,500,438')
	})

	test('passes non-numeric strings through', () => {
		expect(formatCellValue('aave')).toBe('aave')
	})

	test('renders null and undefined as an em dash', () => {
		expect(formatCellValue(null)).toBe('—')
		expect(formatCellValue(undefined)).toBe('—')
	})

	test('renders empty string as an em dash', () => {
		expect(formatCellValue('   ')).toBe('—')
	})

	test('handles non-finite numbers', () => {
		expect(formatCellValue(Number.NaN)).toBe('NaN')
		expect(formatCellValue(Infinity)).toBe('Infinity')
	})
})

describe('parseRefNumber', () => {
	test('strips currency, commas and B suffix', () => {
		expect(parseRefNumber('$11.81B')).toBeCloseTo(11_810_000_000, 0)
	})

	test('handles M and K suffixes', () => {
		expect(parseRefNumber('$5.2M')).toBeCloseTo(5_200_000, 0)
		expect(parseRefNumber('3.5K')).toBeCloseTo(3500, 0)
	})

	test('returns null for non-numeric input', () => {
		expect(parseRefNumber('lending')).toBeNull()
		expect(parseRefNumber('Uniswap V3')).toBeNull()
		expect(parseRefNumber('1inch')).toBeNull()
		expect(parseRefNumber('2024-05-01')).toBeNull()
		expect(parseRefNumber(null)).toBeNull()
	})

	test('parses negative currency strings', () => {
		expect(parseRefNumber('-$2.5M')).toBeCloseTo(-2_500_000, 0)
	})
})

describe('findCitedCell', () => {
	const rows = [
		{ protocol: 'aave', tvl_base: Number('11814381044.867093'), tvl_borrowed: 9_626_500_437.66 },
		{ protocol: 'compound', tvl_base: 2_000_000_000, tvl_borrowed: 500_000_000 }
	]
	const columns = ['protocol', 'tvl_base', 'tvl_borrowed']

	test('prefers the explicit field + rowIndex binding', () => {
		expect(findCitedCell(rows, columns, { field: 'tvl_borrowed', rowIndex: 0 })).toEqual({
			rowIndex: 0,
			column: 'tvl_borrowed'
		})
	})

	test('matches by value when no binding is present', () => {
		expect(findCitedCell(rows, columns, { value: '$11.81B' })).toEqual({
			rowIndex: 0,
			column: 'tvl_base'
		})
	})

	test('returns the first match when multiple cells match the value', () => {
		const dupRows = [
			{ a: 100, b: 200 },
			{ a: 100, b: 300 }
		]
		expect(findCitedCell(dupRows, ['a', 'b'], { value: '100' })).toEqual({ rowIndex: 0, column: 'a' })
	})

	test('uses a partial field binding before scanning unrelated columns', () => {
		const rankedRows = [
			{ rank: 5, apy: 1 },
			{ rank: 1, apy: 5 }
		]
		expect(findCitedCell(rankedRows, ['rank', 'apy'], { field: 'apy', value: '5' })).toEqual({
			rowIndex: 1,
			column: 'apy'
		})
	})

	test('does not treat date strings as numeric fallback matches', () => {
		expect(findCitedCell([{ date: '2024-05-01' }], ['date'], { value: '2024' })).toBeNull()
	})

	test('returns null when nothing matches', () => {
		expect(findCitedCell(rows, columns, { value: '$999B' })).toBeNull()
	})

	test('returns null for empty rows', () => {
		expect(findCitedCell([], columns, { field: 'tvl_base', rowIndex: 0 })).toBeNull()
		expect(findCitedCell(undefined, columns, { value: '100' })).toBeNull()
	})

	test('ignores an out-of-range or unknown binding and falls back to value match', () => {
		expect(findCitedCell(rows, columns, { field: 'missing_col', rowIndex: 0, value: '$11.81B' })).toEqual({
			rowIndex: 0,
			column: 'tvl_base'
		})
		expect(findCitedCell(rows, columns, { field: 'tvl_base', rowIndex: 99, value: '$11.81B' })).toEqual({
			rowIndex: 0,
			column: 'tvl_base'
		})
	})

	test('prefers the cell the claim rounds to exactly over an earlier 0.1%-tolerance collision', () => {
		const series = [
			{ date: '2024-11-14', spot_volume: 86_690_921_247, derivative_volume: 343_167_275_331 },
			{ date: '2026-07-05', spot_volume: 8_806_528_030, derivative_volume: 86_609_169_904 }
		]
		expect(findCitedCell(series, ['date', 'spot_volume', 'derivative_volume'], { value: '$86.61B' })).toEqual({
			rowIndex: 1,
			column: 'derivative_volume'
		})
	})

	test('anchors an exact value duplicated on two dates to the most recent one', () => {
		const series = [
			{ date: '2025-04-03', volume: 10_650_286_797 },
			{ date: '2026-07-05', volume: 10_650_286_797 }
		]
		expect(findCitedCell(series, ['date', 'volume'], { value: '$10.65B' })).toEqual({
			rowIndex: 1,
			column: 'volume'
		})
	})

	test('without a date column the closest value wins, not the first within tolerance', () => {
		const flat = [
			{ protocol: 'aaa', tvl: 3_853_900_000 },
			{ protocol: 'bbb', tvl: 3_850_900_000 }
		]
		expect(findCitedCell(flat, ['protocol', 'tvl'], { value: '$3.85B' })).toEqual({
			rowIndex: 1,
			column: 'tvl'
		})
	})
})

describe('formatDateValue', () => {
	test('formats ISO date strings in UTC', () => {
		expect(formatDateValue('2025-10-06')).toBe('Oct 6, 2025')
		expect(formatDateValue('2025-10-06T12:30:00Z')).toBe('Oct 6, 2025')
		expect(formatDateValue('2025-10-06 12:30:00')).toBe('Oct 6, 2025')
		expect(formatDateValue('2025-10-06T12:30:00')).toBe('Oct 6, 2025')
	})

	test('formats epoch seconds and milliseconds', () => {
		expect(formatDateValue(1_759_708_800)).toBe('Oct 6, 2025')
		expect(formatDateValue(1_759_708_800_000)).toBe('Oct 6, 2025')
	})

	test('returns null for unparseable or empty input', () => {
		expect(formatDateValue('not a date')).toBeNull()
		expect(formatDateValue('')).toBeNull()
		expect(formatDateValue(null)).toBeNull()
		expect(formatDateValue(undefined)).toBeNull()
	})
})

describe('citedRowDate', () => {
	test('reads the date column of the cited row', () => {
		const row = { protocol: 'btc', date: '2025-10-06', price: 124_774 }
		expect(citedRowDate(row, ['protocol', 'date', 'price'])).toBe('Oct 6, 2025')
	})

	test('prefers the period column over loaded_at-style ingestion columns', () => {
		const row = { ts: '2025-10-06', as_of: '2026-06-16', price: 124_774 }
		expect(citedRowDate(row, ['ts', 'as_of', 'price'])).toBe('Oct 6, 2025')
	})

	test('returns null when there is no date column', () => {
		expect(citedRowDate({ protocol: 'btc', price: 124_774 }, ['protocol', 'price'])).toBeNull()
		expect(citedRowDate(undefined, ['date'])).toBeNull()
	})
})

describe('formatMetricValue', () => {
	test('prefixes USD metrics and abbreviates large magnitudes', () => {
		expect(formatMetricValue('price', 61_537)).toBe('$61,537')
		expect(formatMetricValue('mcap', 1_233_518_998_762)).toBe('$1.23T')
		expect(formatMetricValue('volume', 31_154_779_205)).toBe('$31.15B')
		expect(formatMetricValue('price_ath', 126_156)).toBe('$126,156')
		expect(formatMetricValue('fees_30d', 5_200_000)).toBe('$5.2M')
	})

	test('handles negative USD values', () => {
		expect(formatMetricValue('revenue', -2_500_000)).toBe('-$2.5M')
	})

	test('suffixes already-percent metrics without scaling', () => {
		expect(formatMetricValue('pct_from_ath', -51.22)).toBe('-51.22%')
		expect(formatMetricValue('apy_base', 2.32)).toBe('2.32%')
	})

	test('scales decimal pct_change columns to percent', () => {
		expect(formatMetricValue('tvl_30d_pct_change', -0.1322)).toBe('-13.22%')
	})

	test('treats windowed _pct aliases as already ×100 in SQL, without re-scaling', () => {
		expect(formatMetricValue('tvl_30d_pct', 34.28)).toBe('34.28%')
		expect(formatMetricValue('tvl_7d_pct', -1.91)).toBe('-1.91%')
		expect(formatMetricValue('mcap_7d_pct', 5)).toBe('5%')
	})

	test('scales top-10 holder concentration from a 0–1 decimal to percent', () => {
		expect(formatMetricValue('top10_pct', 1)).toBe('100%')
		expect(formatMetricValue('top10_pct', 0.945)).toBe('94.5%')
	})

	test('formats date columns', () => {
		expect(formatMetricValue('price_ath_ts', '2025-10-06T18:59:01.000Z')).toBe('Oct 6, 2025')
	})

	test('groups counts as integers and ratios with a multiplier sign', () => {
		expect(formatMetricValue('protocol_count', 1234)).toBe('1,234')
		expect(formatMetricValue('pf_ratio', 2.5)).toBe('2.5×')
	})

	test('passes through non-numeric and unknown plain values', () => {
		expect(formatMetricValue('name', 'aave')).toBe('aave')
		expect(formatMetricValue('some_unknown_field', 42)).toBe('42')
	})
})

describe('formatOutputValue (execute_code datapoints)', () => {
	test('appends % to already-scaled pct/rate/share keys without re-scaling', () => {
		expect(formatOutputValue('drawdown_pct', '-26.9')).toBe('-26.9%')
		expect(formatOutputValue('utilization_rate', '79.8')).toBe('79.8%')
	})
	test('formats date keys', () => {
		expect(formatOutputValue('peak_date', '2026-03-14')).toBe('Mar 14, 2026')
	})
	test('groups plain numeric output values', () => {
		expect(formatOutputValue('peak_tvl', 12_218_356_119)).toBe('12,218,356,119')
	})
})

describe('humanizeColumn', () => {
	test('replaces underscores and title-cases', () => {
		expect(humanizeColumn('tvl_base')).toBe('Tvl Base')
		expect(humanizeColumn('protocol')).toBe('Protocol')
	})

	test('leaves already-spaced names sensibly cased', () => {
		expect(humanizeColumn('total value')).toBe('Total Value')
	})
})
