// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardLoadProgress } from './DashboardLoadProgress'

const mocks = vi.hoisted(() => ({
	progress: {
		readyCount: 0,
		totalCount: 0,
		isStreaming: false,
		isDone: false,
		error: null as string | null
	}
}))
vi.mock('../ProDashboardAPIContext', () => ({
	useDashboardStreamProgress: () => mocks.progress
}))

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	mocks.progress = { readyCount: 0, totalCount: 0, isStreaming: false, isDone: false, error: null }
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function renderProgress() {
	await act(async () => root.render(<DashboardLoadProgress />))
}

test('a slow stream reports how many cards are ready', async () => {
	mocks.progress = { readyCount: 3, totalCount: 8, isStreaming: true, isDone: false, error: null }
	await renderProgress()
	expect(container.querySelector('[role="progressbar"]')).toBeNull()

	await act(async () => {
		vi.advanceTimersByTime(500)
	})
	const bar = container.querySelector('[role="progressbar"]')
	expect(bar?.getAttribute('aria-valuenow')).toBe('3')
	expect(bar?.getAttribute('aria-valuemax')).toBe('8')
	expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading cards… 3 of 8')
})

test('a finished stream renders nothing', async () => {
	mocks.progress = { readyCount: 8, totalCount: 8, isStreaming: false, isDone: true, error: null }
	await renderProgress()
	await act(async () => {
		vi.advanceTimersByTime(1000)
	})
	expect(container.innerHTML).toBe('')
})

test('a failed stream explains that cards load one by one', async () => {
	mocks.progress = { readyCount: 0, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' }
	await renderProgress()
	const notice = container.querySelector('[role="status"]')
	expect(notice?.textContent).toContain('Live data stream failed, cards are loading one by one.')
	expect(container.querySelector('button')).toBeNull()
})

test('the stream failure notice goes away once the cards have loaded on their own', async () => {
	mocks.progress = { readyCount: 8, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' }
	await renderProgress()
	expect(container.textContent).not.toContain('Live data stream failed')
})

test('the stream failure notice stops nagging after a while', async () => {
	mocks.progress = { readyCount: 1, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' }
	await renderProgress()
	expect(container.textContent).toContain('Live data stream failed')
	await act(async () => {
		vi.advanceTimersByTime(9000)
	})
	expect(container.textContent).not.toContain('Live data stream failed')
})

test('an empty dashboard and an unauthorised stream stay quiet', async () => {
	mocks.progress = { readyCount: 0, totalCount: 0, isStreaming: false, isDone: true, error: 'Stream failed: 500' }
	await renderProgress()
	expect(container.innerHTML).toBe('')

	mocks.progress = { readyCount: 0, totalCount: 4, isStreaming: false, isDone: true, error: 'Stream failed: 401' }
	await renderProgress()
	expect(container.innerHTML).toBe('')
})
