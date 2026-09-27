import { afterEach, beforeEach } from 'vitest'

const unexpectedFetches: Array<string> = []
const actWarnings: Array<string> = []

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.fetch = (async (input: RequestInfo | URL) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	unexpectedFetches.push(url)
	throw new Error(`Unexpected network request in test: ${url}`)
}) as typeof fetch

// React only logs updates outside act, and a late one can crash a worker at teardown, so they fail the test.
const logError = console.error
console.error = (...args: Array<unknown>) => {
	const [message, component] = args
	if (typeof message === 'string' && message.includes('not wrapped in act')) {
		actWarnings.push(message.split('\n')[0]!.replace('%s', String(component)))
	}
	logError(...args)
}

beforeEach(() => {
	unexpectedFetches.length = 0
	actWarnings.length = 0
})

afterEach(() => {
	if (unexpectedFetches.length > 0) {
		throw new Error(`Unexpected network requests in test:\n${unexpectedFetches.join('\n')}`)
	}
	if (actWarnings.length > 0) {
		throw new Error(
			`React updated outside act:\n${actWarnings.join('\n')}\nWrap the event in act, or wait with waitForUi from src/utils/testing/waitForUi.ts.`
		)
	}
})
