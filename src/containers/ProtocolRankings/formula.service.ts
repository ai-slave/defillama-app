import { Parser } from 'expr-eval'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { IProtocol } from './types'

export function formatCustomColumnValue(value: unknown, formatType: string): string | null {
	const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
	if (formatType === 'usd') return formatUsd(Number.isFinite(numericValue) ? numericValue : null, { compact: true })
	if (formatType === 'number') return formatCompactNumber(Number.isFinite(numericValue) ? numericValue : null)
	if (formatType === 'percent') {
		if (!Number.isFinite(numericValue)) return null
		return formatPercent(numericValue, {
			input: numericValue !== 0 && Math.abs(numericValue) < 1 ? 'fraction' : 'percent'
		})
	}
	return typeof value === 'string' ? value : String(value)
}

export function evaluateFormula(formula: string, row: IProtocol): { value: number | string; error?: string } {
	try {
		const parser = new Parser()
		const context = flattenObject(row)
		const value = parser.evaluate(formula, context)
		return { value }
	} catch (e: any) {
		if (typeof e.message === 'string' && /undefined variable/i.test(e.message)) {
			return { value: '' }
		}
		return { value: 'Err', error: e.message }
	}
}

export function getSortableValue(value: any, formatType: string): number | string | boolean | null {
	if (value == null || value === '') {
		return null
	}

	if (formatType === 'usd' || formatType === 'number' || formatType === 'percent') {
		return typeof value === 'number' ? value : 0
	} else if (formatType === 'boolean') {
		return typeof value === 'boolean' ? value : false
	} else {
		return value
	}
}

function flattenObject(obj: any, prefix = '', res: any = {}) {
	for (const key in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
		const value = obj[key]
		const newKey = prefix ? `${prefix}_${key}` : key
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			flattenObject(value, newKey, res)
		} else {
			res[newKey] = value
		}
	}
	return res
}
