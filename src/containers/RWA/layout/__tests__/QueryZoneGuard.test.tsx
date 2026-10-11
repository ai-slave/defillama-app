// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RWA_QUERY_PENDING_CLASS, RWAQueryZoneGuard } from '../QueryZoneGuard'

const router = vi.hoisted(() => ({ isReady: false }))
vi.mock('next/router', () => ({ useRouter: () => router }))
// The head's children render in place, so a test can run the script the page serves.
vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))

let unmount = async () => {}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	document.documentElement.classList.add(RWA_QUERY_PENDING_CLASS)
})

afterEach(async () => {
	vi.useRealTimers()
	await unmount()
	document.documentElement.classList.remove(RWA_QUERY_PENDING_CLASS)
})

async function render() {
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () => root.render(<RWAQueryZoneGuard />))
	unmount = async () => act(async () => root.unmount())
	return container
}

/** Runs the served head script at an address, as the browser does before the first paint. */
function expectPendingAt(container: HTMLElement, search: string, pending: boolean) {
	document.documentElement.classList.remove(RWA_QUERY_PENDING_CLASS)
	history.replaceState(null, '', `/rwa/platform/ondo${search}`)
	new Function(container.querySelector('script')!.textContent!)()
	expect(document.documentElement.classList.contains(RWA_QUERY_PENDING_CLASS)).toBe(pending)
}

test('keeps the query zones hidden until the router has read the address', async () => {
	router.isReady = false
	const container = document.createElement('div')
	const root = createRoot(container)
	unmount = async () => act(async () => root.unmount())
	await act(async () => root.render(<RWAQueryZoneGuard />))
	expect(document.documentElement.classList.contains(RWA_QUERY_PENDING_CLASS)).toBe(true)

	router.isReady = true
	await act(async () => root.render(<RWAQueryZoneGuard />))
	expect(document.documentElement.classList.contains(RWA_QUERY_PENDING_CLASS)).toBe(false)
})

test('hides the query zones before the first paint only for a key the page reads, not for campaign tags', async () => {
	vi.useFakeTimers()
	router.isReady = false
	const container = await render()
	expectPendingAt(container, '?utm_source=x&utm_medium=email&ref=newsletter&gclid=1&fbclid=2', false)
	expectPendingAt(container, '', false)
	expectPendingAt(container, '?utm_source=x&view=information', true)
	expectPendingAt(container, '?refresh=1', true)
})
