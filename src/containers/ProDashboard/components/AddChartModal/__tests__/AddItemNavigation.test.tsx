// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AddChartModal } from '../AddChartModal'
import { CHART_MODE_STORAGE_KEY } from '../chartModePreference'

const { sqlAccess, openSql, appendItems, builderMounted, builderUnmounted } = vi.hoisted(() => ({
	sqlAccess: { isAllowed: false, isUnknown: false, isRetrying: false, retry: vi.fn() },
	openSql: vi.fn(),
	appendItems: vi.fn(),
	builderMounted: vi.fn(),
	builderUnmounted: vi.fn()
}))
vi.mock('~/auth', () => ({ useAuthContext: () => ({ hasActiveSubscription: true }) }))
vi.mock('../../../hooks/useIsSqlAllowed', () => ({ useIsSqlAllowed: () => sqlAccess }))
vi.mock('../../../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({ protocols: [], chains: [], protocolsLoading: false }),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleAppendItems: appendItems, handleEditItem: vi.fn() })
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
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Add Item')
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

test('SQL focus does not open the editor, denied access stays inline, and later access hands off once', async () => {
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
	expect(openSql).toHaveBeenCalledTimes(1)
})

test('allowed SQL opens only on activation and editing keeps the item type fixed', async () => {
	sqlAccess.isAllowed = true
	await renderModal()
	await pressKey(tab('charts'), 'End')
	await vi.waitFor(() => expect(document.activeElement).toBe(tab('sql')))
	expect(openSql).not.toHaveBeenCalled()
	await click(tab('sql'))
	expect(openSql).toHaveBeenCalledTimes(1)
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
	expect(tab('text').getAttribute('aria-selected')).toBe('true')
	expect(tab('charts').disabled).toBe(true)
	await click(tab('charts'))
	expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Existing content')
})
