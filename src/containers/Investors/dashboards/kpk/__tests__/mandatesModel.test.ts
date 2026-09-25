import { describe, expect, test } from 'vitest'
import type { KpkExcessWindow, KpkMandateClient, KpkMandatePerf, KpkMandates } from '../api'
import {
	clientFooterRows,
	deployedTitle,
	missingAumTitle,
	performanceEarnedTitle,
	rateBasisTitle
} from '../mandatesModel'
import { earnedWindowLine, scopeLine } from '../ui'

const client = (overrides: Partial<KpkMandateClient>): KpkMandateClient => ({
	name: 'Client',
	aum: null,
	share: null,
	deployedPct: null,
	usd: null,
	eth: null,
	since: null,
	alphaBps: null,
	excess: null,
	excessRunRate: null,
	excessAvgBalance: null,
	yieldAum: null,
	defiUsd: null,
	opsUsd: null,
	deployedUsd: null,
	idleUsd: null,
	coveragePct: null,
	...overrides
})

const WINDOW: KpkExcessWindow = {
	from: '2025-09-09',
	to: '2026-09-08',
	days: 365,
	snapshotDays: 361,
	carriedDays: 3,
	missingDays: 1,
	coveragePct: 98,
	excess: 0.329,
	earned: 6.42,
	benchEarned: 6.091,
	avgBalance: 149.5,
	fallback: [],
	stacked: [],
	unpriced: []
}

describe('deployedTitle', () => {
	// $5.02m defi + $10.61m ops holds the $9.47m idle inside it, leaving $6.16m deployed.
	test('breaks the deployed figure into legs that sum to it, idle taken out of ops', () => {
		expect(
			deployedTitle(client({ deployedUsd: 6.16, yieldAum: 15.63, defiUsd: 5.02, opsUsd: 10.61, idleUsd: 9.47 }))
		).toBe(
			'$6.16m of $15.63m deployed — $5.02m in defi positions and $1.14m in ops positions, with $9.47m sitting idle'
		)
	})

	test('drops the ops leg when every ops dollar is idle', () => {
		expect(
			deployedTitle(client({ deployedUsd: 90.77, yieldAum: 91.15, defiUsd: 90.77, opsUsd: 0.372, idleUsd: 0.372 }))
		).toBe('$90.77m of $91.15m deployed — $90.77m in defi positions, with $372k sitting idle')
		// A client the positions report does not carry gets no tooltip, not '— of — deployed'.
		expect(deployedTitle(client({}))).toBeUndefined()
	})
})

describe('rateBasisTitle', () => {
	const window = {
		label: '1 day',
		days: 1,
		apy: 4.47,
		bench: 3.11,
		spread: 1.36,
		spreadBps: 136,
		excessAnnualUsd: 0.82
	}

	test('says whether a window rate was earned or read spot, and keeps the spot reading', () => {
		expect(
			rateBasisTitle({
				...window,
				realized: true,
				avgBalance: 60.1,
				spot: { apy: 4.51, bench: 3.11, spread: 1.4, spreadBps: 140 }
			})
		).toBe(
			'Earned: money-weighted across every priced position-day in the window on a mean balance of $60.1m. The spot reading on the latest balances is 4.51%.'
		)
		expect(rateBasisTitle({ ...window, realized: false })).toBe(
			'Spot reading: a trailing mean applied to the latest balances. No per-position history covers this window.'
		)
		expect(rateBasisTitle(window)).toBeUndefined()
	})
})

describe('performanceEarnedTitle', () => {
	test("dates the denomination's earned figure on the excess window", () => {
		const perf = { denom: 'EUR', earned: 0.201, benchEarned: 0.2028, avgBalance: 3.1 } as KpkMandatePerf
		expect(performanceEarnedTitle(perf, WINDOW)).toBe(
			'Window Sep 9, 2025 – Sep 8, 2026 (365 days). EUR earned $201k against $202.8k at benchmark, on a mean balance of $3.1m.'
		)
		expect(performanceEarnedTitle(perf, null)).toBeUndefined()
	})
})

describe('missingAumTitle', () => {
	test('tells a client the snapshot has yet to carry from one that wound down in the window', () => {
		expect(missingAumTitle(client({ yieldAum: 4.2 }), '2026-09-02', '2026-08-31')).toBe(
			'Not in the Sep 2, 2026 treasury snapshot yet; $4.2m as of Aug 31, 2026'
		)
		// A current positions-report balance outranks an earned-window mean.
		expect(missingAumTitle(client({ yieldAum: 4.2, excessAvgBalance: 2.4 }), '2026-09-02', null)).toBe(
			'Not in the Sep 2, 2026 treasury snapshot yet; $4.2m as of the positions report'
		)
		expect(missingAumTitle(client({ excessAvgBalance: 2.4 }), '2026-09-02', null)).toBe(
			'Not in the Sep 2, 2026 treasury snapshot — held a mean $2.4m during the earned-return window'
		)
		expect(missingAumTitle(client({}), null, null)).toBeUndefined()
	})
})

describe('clientFooterRows', () => {
	const data = {
		asOf: '2026-09-02',
		clients: [client({ share: 85.46 }), client({ share: null })],
		inactive: { count: 1, names: ['Aave DAO'], excess: -0.012 },
		totals: { aum: 107.5, weightedDeployedPct: 82.7, excess: -0.088, excessRunRate: 0 }
	} as unknown as KpkMandates

	test('states the wound-down mandates above a total whose share is what the rows add up to', () => {
		expect(clientFooterRows(data)).toEqual([
			{
				muted: true,
				title: 'Aave DAO held nothing in the Sep 2, 2026 snapshot, so they are not listed above.',
				cells: { name: 'Plus 1 mandate with no current balance', excess: '−$12k' }
			},
			{ cells: { name: 'Total', aum: '$107.5m', share: '85.5%', deployedPct: '82.7%', excess: '−$88k' } }
		])
	})

	test('drops the inactive row when every mandate holds a balance', () => {
		expect(clientFooterRows({ ...data, inactive: null }).map((row) => row.cells.name)).toEqual(['Total'])
	})
})

describe('scopeLine', () => {
	test('states what the rate covers and what the ops book leaves out', () => {
		expect(
			scopeLine('USD', {
				defiUsd: 62,
				unresolvedUsd: 0.2557,
				coveragePct: 99.6,
				opsUsd: 1.23,
				opsBuckets: [
					{ name: 'ops:idle', usd: 0.7295 },
					{ name: 'ops:market-making', usd: 0.5007 }
				]
			})
		).toBe(
			'Rates cover $62m of USD defi positions. $1.23m of USD sits in ops positions or idle — idle $729.5k and market making $500.7k — held for a purpose other than yield, so no benchmark applies. Excluded from the comparison above.'
		)
		expect(scopeLine('EUR', { defiUsd: 3.21, unresolvedUsd: 0, coveragePct: 100, opsUsd: 0, opsBuckets: [] })).toBe(
			'Rates cover $3.21m of EUR defi positions. No EUR is held in ops positions or idle.'
		)
	})
})

describe('earnedWindowLine', () => {
	test('names the span and the days that accrued nothing, or the absence of history', () => {
		expect(earnedWindowLine(WINDOW)).toBe(
			'Sum of balance × (rate − benchmark) for every defi position, day by day, over the trailing 365 days. 1 day had no snapshot and accrued nothing.'
		)
		expect(earnedWindowLine(null)).toBe('No per-position history available, so no earned figure is shown.')
	})
})
