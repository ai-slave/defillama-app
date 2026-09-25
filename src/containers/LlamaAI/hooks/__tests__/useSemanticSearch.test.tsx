// @vitest-environment happy-dom

import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AI_SERVER } from '~/constants'
import pb from '~/utils/pocketbase'
import { installSubscriberSession } from '~/utils/test/subscriberSession'
import { useSemanticSearch } from '../useSemanticSearch'

const session = installSubscriberSession('reader')

let answer: Array<{ id: string }> | 'fail' = []
const searches = () => session.requests.filter((request) => request.url.pathname === '/search')

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
	await act(async () =>
		root.render(
			<session.Wrapper>
				<Harness />
			</session.Wrapper>
		)
	)
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	answer = []
	session.serve({
		[`${AI_SERVER}/search`]: () =>
			// A real outage still answers with a JSON error body, so only the status marks the failure.
			answer === 'fail' ? Response.json({ error: 'Search unavailable' }, { status: 500 }) : { results: answer }
	})
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
	answer = [{ id: 'r1' }]
	// Each pause is shorter than the 300ms debounce, so only the last query is ever sent.
	await type('a')
	await settle(250)
	await type('ab')
	await settle(250)
	await type('abc')
	await settle(250)
	expect(searches()).toHaveLength(0)
	expect(api.isSearching).toBe(true)

	await settle(50)
	expect(searches()).toHaveLength(1)
	expect(searches()[0]!.url.searchParams.get('q')).toBe('abc')
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
	expect(api.isSearching).toBe(false)
})

// The spinner used to be set inside the effect, so a keystroke committed twice: once for the query,
// then again once the effect turned the spinner on.
test('a keystroke commits one render with the spinner already on', async () => {
	answer = [{ id: 'r1' }]
	commits = []
	await type('abc')
	expect(commits).toEqual([{ searching: true, ids: [] }])
})

test('keeps the previous results visible while the next query runs', async () => {
	answer = [{ id: 'first' }]
	await type('one')
	await settle()
	expect(api.results.map((r: any) => r.id)).toEqual(['first'])

	answer = [{ id: 'second' }]
	await type('two')
	expect(api.isSearching).toBe(true)
	expect(api.results.map((r: any) => r.id)).toEqual(['first'])

	await settle()
	expect(api.results.map((r: any) => r.id)).toEqual(['second'])
})

test('an emptied query hides results without a request', async () => {
	answer = [{ id: 'r1' }]
	await type('abc')
	await settle()
	await type('')
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(searches()).toHaveLength(1)
})

test('clear resets the query and its results', async () => {
	answer = [{ id: 'r1' }]
	await type('abc')
	await settle()
	await act(async () => api.clear())
	expect(api.query).toBe('')
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
})

// The opposite edge: returning to a query already settled must not leave the spinner on forever.
test('retyping a settled query serves it without a spinner or a request', async () => {
	answer = [{ id: 'r1' }]
	await type('abc')
	await settle()
	await type('ab')
	await type('abc')
	await settle()
	expect(api.isSearching).toBe(false)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
	expect(searches()).toHaveLength(1)
})

test('a failed response clears the results for that query and reports the failure', async () => {
	answer = [{ id: 'r1' }]
	await type('abc')
	await settle()
	expect(api.failed).toBe(false)
	answer = 'fail'
	await type('abcd')
	await settle()
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(api.failed).toBe(true)
})

// The opposite edge: a server that answers with no matches is an empty result, not a failure.
test('an empty answer is not reported as a failure', async () => {
	answer = []
	await type('abc')
	await settle()
	expect(api.results).toEqual([])
	expect(api.failed).toBe(false)
})

test('retry reruns the failed query without retyping', async () => {
	answer = 'fail'
	await type('abc')
	await settle()
	expect(api.failed).toBe(true)

	answer = [{ id: 'r1' }]
	await act(async () => api.retry())
	expect(api.isSearching).toBe(true)
	expect(api.failed).toBe(false)
	await settle()
	expect(searches()).toHaveLength(2)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
})

test('no request runs while the hook is disabled or signed out', async () => {
	enabled = false
	await render()
	await type('abc')
	await settle()
	expect(searches()).toHaveLength(0)
	expect(api.isSearching).toBe(false)

	enabled = true
	await act(async () => pb.authStore.clear())
	await render()
	await settle()
	expect(searches()).toHaveLength(0)
	expect(api.isSearching).toBe(false)
})

test('a failed search can be retried by clearing and retyping', async () => {
	answer = 'fail'
	await type('abc')
	await settle()
	expect(api.results).toEqual([])
	expect(api.isSearching).toBe(false)
	expect(searches()).toHaveLength(1)

	answer = [{ id: 'r1' }]
	await type('')
	await type('abc')
	await settle()

	expect(searches()).toHaveLength(2)
	expect(api.results.map((r: any) => r.id)).toEqual(['r1'])
})
