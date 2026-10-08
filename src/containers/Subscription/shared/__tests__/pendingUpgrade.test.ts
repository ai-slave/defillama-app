import { expect, test } from 'vitest'
import { decideEarlierUpgrade } from '../pendingUpgrade'

const HOUR = 60 * 60 * 1000
const now = 1000 * 24 * HOUR
const earlier = (ageMs: number) =>
	({ plan: 'api', interval: 'year', clientSecret: 'pi_a_secret_a', pricing: null, createdAt: now - ageMs }) as const
const samePlan = { plan: 'api', interval: 'year' } as const

test.each([
	['canceled', 'canceled', false, samePlan, 2 * HOUR, { kind: 'forget' }],
	['succeeded with its plan showing', 'succeeded', true, samePlan, 2 * HOUR, { kind: 'forget' }],
	[
		'succeeded before its plan shows',
		'succeeded',
		false,
		samePlan,
		2 * HOUR,
		{ kind: 'underWay', status: 'succeeded', stale: false }
	],
	[
		'processing while its plan already shows',
		'processing',
		true,
		samePlan,
		2 * HOUR,
		{ kind: 'underWay', status: 'processing', stale: false }
	],
	[
		'authorized for over a week',
		'requires_capture',
		false,
		samePlan,
		8 * 24 * HOUR,
		{ kind: 'underWay', status: 'requires_capture', stale: true }
	],
	[
		'declined, fresh, same plan',
		'requires_payment_method',
		false,
		samePlan,
		2 * HOUR,
		{ kind: 'resume', awaitingVerification: false }
	],
	[
		'waiting for the bank, fresh, same plan',
		'requires_action',
		false,
		samePlan,
		2 * HOUR,
		{ kind: 'resume', awaitingVerification: true }
	],
	['declined a day ago', 'requires_payment_method', false, samePlan, 24 * HOUR, { kind: 'forget' }],
	[
		'waiting for the bank, opening another interval',
		'requires_action',
		false,
		{ plan: 'api', interval: 'month' },
		2 * HOUR,
		{ kind: 'forget' }
	],
	[
		'unconfirmed, opening another plan',
		'requires_confirmation',
		false,
		{ plan: 'llamafeed', interval: 'year' },
		2 * HOUR,
		{ kind: 'forget' }
	]
] as const)('an earlier upgrade intent that is %s', (_case, status, targetApplied, opening, ageMs, decision) => {
	expect(decideEarlierUpgrade(earlier(ageMs), status, targetApplied, opening, now)).toEqual(decision)
})
