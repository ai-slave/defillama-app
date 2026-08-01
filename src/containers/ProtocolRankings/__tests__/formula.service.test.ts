import { describe, expect, it } from 'vitest'
import { parseCustomColumns } from '~/contexts/LocalStorage'
import { parseProtocolTableColumnVisibility, replaceAliases, sampleProtocol } from '../customColumnsUtils'
import { evaluateFormula, formatCustomColumnValue, getSortableValue } from '../formula.service'

describe('protocol ranking custom formulas', () => {
	it('maps public aliases to the actual ranking read-model fields', () => {
		const formula = replaceAliases('average_fees_1y + average_revenue_1y')

		expect(formula).toBe('fees_monthlyAverage1y + revenue_monthlyAverage1y')
		expect(evaluateFormula(formula, sampleProtocol)).toEqual({
			status: 'success',
			value: (sampleProtocol.fees?.monthlyAverage1y ?? 0) + (sampleProtocol.revenue?.monthlyAverage1y ?? 0)
		})
	})

	it('preserves zero and boolean formula results while leaving missing variables blank', () => {
		expect(evaluateFormula('tvl_default_tvl - tvl_default_tvl', sampleProtocol)).toEqual({
			status: 'success',
			value: 0
		})
		expect(evaluateFormula('tvl_default_tvl > 0', sampleProtocol)).toEqual({ status: 'success', value: true })
		expect(evaluateFormula('strikeTvl', sampleProtocol)).toEqual({ status: 'success', value: true })
		expect(evaluateFormula('missing_metric + 1', sampleProtocol)).toEqual({ status: 'missing' })
	})

	it.each(['tvl_default_tvl +', '1 / 0', 'sqrt(-1)', '[1, 2]', '{}'])(
		'returns a typed error for invalid or unsupported formula result: %s',
		(formula) => {
			const result = evaluateFormula(formula, sampleProtocol)

			expect(result.status).toBe('error')
			if (result.status === 'error') expect(result.error).toEqual(expect.any(String))
		}
	)

	it('accepts finite number, string, and boolean leaves only', () => {
		expect(evaluateFormula('42', sampleProtocol)).toEqual({ status: 'success', value: 42 })
		expect(evaluateFormula("'ready'", sampleProtocol)).toEqual({ status: 'success', value: 'ready' })
		expect(evaluateFormula('strikeTvl', sampleProtocol)).toEqual({ status: 'success', value: true })
	})

	it('keeps null and zero distinct in formatting and sorting', () => {
		expect(formatCustomColumnValue(0, 'number')).toBe('0')
		expect(getSortableValue(0, 'number')).toBe(0)
		expect(getSortableValue('0', 'number')).toBe(0)
		expect(getSortableValue('not-a-number', 'number')).toBeNull()
		expect(getSortableValue(false, 'boolean')).toBe(false)
		expect(getSortableValue('false', 'boolean')).toBeNull()
	})
})

describe('custom column storage boundary', () => {
	it('keeps only entries with required strings and supported format enums', () => {
		expect(
			parseCustomColumns([
				{ name: 'Ratio', formula: 'mcap / tvl', formatType: 'number', determinedFormat: 'percent' },
				{ name: 'Missing formula', formatType: 'number' },
				{ name: 1, formula: 'mcap', formatType: 'usd' },
				{ name: 'Bad format', formula: 'mcap', formatType: 'currency' },
				{ name: 'Bad determined format', formula: 'mcap', formatType: 'auto', determinedFormat: 'auto' },
				null
			])
		).toEqual([{ name: 'Ratio', formula: 'mcap / tvl', formatType: 'number', determinedFormat: 'percent' }])
	})

	it('discards malformed roots', () => {
		expect(parseCustomColumns(null)).toEqual([])
		expect(parseCustomColumns({ name: 'Ratio' })).toEqual([])
		expect(parseCustomColumns('[]')).toEqual([])
	})
})

describe('protocol ranking column visibility storage', () => {
	it('accepts only boolean entries from a valid saved object', () => {
		expect(parseProtocolTableColumnVisibility('{"tvl":true,"fees_24h":false,"name":"yes","nested":{}}')).toEqual({
			tvl: true,
			fees_24h: false
		})
	})

	it('returns an empty config for invalid JSON and incompatible saved shapes', () => {
		expect(parseProtocolTableColumnVisibility('{')).toEqual({})
		expect(parseProtocolTableColumnVisibility('[true]')).toEqual({})
		expect(parseProtocolTableColumnVisibility('null')).toEqual({})
	})
})
