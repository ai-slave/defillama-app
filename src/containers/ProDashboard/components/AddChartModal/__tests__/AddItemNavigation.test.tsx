// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { fieldErrorTexts } from '~/utils/testing/fieldErrors'
import { installSubscriberSession, type SessionOptions } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DASHBOARD_ITEM_REVEAL_EVENT } from '../../../hooks/useDashboardItemDeepLink'
import { AddChartModal } from '../AddChartModal'
import { CHART_MODE_STORAGE_KEY, writePreferredChartMode } from '../chartModePreference'

const { openSql, appendItems } = vi.hoisted(() => ({
	openSql: vi.fn(),
	appendItems: vi.fn()
}))
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock, toast: toastMock }))
vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))
vi.mock('../ChartBuilderTab', () => ({ ChartBuilderTab: () => <p>Chart builder preview</p> }))
vi.mock('../UnifiedChartTab', () => ({ UnifiedChartTab: () => <p>Manual charts</p> }))
vi.mock('../MetricTab', () => ({ MetricTab: () => <p>Metric configuration</p> }))
vi.mock('../UnifiedTableTab', () => ({ UnifiedTableTab: () => null }))
vi.mock('../LlamaAITab', () => ({ LlamaAITab: () => null }))

let session: ReturnType<typeof installSubscriberSession>
function signInAs(options: SessionOptions) {
	const installed = installSubscriberSession('u1', { ...options, resolved: true })
	beforeEach(() => {
		session = installed
		session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	})
}
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.clearAllMocks()
	localStorage.removeItem(CHART_MODE_STORAGE_KEY)
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
async function show(modal: React.ReactElement) {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleAppendItems: appendItems, handleEditItem: vi.fn() }}>
					{modal}
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
}
async function renderModal() {
	await show(<AddChartModal isOpen onClose={vi.fn()} onOpenSqlModal={openSql} />)
}

describe('a subscriber without SQL access', () => {
	signInAs({})

	test('the SQL tab shows a subscription hand-off without opening the editor', async () => {
		await renderModal()
		await pressKey(tab('charts'), 'End')
		await waitForUi(() => expect(document.activeElement).toBe(tab('sql')))
		expect(openSql).not.toHaveBeenCalled()
		expect(tab('charts').getAttribute('aria-selected')).toBe('true')
		await click(tab('sql'))
		expect(document.body.textContent).toContain('Author charts from SQL')
		expect(openSql).not.toHaveBeenCalled()
	})

	test('nested navigation unmounts inactive previews while text drafts survive section changes', async () => {
		await renderModal()
		const dialog = document.querySelector('[role="dialog"]')!
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Add card')
		expect(tab('manual').getAttribute('aria-selected')).toBe('true')
		expect(document.body.textContent).not.toContain('Chart builder preview')
		await click(tab('builder'))
		expect(document.body.textContent).toContain('Chart builder preview')
		await pressKey(tab('builder'), 'ArrowRight')
		await waitForUi(() => expect(document.activeElement).toBe(tab('manual')))
		expect(document.body.textContent).toContain('Chart builder preview')
		expect(tab('builder').getAttribute('aria-selected')).toBe('true')
		await click(tab('manual'))
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

	test('Add card on an empty text card says what is missing under the content, focuses it and adds nothing', async () => {
		await renderModal()
		await click(tab('text'))
		const add = [...document.querySelectorAll<HTMLButtonElement>('footer button')].find(
			(button) => button.textContent === 'Add card'
		)!
		const errors = () => fieldErrorTexts(document.querySelector('[role="dialog"]')!)
		expect(add.getAttribute('aria-disabled')).toBeNull()
		expect(errors()).toEqual([])
		await click(add)
		const content = document.querySelector<HTMLTextAreaElement>('textarea')!
		expect(errors()).toEqual(['Enter some text.'])
		expect(document.activeElement).toBe(content)
		expect(content.getAttribute('aria-invalid')).toBe('true')
		expect(appendItems).not.toHaveBeenCalled()
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, 'Notes')
			content.dispatchEvent(new Event('input', { bubbles: true }))
		})
		expect(errors()).toEqual([])
	})

	test('Add on an empty custom data card shows the error under the CSV, and every failed Add brings its pane back', async () => {
		await renderModal()
		await click(tab('custom-data'))
		const add = [...document.querySelectorAll<HTMLButtonElement>('footer button')].find(
			(button) => button.textContent === 'Add card'
		)!
		const pane = (name: string) =>
			[...document.querySelectorAll<HTMLInputElement>('[role="radiogroup"] input[type="radio"]')].find(
				(radio) => radio.closest('label')?.textContent === name
			)!
		const csv = document.querySelector<HTMLTextAreaElement>('textarea')!
		await click(add)
		expect(fieldErrorTexts(document.querySelector('[role="dialog"]')!)).toHaveLength(1)
		expect(document.activeElement).toBe(csv)
		// Below lg a second press finds the error unchanged; it must still bring the CSV fields back to take focus.
		for (let press = 0; press < 2; press++) {
			await click(pane('Preview'))
			expect(pane('Preview').checked).toBe(true)
			await click(add)
			expect(pane('Configure').checked).toBe(true)
			expect(document.activeElement).toBe(csv)
		}
		expect(appendItems).not.toHaveBeenCalled()
	})

	test('a fresh Table tab asks for a table type, and its Cancel closes without asking to discard', async () => {
		const onClose = vi.fn()
		await show(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />)
		await click(tab('table'))
		expect(document.querySelector('footer')!.textContent).toContain('Pick a table type to start')
		await click([...document.querySelectorAll('button')].find((button) => button.textContent === 'Cancel')!)
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(document.body.textContent).not.toContain('Discard this card?')
	})

	test('a draft in another tab still asks before the card closes, and Discard after Escape closes it', async () => {
		const onClose = vi.fn()
		await show(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />)
		await click(tab('text'))
		const content = document.querySelector<HTMLTextAreaElement>('textarea')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, '# Notes')
			content.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await click(tab('charts'))
		await pressKey(tab('charts'), 'Escape')
		const confirm = await waitForUi(() => {
			const found = document.querySelector<HTMLElement>('[role="alertdialog"]')
			expect(found?.textContent).toContain('Discard this card?')
			return found!
		})
		expect(onClose).not.toHaveBeenCalled()
		await click([...confirm.querySelectorAll('button')].find((button) => button.textContent === 'Discard')!)
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	test('browsing every tab of a fresh card that opens on Top-N closes at once on Escape', async () => {
		writePreferredChartMode('builder')
		const onClose = vi.fn()
		await show(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />)
		for (const value of ['metric', 'table', 'text', 'charts']) await click(tab(value))
		await pressKey(tab('charts'), 'Escape')
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	})

	test('editing hides the tab list and shows the card type in the header', async () => {
		await show(
			<AddChartModal
				key="edit"
				isOpen
				onClose={vi.fn()}
				editItem={{ id: 'text', kind: 'text', title: 'Title', content: 'Existing content' }}
			/>
		)
		expect(document.querySelector('[role="tablist"][aria-label="Card type"]')).toBeNull()
		const dialog = document.querySelector('[role="dialog"]')!
		expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Edit card \u00b7 Text')
		expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Existing content')
		expect(appendItems).not.toHaveBeenCalled()
	})

	test('a refused add keeps the modal open and says why beside its button, not in a toast', async () => {
		appendItems.mockReturnValue({
			status: 'refused',
			reason: 'Dashboard is too large (2100 KB). Remove rows or a card.'
		})
		const onClose = vi.fn()
		await show(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} />)
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
		expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toBe(
			'Dashboard is too large (2100 KB). Remove rows or a card.'
		)
		expect(toastMock.error).not.toHaveBeenCalled()
	})

	test.each([
		['a new card', undefined],
		['a quick add draft', { id: 'quick-add-draft', kind: 'text', title: '', content: 'A note' } as const]
	])('submitting %s appends it and reveals it once the modal has closed', async (_label, draftItem) => {
		appendItems.mockReturnValue({ status: 'saved', ids: ['text-new'] })
		const onClose = vi.fn()
		const reveals: Array<{ itemId: string; closedFirst: boolean }> = []
		const listener = (event: Event) => {
			const detail = (event as CustomEvent<{ itemId: string }>).detail
			reveals.push({ itemId: detail.itemId, closedFirst: onClose.mock.calls.length > 0 })
		}
		window.addEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
		try {
			await show(<AddChartModal isOpen onClose={onClose} onOpenSqlModal={openSql} draftItem={draftItem} />)
			if (!draftItem) {
				await click(tab('text'))
				const content = document.querySelector<HTMLTextAreaElement>('textarea')!
				await act(async () => {
					Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, 'A note')
					content.dispatchEvent(new Event('input', { bubbles: true }))
				})
			}
			expect(document.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('A note')
			const submit = Array.from(document.querySelectorAll('button')).find(
				(button) => button.textContent?.trim() === 'Add card'
			)!
			await click(submit)
			expect(reveals).toEqual([{ itemId: 'text-new', closedFirst: true }])
		} finally {
			window.removeEventListener(DASHBOARD_ITEM_REVEAL_EVENT, listener)
		}
	})

	test('the sheet reports it has finished leaving only after it was open', async () => {
		const onClosed = vi.fn()
		await show(<AddChartModal isOpen={false} onClose={vi.fn()} onClosed={onClosed} />)
		expect(onClosed).not.toHaveBeenCalled()

		await show(<AddChartModal isOpen onClose={vi.fn()} onClosed={onClosed} />)
		expect(document.querySelector('[role="dialog"]')).not.toBeNull()
		expect(onClosed).not.toHaveBeenCalled()

		await show(<AddChartModal isOpen={false} onClose={vi.fn()} onClosed={onClosed} />)
		expect(document.querySelector('[role="dialog"]')).toBeNull()
		expect(onClosed).toHaveBeenCalledOnce()
	})
})

describe('a reader with SQL access', () => {
	signInAs({ record: { flags: { is_llama: true } } })

	test('the SQL tab opens the editor only from its button', async () => {
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

	test('opening the SQL editor asks first when another tab holds a draft', async () => {
		await renderModal()
		await click(tab('text'))
		const content = document.querySelector<HTMLTextAreaElement>('textarea')!
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(content, '# Notes')
			content.dispatchEvent(new Event('input', { bubbles: true }))
		})
		await click(tab('sql'))
		await click(
			Array.from(document.querySelectorAll('button')).find(
				(button) => button.textContent?.trim() === 'Open SQL editor'
			)!
		)
		const confirm = await waitForUi(() => {
			const found = document.querySelector<HTMLElement>('[role="alertdialog"]')
			expect(found?.textContent).toContain('Discard this card?')
			return found!
		})
		expect(openSql).not.toHaveBeenCalled()
		await click([...confirm.querySelectorAll('button')].find((button) => button.textContent === 'Discard')!)
		expect(openSql).toHaveBeenCalledTimes(1)
	})
})
