// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DASHBOARD_ITEM_REVEAL_EVENT } from '../../../hooks/useDashboardItemDeepLink'
import { AddChartModal } from '../AddChartModal'
import { CHART_MODE_STORAGE_KEY } from '../chartModePreference'

const { sqlAccess, openSql, appendItems, builderMounted, builderUnmounted } = vi.hoisted(() => ({
	sqlAccess: { isAllowed: false, isUnknown: false, isRetrying: false, retry: vi.fn() },
	openSql: vi.fn(),
	appendItems: vi.fn(),
	builderMounted: vi.fn(),
	builderUnmounted: vi.fn()
}))
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ hasActiveSubscription: true }) }))
vi.mock('../../../hooks/useIsSqlAllowed', () => ({ useIsSqlAllowed: () => sqlAccess }))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ protocols: [], chains: [], protocolsLoading: false }),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleAppendItems: appendItems, handleEditItem: vi.fn() }),
	useProDashboardVariables: () => ({ variables: [] })
}))
vi.mock('../useComposerItemsData', () => ({ useComposerItemsData: () => [] }))
vi.mock('../ChartBuilderTab', async () => {
	const { useEffect } = await import('react')
	return {
		ChartBuilderTab: () => {
			useEffect(() => {
				builderMounted()
				return () => {
					builderUnmounted()
				}
			}, [])
			return <p>Chart builder preview</p>
		}
	}
})
vi.mock('../UnifiedChartTab', () => ({ UnifiedChartTab: () => <p>Manual charts</p> }))
vi.mock('../MetricTab', () => ({ MetricTab: () => <p>Metric configuration</p> }))
vi.mock('../UnifiedTableTab', () => ({ UnifiedTableTab: () => null }))
vi.mock('../LlamaAITab', () => ({ LlamaAITab: () => null }))
vi.mock('../../SqlChart/SqlChartUpsell', () => ({ SqlChartUpsell: () => <p>SQL subscription required</p> }))
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	vi.clearAllMocks()
	localStorage.removeItem(CHART_MODE_STORAGE_KEY)
	sqlAccess.isAllowed = false
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function tab(value: string) {
	return document.querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${value}"]`)!
}
async function click(element: HTMLElement) {
	await act(async () => {
		element.focus()
		element.click()
	})
}
async function pressKey(element: HTMLElement, key: string) {
	await act(async () => {
		element.focus()
		element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
	})
}
async function renderModal() {
	await act(async () => root.render(<AddChartModal isOpen onClose={vi.fn()} onOpenSqlModal={openSql} />))
}

test('nested navigation unmounts inactive previews while text drafts survive section changes', async () => {
	await renderModal()
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Add card')
	expect(tab('manual').getAttribute('aria-selected')).toBe('true')
	expect(builderMounted).not.toHaveBeenCalled()
	await click(tab('builder'))
	expect(builderMounted).toHaveBeenCalledTimes(1)
	await pressKey(tab('builder'), 'ArrowRight')
	await vi.waitFor(() => expect(document.activeElement).toBe(tab('manual')))
	expect(builderUnmounted).not.toHaveBeenCalled()
	expect(tab('builder').getAttribute('aria-selected')).toBe('true')
	await click(tab('manual'))
	expect(builderUnmounted).toHaveBeenCalledTimes(1)
	expect(document.body.textContent).toContain('Manual charts')
	expect(document.body.textContent).not.toContain('Chart builder preview')
	const manualPanel = document.getElementById(tab('manual').getAttribute('aria-controls')!)!
	expect(manualPanel.getAttribute('aria-labelledby')).toBe(tab('manual').id)

	await click(tab('text'))
	const content = document.querySelector<HTMLTextAreaElement>('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, 'Keep this draft')
		content.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await click(tab('metric'))
	expect(document.querySelector('textarea')).toBeNull()
	await click(tab('text'))
	expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Keep this draft')
	expect(appendItems).not.toHaveBeenCalled()
})

test('the SQL tab shows a hand-off panel and opens the editor only from its button', async () => {
	await renderModal()
	await pressKey(tab('charts'), 'End')
	await vi.waitFor(() => expect(document.activeElement).toBe(tab('sql')))
	expect(openSql).not.toHaveBeenCalled()
	expect(tab('charts').getAttribute('aria-selected')).toBe('true')
	await click(tab('sql'))
	expect(document.body.textContent).toContain('SQL subscription required')
	expect(openSql).not.toHaveBeenCalled()

	sqlAccess.isAllowed = true
	await renderModal()
	await click(tab('sql'))
	expect(openSql).not.toHaveBeenCalled()
	expect(document.body.textContent).toContain('SQL cards are built in the SQL editor')
	const openEditor = Array.from(document.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === 'Open SQL editor'
	)!
	await click(openEditor)
	expect(openSql).toHaveBeenCalledTimes(1)
	expect(document.querySelector('[role="tablist"][aria-label="Card type"]')).not.toBeNull()
})

test('editing hides the tab list and shows the card type in the header', async () => {
	await act(async () =>
		root.render(
			<AddChartModal
				key="edit"
				isOpen
				onClose={vi.fn()}
				editItem={{ id: 'text', kind: 'text', title: 'Title', content: 'Existing content' }}
			/>
		)
	)
	expect(document.querySelector('[role="tablist"][aria-label="Card type"]')).toBeNull()
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Edit card \u00b7 Text')
	expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Existing content')
	expect(appendItems).not.toHaveBeenCalled()
})

test('a dropped edit keeps the modal open and says the dashboard is still loading', async () => {
	appendItems.mockReturnValue(false)
	const onClose = vi.fn()
	await act(async () => root.render(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />))
	await click(tab('text'))
	const content = document.querySelector<HTMLTextAreaElement>('textarea')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, 'A note')
		content.dispatchEvent(new Event('input', { bubbles: true }))
	})
	const submit = Array.from(document.querySelectorAll('button')).find(
		(button) => button.textContent?.trim() === 'Add card'
	)!
	await click(submit)

	expect(appendItems).toHaveBeenCalledTimes(1)
	expect(onClose).not.toHaveBeenCalled()
	expect(toastMock.error).toHaveBeenCalledWith(
		'The dashboard is still loading. Try again in a moment.',
		expect.objectContaining({ id: 'dashboard-not-ready' })
	)
})

test('a submitted card asks the dashboard to reveal it once the modal has closed', async () => {
	appendItems.mockReturnValue(['text-new'])
	const onClose = vi.fn()
	const reveals: Array<{ itemId: string; closedFirst: boolean }> = []
	const listener = (event: Event) => {
		const detail = (event as CustomEvent<{ itemId: string }>).detail
		reveals.push({ itemId: detail.itemId, closedFirst: onClose.mock.calls.length > 0 })
	}
	window.addEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
	try {
		await act(async () => root.render(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />))
		await click(tab('text'))
		const content = document.querySelector<HTMLTextAreaElement>('textarea')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, 'A note')
			content.dispatchEvent(new Event('input', { bubbles: true }))
		})
		const submit = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent?.trim() === 'Add card'
		)!
		await click(submit)
		expect(reveals).toEqual([{ itemId: 'text-new', closedFirst: true }])
	} finally {
		window.removeEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
	}
})
