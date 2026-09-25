import { describe, expect, test } from 'vitest'
import type { VerifiedBlock } from '../../data/types'
import { getMeasuredCardHeader } from '../measuredCardHeader'

const NOW = '2026-09-24T12:00:00.000Z'
const THREE_DAYS_AGO = '2026-09-21T12:00:00.000Z'

function verified(apy: VerifiedBlock['apy'], apyAsOf: string | null, exitAsOf: string | null = null): VerifiedBlock {
	return {
		apy,
		apy_as_of: apyAsOf,
		apy_confidence: apyAsOf ? 'high' : null,
		exit: exitAsOf ? { status: 'instant', eta_seconds: null, fee_bps: 0, as_of: exitAsOf } : null,
		exit_liquidity: null,
		tvl: null
	}
}

describe('getMeasuredCardHeader', () => {
	test('names a fresh refused substitution', () => {
		const header = getMeasuredCardHeader({
			verified: verified({ avg_1d: 5.68, avg_7d: null, avg_30d: null }, new Date().toISOString()),
			measured: false,
			unsubstitutedMeasured: true,
			window: 'current'
		})
		expect(header).toMatchObject({
			title: 'Verified APY · not included in total',
			stampPrefix: 'measured',
			stale: false,
			reportedNote: null
		})
	})

	test('dates a stale reading by its own stamp rather than by a fresher exit probe', () => {
		const header = getMeasuredCardHeader({
			verified: verified({ avg_1d: null, avg_7d: 99.6, avg_30d: null }, THREE_DAYS_AGO, NOW),
			measured: false,
			unsubstitutedMeasured: false,
			window: 'current'
		})
		expect(header).toEqual({
			title: 'Verified APY',
			stamp: THREE_DAYS_AGO,
			stampPrefix: 'last measured',
			stale: true,
			reportedNote: null
		})
	})

	test('says the figure is reported when the pool is measured for exits only', () => {
		const exitAsOf = new Date().toISOString()
		const header = getMeasuredCardHeader({
			verified: verified({ avg_1d: null, avg_7d: null, avg_30d: null }, null, exitAsOf),
			measured: false,
			unsubstitutedMeasured: false,
			window: 'current'
		})
		expect(header).toEqual({
			title: 'Verified exit',
			stamp: exitAsOf,
			stampPrefix: 'exit measured',
			stale: false,
			reportedNote: "Exits are measured, yield is not. Showing the protocol's reported rate."
		})
	})

	test('names the window a young measurement has not reached', () => {
		const apyAsOf = new Date().toISOString()
		const header = getMeasuredCardHeader({
			verified: verified({ avg_1d: 3.1, avg_7d: null, avg_30d: null }, apyAsOf, apyAsOf),
			measured: false,
			unsubstitutedMeasured: false,
			window: 'avg_7d'
		})
		expect(header).toEqual({
			title: 'Verified APY',
			stamp: apyAsOf,
			stampPrefix: 'measured',
			stale: false,
			reportedNote: "No 7d measurement yet. Showing the protocol's reported 7d rate."
		})
	})
})
