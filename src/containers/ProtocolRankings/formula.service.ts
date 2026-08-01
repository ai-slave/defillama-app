import { Parser, type Expression } from 'expr-eval'
import { formatCompactNumber, formatPercent, formatUsd } from '~/utils/numberFormat'
import type { IProtocol } from './types'

export type FormulaValue = number | string | boolean
export type FormulaEvaluationResult =
	| { status: 'success'; value: FormulaValue }
	| { status: 'missing' }
	| { status: 'error'; error: string }

type FormulaContext = Record<string, FormulaValue>

export function formatCustomColumnValue(value: FormulaValue, formatType: string): string | null {
	const numericValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
	if (formatType === 'usd') return formatUsd(Number.isFinite(numericValue) ? numericValue : null, { compact: true })
	if (formatType === 'number') return formatCompactNumber(Number.isFinite(numericValue) ? numericValue : null)
	if (formatType === 'percent') {
		if (!Number.isFinite(numericValue)) return null
		return formatPercent(numericValue, {
			input: numericValue !== 0 && Math.abs(numericValue) < 1 ? 'fraction' : 'percent'
		})
	}
	if (typeof value === 'string') return value
	return typeof value === 'number' || typeof value === 'boolean' ? String(value) : null
}

function evaluateParsedFormula(expression: Expression, row: IProtocol): FormulaEvaluationResult {
	try {
		const context = flattenObject(row)
		// expr-eval supports boolean variables at runtime, but its published Value type omits them.
		const value: unknown = Reflect.apply(expression.evaluate, expression, [context])
		if (typeof value === 'number') {
			return Number.isFinite(value)
				? { status: 'success', value }
				: { status: 'error', error: 'Formula result must be a finite number' }
		}
		if (typeof value === 'string' || typeof value === 'boolean') return { status: 'success', value }
		return { status: 'error', error: 'Formula result must be a number, string, or boolean' }
	} catch (error: unknown) {
		if (error instanceof Error && /undefined variable/i.test(error.message)) {
			return { status: 'missing' }
		}
		return { status: 'error', error: error instanceof Error ? error.message : 'Formula evaluation failed' }
	}
}

export function createFormulaEvaluator(formula: string): (row: IProtocol) => FormulaEvaluationResult {
	try {
		const expression = new Parser().parse(formula)
		return (row) => evaluateParsedFormula(expression, row)
	} catch (error: unknown) {
		const result: FormulaEvaluationResult = {
			status: 'error',
			error: error instanceof Error ? error.message : 'Formula parsing failed'
		}
		return () => result
	}
}

export function evaluateFormula(formula: string, row: IProtocol): FormulaEvaluationResult {
	return createFormulaEvaluator(formula)(row)
}

export function getSortableValue(value: FormulaValue, formatType: string): number | string | boolean | null {
	if (formatType === 'usd' || formatType === 'number' || formatType === 'percent') {
		if (typeof value === 'number') return Number.isFinite(value) ? value : null
		if (typeof value !== 'string' || value.trim() === '') return null
		const numericValue = Number(value)
		return Number.isFinite(numericValue) ? numericValue : null
	} else if (formatType === 'boolean') {
		return typeof value === 'boolean' ? value : null
	} else {
		return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null
	}
}

function flattenObject(obj: object, prefix = '', result: FormulaContext = {}): FormulaContext {
	for (const key in obj) {
		const value: unknown = Reflect.get(obj, key)
		const newKey = prefix ? `${prefix}_${key}` : key
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			flattenObject(value, newKey, result)
		} else if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
			result[newKey] = value
		}
	}
	return result
}
