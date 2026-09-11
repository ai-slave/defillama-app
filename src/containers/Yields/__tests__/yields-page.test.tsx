import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getServerSideProps } from '~/pages/yields'

type PageContext = Parameters<typeof getServerSideProps>[0]

const { getEarnPageMock, validateSubscriptionMock } = vi.hoisted(() => ({
	getEarnPageMock: vi.fn(),
	validateSubscriptionMock: vi.fn()
}))

vi.mock('~/containers/Yields/server/dataset.server', () => ({
	acquireYieldsSnapshot: vi.fn(() => Promise.resolve({ generationId: 'g', generatedAt: 0, readJson: vi.fn() }))
}))
vi.mock('~/containers/Yields/data/earnMeta.server', () => ({
	getEarnPageMeta: () =>
		Promise.resolve({ chainList: [], projectList: [], categoryList: [], evmChains: [], tokens: [], attributeIds: [] })
}))
vi.mock('~/containers/Yields/data/earn.server', () => ({ getEarnPage: getEarnPageMock }))
vi.mock('~/containers/LlamaAI/api', () => ({
	fetchEntityQuestions: () => Promise.resolve({ questions: [], suggestGlobal: false })
}))
vi.mock('~/utils/apiAuth', () => ({ validateSubscription: validateSubscriptionMock }))

const PAGE = { rows: [], total: 0, page: 1, pageSize: 50, hasMore: false }

function context(cookies: Record<string, string>, res: { setHeader: ReturnType<typeof vi.fn> }): PageContext {
	return {
		req: { method: 'GET', cookies },
		res,
		query: {},
		params: {},
		resolvedUrl: '/yields'
	} as unknown as PageContext
}
const headers = (res: { setHeader: ReturnType<typeof vi.fn> }) => Object.fromEntries(res.setHeader.mock.calls)

describe('/yields entitlement on first paint', () => {
	beforeEach(() => {
		getEarnPageMock.mockReset()
		getEarnPageMock.mockResolvedValue(PAGE)
		validateSubscriptionMock.mockReset()
	})

	test('renders the redacted rows for an anonymous request and caches them publicly', async () => {
		const res = { setHeader: vi.fn() }

		const result = await getServerSideProps(context({}, res))
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props

		expect(getEarnPageMock).toHaveBeenCalledWith(expect.anything(), {}, { verifiedAccess: false })
		expect(validateSubscriptionMock).not.toHaveBeenCalled()
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers(res)['Cache-Control']).toMatch(/^public, s-maxage=\d+/)
		expect(headers(res)['Vary']).toBe('Cookie, Authorization')
	})

	test('renders the measured rows for a subscriber and keeps the response out of the shared cache', async () => {
		const res = { setHeader: vi.fn() }
		validateSubscriptionMock.mockResolvedValue({ valid: true, isTrial: false })

		const result = await getServerSideProps(context({ pb_auth_token: 'tok' }, res))
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props

		expect(validateSubscriptionMock).toHaveBeenCalledWith('Bearer tok')
		expect(getEarnPageMock).toHaveBeenCalledWith(expect.anything(), {}, { verifiedAccess: true })
		expect(props.initialEarnPageVerifiedAccess).toBe(true)
		expect(headers(res)['Cache-Control']).toBe('private, no-store')
	})

	test('falls back to the redacted rows, still privately, when the session has no active subscription', async () => {
		const res = { setHeader: vi.fn() }
		validateSubscriptionMock.mockResolvedValue({ valid: false, status: 403, error: 'Active subscription required' })

		const result = await getServerSideProps(context({ pb_auth_token: 'tok' }, res))
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props

		expect(getEarnPageMock).toHaveBeenCalledWith(expect.anything(), {}, { verifiedAccess: false })
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers(res)['Cache-Control']).toBe('private, no-store')
	})

	test('ships no rows when the validators cannot answer, so the client fetches its own tier', async () => {
		const res = { setHeader: vi.fn() }
		validateSubscriptionMock.mockRejectedValue(new Error('auth service unavailable'))

		const result = await getServerSideProps(context({ pb_auth_token: 'tok' }, res))
		if (!('props' in result)) throw new Error('Expected props')
		const props = await result.props

		expect(getEarnPageMock).not.toHaveBeenCalled()
		expect(props.initialEarnPage).toBeNull()
		expect(props.initialEarnPageVerifiedAccess).toBe(false)
		expect(headers(res)['Cache-Control']).toBe('private, no-store')
	})
})
