// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ChartGrid } from './ChartGrid'

const mocks = vi.hoisted(() => ({
	items: ['first', 'middle', 'last'].map((id) => ({ id, kind: 'text' as const, content: id })),
	handleChartsReordered: vi.fn()
}))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardItemsState: () => ({ items: mocks.items }),
	useProDashboardPermissions: () => ({ isReadOnly: false }),
	useProDashboardEditorActions: () => ({
		handleChartsReordered: mocks.handleChartsReordered,
		handleRemoveItem: vi.fn(),
		handleColSpanChange: vi.fn(),
		handleEditItem: vi.fn()
	})
}))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => true }))
vi.mock('./TextCard', () => ({ TextCard: () => null }))
vi.mock('./ConfirmationModal', () => ({ ConfirmationModal: () => null }))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	mocks.handleChartsReordered.mockClear()
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

test.each([
	['Enter', 'Enter', 'Move up', ['middle', 'first', 'last']],
	['Space', ' ', 'Move up', ['middle', 'first', 'last']],
	['Enter', 'Enter', 'Move down', ['first', 'last', 'middle']],
	['Space', ' ', 'Move down', ['first', 'last', 'middle']]
] as const)('%s on %s/%s retains button activation instead of starting a drag', async (code, key, label, expected) => {
	await act(async () => root.render(<ChartGrid onAddChartClick={vi.fn()} />))
	const button = Array.from(container.querySelectorAll('button')).filter(
		(node) => node.textContent?.trim() === label
	)[1]
	expect(button.disabled).toBe(false)
	const keydown = new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true })
	await act(async () => {
		button.focus()
		button.dispatchEvent(keydown)
	})
	expect(keydown.defaultPrevented).toBe(false)
	expect(container.querySelector('[aria-pressed="true"]')).toBeNull()
	expect(mocks.handleChartsReordered).not.toHaveBeenCalled()
	await act(async () => button.click())
	expect(mocks.handleChartsReordered).toHaveBeenCalledOnce()
	expect(mocks.handleChartsReordered.mock.calls[0][0].map((item: { id: string }) => item.id)).toEqual(expected)
})
