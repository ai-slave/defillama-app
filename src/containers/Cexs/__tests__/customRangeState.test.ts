import { describe, expect, it } from 'vitest'
import type { RawCexInflowsResponse } from '../api.types'
import { getCexDateRangeState } from '../DateFilter'
import { getCexCustomRangeState } from '../index'

const measurement = (outflows: number): RawCexInflowsResponse => ({
	outflows,
	oldTokens: { tvl: {} },
	currentTokens: { tvl: {} }
})

describe('CEX custom-range state', () => {
	it('keeps an absent date range inactive', () => {
		expect(getCexDateRangeState(null, null)).toBe('inactive')
	})

	it('rejects partially applied date ranges', () => {
		expect(getCexDateRangeState(1_000, null)).toBe('invalid')
		expect(getCexDateRangeState(null, 3_602_000)).toBe('invalid')
	})

	it('rejects exact one-hour and inverted date ranges', () => {
		expect(getCexDateRangeState(1_000, 3_601_000)).toBe('invalid')
		expect(getCexDateRangeState(3_602_000, 1_000)).toBe('invalid')
	})

	it('accepts a date range longer than one hour', () => {
		expect(getCexDateRangeState(1_000, 3_602_000)).toBe('valid')
	})

	it('distinguishes whole failure from a successful omitted venue', () => {
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

	it('does not show a failure marker without a measured Assets value', () => {
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

	it('keeps an explicit measured zero available', () => {
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
