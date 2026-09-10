// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useSemanticSearch } from '../useSemanticSearch'

const mocks = vi.hoisted(() => ({ authorizedFetch: vi.fn(), isAuthenticated: true }))

vi.mock('~/auth', () => ({
	useAuthContext: () => ({ authorizedFetch: mocks.authorizedFetch, isAuthenticated: mocks.isAuthenticated })
}))

const respond = (results: Array<{ id: string }>) => ({ ok: true, json: async () => ({ results }) })

let container: HTMLDivElement
let root: Root
let api: ReturnType<typeof useSemanticSearch>
let commits: Array<{ searching: boolean; ids: Array<string> }>
let enabled = true

function Harness() {
	api = useSemanticSearch(enabled)
	useLayoutEffect(() => {
		commits.push({ searching: api.isSearching, ids: api.results.map((r: any) => r.id) })
	})
	return null
}

async function render() {
	await act(async () => root.render(<Harness />))
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	mocks.authorizedFetch.mockReset()
	mocks.isAuthenticated = true
	enabled = true
	commits = []
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await render()
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function type(text: string) {
	await act(async () => api.setQuery(text))
}
const settle = async (ms = 300) => act(async () => vi.advanceTimersByTimeAsync(ms))

test('debounces to one request for rapid keystrokes and reports the results', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('a')
	await type('ab')
	await type('abc')
	expect(mocks.authorizedFetch).not.toHaveBeenCalled()
	expect(api.isSearching).toBe(true)

	await settle()
	expect(mocks.authorizedFetch).toHaveBeenCalledOnce()
	expect(mocks.authorizedFetch.mock.calls[0][0]).toContain('q=abc')
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
	expect(api.isSearching).toBe(false)
})

// The spinner used to be set inside the effect, so a keystroke committed twice: once for the query,
// then again once the effect turned the spinner on.
test('a keystroke commits one render with the spinner already on', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	commits = []
	await type('abc')
	expect(commits).toEqual([{ searching: true, ids: [] }])
})

test('keeps the previous results visible while the next query runs', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'first' }]))
	await type('one')
	await settle()
	expect(api.results.map((r: any) => r.id)).toEqual(['first'])

	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'second' }]))
	await type('two')
	expect(api.isSearching).toBe(true)
	expect(api.results.map((r: any) => r.id)).toEqual(['first'])

	await settle()
	expect(api.results.map((r: any) => r.id)).toEqual(['second'])
})

test('an emptied query hides results without a request', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('abc')
	await settle()
	await type('')
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(mocks.authorizedFetch).toHaveBeenCalledOnce()
})

test('clear resets the query and its results', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('abc')
	await settle()
	await act(async () => api.clear())
	expect(api.query).toBe('')
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
})

// The opposite edge: returning to a query already settled must not leave the spinner on forever.
test('retyping a settled query serves it without a spinner or a request', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('abc')
	await settle()
	await type('ab')
	await type('abc')
	await settle()
	expect(api.isSearching).toBe(false)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
	expect(mocks.authorizedFetch).toHaveBeenCalledOnce()
})

test('a failed response clears the results for that query and reports the failure', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('abc')
	await settle()
	expect(api.failed).toBe(false)
	mocks.authorizedFetch.mockResolvedValue({ ok: false })
	await type('abcd')
	await settle()
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(api.failed).toBe(true)
})

// The opposite edge: a server that answers with no matches is an empty result, not a failure.
test('an empty answer is not reported as a failure', async () => {
	mocks.authorizedFetch.mockResolvedValue(respond([]))
	await type('abc')
	await settle()
	expect(api.results).toEqual([])
	expect(api.failed).toBe(false)
})

test('retry reruns the failed query without retyping', async () => {
	mocks.authorizedFetch.mockResolvedValue({ ok: false })
	await type('abc')
	await settle()
	expect(api.failed).toBe(true)

	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await act(async () => api.retry())
	expect(api.isSearching).toBe(true)
	expect(api.failed).toBe(false)
	await settle()
	expect(mocks.authorizedFetch).toHaveBeenCalledTimes(2)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
})

test('no request runs while the hook is disabled or signed out', async () => {
	enabled = false
	await render()
	await type('abc')
	await settle()
	expect(mocks.authorizedFetch).not.toHaveBeenCalled()
	expect(api.isSearching).toBe(false)

	enabled = true
	mocks.isAuthenticated = false
	await render()
	await settle()
	expect(mocks.authorizedFetch).not.toHaveBeenCalled()
	expect(api.isSearching).toBe(false)
})

test('a failed search can be retried by clearing and retyping', async () => {
	mocks.authorizedFetch.mockResolvedValue({ ok: false })
	await type('abc')
	await settle()
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(mocks.authorizedFetch).toHaveBeenCalledOnce()

	mocks.authorizedFetch.mockResolvedValue(respond([{ id: 'r1' }]))
	await type('')
	await type('abc')
	await settle()

	expect(mocks.authorizedFetch).toHaveBeenCalledTimes(2)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
})
