// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { AddChartModal } from './AddChartModal/AddChartModal'
import { QuickAddPalette } from './QuickAddPalette'

const mocks = vi.hoisted(() => ({ closeEditor: vi.fn() }))
vi.mock('../ProDashboardAPIContext', () => ({
	useProDashboardCatalog: () => ({
		protocols: [{ id: 'uniswap', name: 'Uniswap', slug: 'uniswap', tvl: 1, chains: [], symbol: 'UNI' }],
		chains: [],
		protocolsLoading: false,
		parentMapping: new Map()
	}),
	useProDashboardTime: () => ({ timePeriod: '365d', customTimePeriod: null }),
	useProDashboardEditorActions: () => ({ handleAppendItems: () => ['text-new'], handleEditItem: () => true }),
	useProDashboardItemsState: () => ({ items: [] }),
	useProDashboardVariables: () => ({ variables: [] })
}))
vi.mock('../AppMetadataContext', () => ({
	useAppMetadata: () => ({
		loading: false,
		availableProtocolChartTypes: () => ['tvl', 'fees'],
		availableChainChartTypes: () => []
	})
}))
vi.mock('../hooks/useIsSqlAllowed', () => ({
	useIsSqlAllowed: () => ({ isAllowed: false, isUnknown: false, isRetrying: false, retry: vi.fn() })
}))
vi.mock('./AddChartModal/useComposerItemsData', () => ({ useComposerItemsData: () => [] }))
vi.mock('./AddChartModal/ChartTab', () => ({ ChartTab: () => null }))
vi.mock('./AddChartModal/MetricTab', () => ({ MetricTab: () => null }))
vi.mock('./AddChartModal/UnifiedTableTab', () => ({ UnifiedTableTab: () => null }))
vi.mock('./AddChartModal/LlamaAITab', () => ({ LlamaAITab: () => null }))
vi.mock('./AddChartModal/CustomDataTab', () => ({ CustomDataTab: () => null }))
vi.mock('./SqlChart/SqlChartUpsell', () => ({ SqlChartUpsell: () => null }))

function Harness() {
	const [palette, setPalette] = useState<{ open: boolean } | null>(null)
	const [editor, setEditor] = useState<{ open: boolean; draftItem?: DashboardItemConfig } | null>(null)
	return (
		<>
			<button type="button" onClick={() => setPalette({ open: true })}>
				Add card
			</button>
			{editor ? (
				<AddChartModal
					isOpen={editor.open}
					draftItem={editor.draftItem}
					onClose={() => {
						mocks.closeEditor()
						setEditor((current) => (current ? { ...current, open: false } : null))
					}}
					onClosed={() => setEditor(null)}
				/>
			) : null}
			{palette ? (
				<QuickAddPalette
					open={palette.open}
					onClose={() => setPalette({ open: false })}
					onClosed={() => setPalette(null)}
					onOpenFullEditor={({ draftItem }) => {
						setPalette({ open: false })
						setEditor({ open: true, draftItem })
					}}
				/>
			) : null}
		</>
	)
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function openPalette() {
	await act(async () => root.render(<Harness />))
	const trigger = container.querySelector('button')!
	await act(async () => {
		trigger.focus()
		trigger.click()
	})
	await vi.waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('Quick add'))
	return trigger
}

test.each(['click', 'Enter', 'Tab', 'all card types'])(
	'%s hands focus from quick add to the loaded editor without returning to the dashboard',
	async (action) => {
		const trigger = await openPalette()
		const restoreFocus = vi.fn()
		trigger.addEventListener('focus', restoreFocus)
		if (action === 'all card types') {
			const button = Array.from(document.querySelectorAll('button')).find(
				(node) => node.textContent === 'All card types…'
			)!
			await act(async () => button.click())
		} else {
			const input = document.querySelector<HTMLInputElement>('input[aria-label="Quick add"]')!
			await act(async () => {
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
					input,
					action === 'Tab' ? 'uniswap fees' : 'text'
				)
				input.dispatchEvent(new Event('input', { bubbles: true }))
			})
			await act(async () => {
				if (action === 'click') {
					const textRow = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((row) =>
						row.textContent?.includes('Text block')
					)!
					textRow.click()
				} else {
					input.dispatchEvent(new KeyboardEvent('keydown', { key: action, bubbles: true, cancelable: true }))
				}
			})
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 100))
		})
		expect(restoreFocus).not.toHaveBeenCalled()
		expect(mocks.closeEditor).not.toHaveBeenCalled()
		expect(document.querySelector('.add-chart-dialog')).not.toBeNull()
		expect(document.querySelector('.add-chart-dialog')!.contains(document.activeElement)).toBe(true)
	}
)

test.each(['Escape', 'close button'])('closing quick add with %s still returns focus to Add card', async (action) => {
	const trigger = await openPalette()
	await act(async () => {
		if (action === 'Escape') {
			document.activeElement!.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
			)
		} else {
			document.querySelector<HTMLButtonElement>('[aria-label="Close quick add"]')!.click()
		}
	})
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(document.querySelector('[role="dialog"]')).toBeNull()
})
