import { afterEach, beforeEach } from 'vitest'

const unexpectedFetches: string[] = []

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.fetch = (async (input: RequestInfo | URL) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	unexpectedFetches.push(url)
	throw new Error(`Unexpected network request in test: ${url}`)
}) as typeof fetch

beforeEach(() => {
	unexpectedFetches.length = 0
})

afterEach(() => {
	if (unexpectedFetches.length === 0) return
	throw new Error(`Unexpected network requests in test:\n${unexpectedFetches.join('\n')}`)
})
