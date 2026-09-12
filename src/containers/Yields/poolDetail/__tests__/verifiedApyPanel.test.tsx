// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import type { VerifiedBlock } from '../../data/types'
import { describeCall, VerifiedApyPanel } from '../VerifiedApyPanel'

describe('describeCall', () => {
	test('lifts the EXECUTED marker into a tag and leaves a readable note', () => {
		expect(describeCall('Pool.withdraw(u, max, holder) — EXECUTED as the holder; returns underlying')).toEqual({
			signature: 'Pool.withdraw(u, max, holder)',
			executed: true,
			note: 'As the holder; returns underlying'
		})
		expect(describeCall('balanceOf(holder) — position size')).toEqual({
			signature: 'balanceOf(holder)',
			executed: false,
			note: 'Position size'
		})
		expect(describeCall('getReserveData(u).liquidityIndex')).toEqual({
			signature: 'getReserveData(u).liquidityIndex',
			executed: false,
			note: null
		})
	})
})

describe('VerifiedApyPanel', () => {
	test('tags each call and dates the measurement', () => {
		const verified: VerifiedBlock = {
			apy: { avg_1d: 1.43, avg_7d: 1.45, avg_30d: 1.47 },
			apy_as_of: '2026-09-07T07:51:59.000Z',
			apy_confidence: 'high',
			exit: { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: '2026-09-07T07:51:59.000Z' },
			exit_liquidity: null,
			tvl: { amount: '1', usd: 1, as_of: '2026-09-07' },
			methods: ['balanceOf(holder) — position size', 'Pool.withdraw(u, max, holder) — EXECUTED as the holder']
		}
		const html = renderToStaticMarkup(<VerifiedApyPanel verified={verified} measuredSince="2023-02-06" />)

		const body = new DOMParser().parseFromString(html, 'text/html').body
		const text = body.textContent
		expect(text).toContain('high confidence')
		const calls = Array.from(body.querySelectorAll('li'), (item) => item.textContent)
		expect(calls.find((call) => call.includes('balanceOf(holder)'))).toContain('read')
		expect(calls.find((call) => call.includes('Pool.withdraw'))).toContain('executed')
		expect(text).toContain('As the holder')
		expect(text).toContain('Measured since')
		expect(text).toContain('Feb 6, 2023')
	})
})
