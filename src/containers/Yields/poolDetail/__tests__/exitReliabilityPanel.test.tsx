import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { buildExitReliability } from '../exitReliability'
import { ExitReliabilityPanel } from '../ExitReliabilityPanel'
import type { PoolHistoryPoint, VerifiedExitOutcome } from '../types'

function day(
	date: string,
	outcome: VerifiedExitOutcome | null,
	amounts: { availableUsd?: number | null; tvlUsd?: number | null } = {}
): PoolHistoryPoint {
	const triple = { base: null, reward: null, total: null }
	return {
		date,
		tvl_usd: null,
		apy: { avg_1d: triple, avg_7d: triple, avg_30d: triple },
		intrinsic: null,
		price_per_share: null,
		verified: {
			apy: { avg_1d: null, avg_7d: null, avg_30d: null },
			price_per_share: null,
			liquidity_available: null,
			tvl: null,
			liquidity_available_usd: amounts.availableUsd ?? null,
			tvl_usd: amounts.tvlUsd ?? null,
			exit: outcome ? { outcome } : null
		}
	}
}

const iso = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10)

const render = (outcomes: Array<VerifiedExitOutcome | null>) =>
	renderToStaticMarkup(
		<ExitReliabilityPanel
			model={buildExitReliability(outcomes.map((o, i) => day(iso(i), o)))!}
			verified={null}
			holders={null}
		/>
	)

describe('exit reliability verdict', () => {
	// Scoring only the majority exit path drops real clean days out of the numerator while leaving
	// them in the denominator, so the ratio stops reconciling with the ledger beside it.
	test('counts instant and queued days together on a mixed history', () => {
		const html = render(['ok_full', 'ok_full', 'delayed', 'ok_full', 'ok_partial', 'ok_full', 'delayed', 'ok_full'])

		expect(html).toContain('7 / 8')
		expect(html).toContain('followed the pool&#x27;s available exit path')
		expect(html).toContain('1 interruption')
	})

	// The specific claim is stronger than the covering one, so a homogeneous history keeps it.
	test('keeps the precise claim when every clean day used the same path', () => {
		expect(render(['ok_full', 'ok_full'])).toContain('went through in full')
		expect(render(['delayed', 'delayed'])).toContain('were accepted into the queue')
	})

	// Three different non-measured states that must never read alike.
	test('separates a coverage hole from a protocol that had no exit yet', () => {
		const html = render(['no_exit_primary', 'ok_full', 'no_exit_primary', 'error_rpc', 'ok_full'])

		expect(html).toContain('No exit mechanism existed on 1 day')
		expect(html).toContain('No measurement on 1 day')
		// Neither is an interruption: the ledger is failures only.
		expect(html).toContain('Nothing to report')
	})

	test('omits the dollar pair when availability was not measured', () => {
		const history = [
			day(iso(0), 'ok_full'),
			day(iso(1), 'reverted_liquidity', { availableUsd: null, tvlUsd: 10_000_000 })
		]
		const html = renderToStaticMarkup(
			<ExitReliabilityPanel model={buildExitReliability(history)!} verified={null} holders={null} />
		)

		expect(html).toContain('Reverted, no liquidity')
		expect(html).not.toContain('$0 of')
		expect(html).not.toContain('$10m')
	})
})
