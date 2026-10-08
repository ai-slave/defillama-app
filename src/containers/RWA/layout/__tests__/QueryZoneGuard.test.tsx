// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RWA_QUERY_PENDING_CLASS, RWAQueryZoneGuard } from '../QueryZoneGuard'

const router = vi.hoisted(() => ({ isReady: false }))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('next/head', () => ({ default: () => null }))

let unmount = async () => {}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	document.documentElement.classList.add(RWA_QUERY_PENDING_CLASS)
})

afterEach(async () => {
	await unmount()
	document.documentElement.classList.remove(RWA_QUERY_PENDING_CLASS)
})

async function render() {
	const container = document.createElement('div')
	const root = createRoot(container)
	await act(async () => root.render(<RWAQueryZoneGuard />))
	unmount = async () => act(async () => root.unmount())
}

test('keeps the query zones hidden while the router has not read the address', async () => {
	router.isReady = false
	await render()
	expect(document.documentElement.classList.contains(RWA_QUERY_PENDING_CLASS)).toBe(true)
})

test('shows the query zones once the router has read the address', async () => {
	router.isReady = true
	await render()
	expect(document.documentElement.classList.contains(RWA_QUERY_PENDING_CLASS)).toBe(false)
})
