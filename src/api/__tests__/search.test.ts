import { afterEach, expect, test, vi } from 'vitest'

const fetchJson = vi.hoisted(() => vi.fn())
vi.mock('~/utils/async', () => ({ fetchJson, getFastJsonTimeoutMs: () => 10_000 }))

const query = { indexUid: 'pages', q: 'eth', limit: 10, offset: 0 }

// SEARCH_API_TOKEN and the once-only warning are module state, so each test loads a fresh module.
async function loadSearch(token: string | undefined) {
	vi.stubEnv('NEXT_PUBLIC_SEARCH_API_TOKEN', token)
	vi.resetModules()
	return import('../index')
}

afterEach(() => {
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
	fetchJson.mockReset()
})

test('returns no hits per query without a token, skips the request and warns once', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	const { multiSearchApi, searchApi } = await loadSearch(undefined)

	expect(await multiSearchApi([query, query])).toEqual([[], []])
	expect(await searchApi(query)).toEqual([])

	expect(fetchJson).not.toHaveBeenCalled()
	expect(warn.mock.calls).toEqual([
		[
			'[search] NEXT_PUBLIC_SEARCH_API_TOKEN is not set, all search features, including global search, will return no results'
		]
	])
})

test.each(['', ' ', '\t\n'])('skips search requests for blank token %j', async (token) => {
	vi.spyOn(console, 'warn').mockImplementation(() => undefined)
	const { multiSearchApi } = await loadSearch(token)
	expect(await multiSearchApi([query, query])).toEqual([[], []])
	expect(fetchJson).not.toHaveBeenCalled()
})

test('sends the bearer token and returns the hits per query', async () => {
	const { multiSearchApi } = await loadSearch('token')
	fetchJson.mockResolvedValue({ results: [{ hits: [{ id: 'ethereum' }] }] })

	expect(await multiSearchApi([query])).toEqual([[{ id: 'ethereum' }]])
	expect(fetchJson.mock.lastCall?.[1].headers.Authorization).toBe('Bearer token')
})

test('propagates request failures when the search token is configured', async () => {
	const { searchApi } = await loadSearch('token')
	const error = new Error('Unauthorized')
	fetchJson.mockRejectedValue(error)
	await expect(searchApi(query)).rejects.toBe(error)
})
