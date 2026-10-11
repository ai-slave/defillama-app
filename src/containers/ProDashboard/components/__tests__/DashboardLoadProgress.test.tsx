// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { DashboardLoadProgress } from '../DashboardLoadProgress'

type Progress = { readyCount: number; totalCount: number; isStreaming: boolean; isDone: boolean; error: string | null }

let root: Root
let container: HTMLDivElement

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.useFakeTimers()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	vi.useRealTimers()
})

async function renderProgress(progress: Progress) {
	await act(async () =>
		root.render(
			<DashboardTestProvider streamProgress={progress}>
				<DashboardLoadProgress />
			</DashboardTestProvider>
		)
	)
}

test('a slow stream reports how many cards are ready', async () => {
	await renderProgress({ readyCount: 3, totalCount: 8, isStreaming: true, isDone: false, error: null })
	expect(container.querySelector('[role="progressbar"]')).toBeNull()

	await act(async () => {
		vi.advanceTimersByTime(500)
	})
	const bar = container.querySelector('[role="progressbar"]')
	expect(bar?.getAttribute('aria-valuenow')).toBe('3')
	expect(bar?.getAttribute('aria-valuemax')).toBe('8')
	expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading cards… 3 of 8')

	await renderProgress({ readyCount: 8, totalCount: 8, isStreaming: false, isDone: true, error: null })
	await act(async () => {
		vi.advanceTimersByTime(1000)
	})
	expect(container.querySelector('[role="progressbar"]')).toBeNull()
	expect(container.textContent).toBe('')
})

test('a failed stream explains that cards load one by one', async () => {
	await renderProgress({ readyCount: 0, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	const notice = container.querySelector('[role="status"]')
	expect(notice).not.toBeNull()
	expect(container.querySelector('button')).toBeNull()
})

test('the stream failure notice goes away once the cards have loaded on their own', async () => {
	await renderProgress({ readyCount: 1, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	expect(container.querySelector('[role="status"]')).not.toBeNull()

	await renderProgress({ readyCount: 8, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	expect(container.querySelector('[role="status"]')).toBeNull()
})

test('the stream failure notice stops nagging after a while', async () => {
	await renderProgress({ readyCount: 1, totalCount: 8, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	expect(container.querySelector('[role="status"]')).not.toBeNull()
	await act(async () => {
		vi.advanceTimersByTime(9000)
	})
	expect(container.querySelector('[role="status"]')).toBeNull()
})

test('an empty dashboard and an unauthorized stream stay quiet where a server failure speaks up', async () => {
	await renderProgress({ readyCount: 0, totalCount: 0, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	expect(container.textContent).toBe('')
	await renderProgress({ readyCount: 0, totalCount: 4, isStreaming: false, isDone: true, error: 'Stream failed: 500' })
	expect(container.querySelector('[role="status"]')).not.toBeNull()
	await act(async () => root.unmount())
	root = createRoot(container)

	await renderProgress({ readyCount: 0, totalCount: 4, isStreaming: false, isDone: true, error: 'Stream failed: 401' })
	expect(container.textContent).toBe('')
})
