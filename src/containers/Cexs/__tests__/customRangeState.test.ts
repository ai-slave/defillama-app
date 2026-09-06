import { describe, expect, test } from 'vitest'
import type { RawCexInflowsResponse } from '../api.types'
import { getCexDateRangeState } from '../DateFilter'
import { getCexCustomRangeState } from '../index'

const measurement = (outflows: number): RawCexInflowsResponse => ({
	outflows,
	oldTokens: { tvl: {} },
	currentTokens: { tvl: {} }
})

describe('CEX custom-range state', () => {
	test('keeps an absent date range inactive', () => {
		expect(getCexDateRangeState(null, null)).toBe('inactive')
	})

	test('rejects partially applied date ranges', () => {
		expect(getCexDateRangeState(1000, null)).toBe('invalid')
		expect(getCexDateRangeState(null, 3_602_000)).toBe('invalid')
	})

	test('rejects exact one-hour and inverted date ranges', () => {
		expect(getCexDateRangeState(1000, 3_601_000)).toBe('invalid')
		expect(getCexDateRangeState(3_602_000, 1000)).toBe('invalid')
	})

	test('accepts a date range longer than one hour', () => {
		expect(getCexDateRangeState(1000, 3_602_000)).toBe('valid')
	})

	test('distinguishes whole failure from a successful omitted venue', () => {
		expect(
			getCexCustomRangeState({
				enabled: true,
				hasMeasuredAssets: true,
				isLoading: false,
				isError: true,
				measurement: undefined
			})
		).toBe('failed')
		expect(
			getCexCustomRangeState({
				enabled: true,
				hasMeasuredAssets: true,
				isLoading: false,
				isError: false,
				measurement: undefined
			})
		).toBe('missing')
	})

	test('does not show a failure marker without a measured Assets value', () => {
		expect(
			getCexCustomRangeState({
				enabled: true,
				hasMeasuredAssets: false,
				isLoading: false,
				isError: true,
				measurement: undefined
			})
		).toBe('disabled')
	})

	test('keeps an explicit measured zero available', () => {
		expect(
			getCexCustomRangeState({
				enabled: true,
				hasMeasuredAssets: true,
				isLoading: false,
				isError: false,
				measurement: measurement(0)
			})
		).toBe('measured')
	})
})
