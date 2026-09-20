import { afterEach, describe, expect, test, vi } from 'vitest'

const fetchJson = vi.hoisted(() => vi.fn())
const constants = vi.hoisted(() => ({ SEARCH_API_TOKEN: undefined as string | undefined }))

vi.mock('~/utils/async', () => ({ fetchJson, getFastJsonTimeoutMs: () => 10_000 }))
vi.mock('~/constants', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/constants')>()),
	get SEARCH_API_TOKEN() {
		return constants.SEARCH_API_TOKEN
	}
}))

import { multiSearchApi, searchApi } from '../index'

const query = { indexUid: 'pages', q: 'eth', limit: 10, offset: 0 }

afterEach(() => {
	vi.restoreAllMocks()
	fetchJson.mockReset()
	constants.SEARCH_API_TOKEN = undefined
})

describe('search API without the token', () => {
	test('returns no hits per query, skips the request and warns once', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

		expect(await multiSearchApi([query, query])).toEqual([[], []])
		expect(await searchApi(query)).toEqual([])

		expect(fetchJson).not.toHaveBeenCalled()
		expect(warn).toHaveBeenCalledTimes(1)
		expect(warn).toHaveBeenCalledWith(
			'[search] NEXT_PUBLIC_SEARCH_API_TOKEN is not set, all search features, including global search, will return no results'
		)
		warn.mockRestore()
	})
})

describe('search API with the token', () => {
	test('sends the bearer token and returns the hits per query', async () => {
		constants.SEARCH_API_TOKEN = 'token'
		fetchJson.mockResolvedValue({ results: [{ hits: [{ id: 'ethereum' }] }] })

		expect(await multiSearchApi([query])).toEqual([[{ id: 'ethereum' }]])
		expect(fetchJson).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) })
		)
	})
})

test.each(['', ' ', '\t\n'])('skips search requests for blank token %j', async (token) => {
	constants.SEARCH_API_TOKEN = token
	expect(await multiSearchApi([query, query])).toEqual([[], []])
	expect(fetchJson).not.toHaveBeenCalled()
})

test('propagates request failures when the search token is configured', async () => {
	constants.SEARCH_API_TOKEN = 'token'
	const error = new Error('Unauthorized')
	fetchJson.mockRejectedValue(error)
	await expect(searchApi(query)).rejects.toBe(error)
})
