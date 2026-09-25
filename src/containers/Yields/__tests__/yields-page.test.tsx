import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import type { VerifiedRow } from '~/containers/Yields/data/types'
import { earnRow } from '~/utils/testing/yieldsEarnFixture'
import { installYieldsFixtures, yieldsSnapshot } from '~/utils/testing/yieldsSnapshotFixture'

const { acquireYieldsSnapshot, validateSubscription } = vi.hoisted(() => ({
	acquireYieldsSnapshot: vi.fn(),
	validateSubscription: vi.fn()
}))
vi.mock('~/containers/Yields/server/dataset.server', () => ({ acquireYieldsSnapshot }))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription }))
// getServerSideProps renders nothing; the page tree only costs import time here.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/Yields/views/EarnView', () => ({ default: () => null }))

import { getServerSideProps } from '~/pages/yields'
// The loader imports these on demand; loading them with the file keeps that cost out of the first test.
import '~/containers/Yields/data/earn.server'
import '~/containers/Yields/data/earnMeta.server'

const http = installYieldsFixtures()

type PageContext = Parameters<typeof getServerSideProps>[0]

const verified: VerifiedRow = {
	id: 'pool-a',
	apy: { avg_1d: 2.58, avg_7d: 2.5, avg_30d: 2.4 },
	apy_as_of: new Date().toISOString(),
	apy_confidence: 'high',
	exit: null,
	exit_liquidity: null,
	tvl: null
}

async function load(cookies: Record<string, string> = {}) {
	const headers: Record<string, string> = {}
	const context = {
		req: { method: 'GET', cookies, headers: {} },
		res: { setHeader: (name: string, value: string) => (headers[name] = value) },
		query: {},
		params: {},
		resolvedUrl: '/yields'
	} as unknown as PageContext
	const result = await getServerSideProps(context)
	if (!('props' in result)) throw new Error('Expected props')
	return { props: await result.props, headers }
}

const firstRow = (props: Awaited<ReturnType<typeof load>>['props']) => props.initialEarnPage?.rows[0]

beforeEach(() => {
	http.serve({ [`${AI_SERVER}/suggested-questions`]: { questions: [], suggestGlobal: false } })
	acquireYieldsSnapshot
		.mockReset()
		.mockResolvedValue(yieldsSnapshot({ earn: [earnRow('pool-a', 1000)], earnVerified: [verified] }))
	validateSubscription.mockReset()
})

describe('/yields entitlement on first paint', () => {
	test('an anonymous request gets locked rows, publicly cached', async () => {
		const { props, headers } = await load()

		expect(firstRow(props)).toMatchObject({ id: 'pool-a', verified: null, verifiedLocked: true })
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers['Cache-Control']).toMatch(/^public, s-maxage=\d+/)
		expect(headers['Vary']).toBe('Cookie, Authorization')
	})

	test('a subscriber gets the measured rows, kept out of the shared cache', async () => {
		validateSubscription.mockImplementation(async (auth: string) =>
			auth === 'Bearer tok' ? { valid: true, isTrial: false } : { valid: false, status: 401 }
		)

		const { props, headers } = await load({ pb_auth_token: 'tok' })

		expect(firstRow(props)).toMatchObject({ id: 'pool-a', verified: { apy: verified.apy } })
		expect(props.initialEarnPageVerifiedAccess).toBe(true)
		expect(headers['Cache-Control']).toBe('private, no-store')
	})

	test('a session without an active subscription gets locked rows, still privately', async () => {
		validateSubscription.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })

		const { props, headers } = await load({ pb_auth_token: 'tok' })

		expect(firstRow(props)).toMatchObject({ verified: null, verifiedLocked: true })
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers['Cache-Control']).toBe('private, no-store')
	})

	test('ships no rows when the validators cannot answer, so the client fetches its own tier', async () => {
		validateSubscription.mockRejectedValue(new Error('auth service unavailable'))

		const { props, headers } = await load({ pb_auth_token: 'tok' })

		expect(props.initialEarnPage).toBeNull()
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers['Cache-Control']).toBe('private, no-store')
	})
})
