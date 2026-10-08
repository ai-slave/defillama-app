// @vitest-environment happy-dom
import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DashboardSearch } from '../DashboardSearch'

const router = vi.hoisted(() => ({
	pathname: '/pro',
	asPath: '/pro',
	query: {},
	push: vi.fn(async (_url: unknown) => true)
}))
vi.mock('next/router', () => ({ useRouter: () => router }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	router.push.mockClear()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

function type(value: string) {
	const input = container.querySelector('input')!
	act(() => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
}
function clickClear() {
	act(() => container.querySelector('button')!.click())
}
const pushedQueries = () => router.push.mock.calls.map(([url]) => (url as { query: { query?: string } }).query.query)

describe('dashboard search', () => {
	test('pushes the last typed query once the typing pauses', () => {
		act(() => root.render(<DashboardSearch ref={createRef()} />))
		type('aa')
		type('aave')
		act(() => vi.advanceTimersByTime(299))
		expect(pushedQueries()).toEqual([])
		act(() => vi.advanceTimersByTime(1))
		expect(pushedQueries()).toEqual(['aave'])
	})

	test('clearing drops the query at once and the pending search never lands', () => {
		act(() => root.render(<DashboardSearch ref={createRef()} />))
		type('aave')
		clickClear()
		act(() => vi.advanceTimersByTime(1000))
		expect(pushedQueries()).toEqual([undefined])
	})
})
