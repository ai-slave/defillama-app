// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DashboardTestProvider } from '~/utils/testing/dashboardContext'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import type { UnifiedTableConfig } from '../../../unifiedTable/config/current'
import { AddChartModal } from '../AddChartModal'

vi.mock('next/router', () => ({ useRouter: () => ({ pathname: '/pro/test', query: {}, push: vi.fn() }) }))
// The Charts tab a new card opens on is a heavy child; these tests assert only the table wizard.
vi.mock('../UnifiedChartTab', () => ({ UnifiedChartTab: () => null }))

const session = installSubscriberSession('u1', { resolved: true })
const editTable = vi.fn()

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	editTable.mockReset()
	session.serve({ '/subscription/trial-available': { trialAvailable: false } })
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const savedTable: UnifiedTableConfig = {
	id: 'table',
	kind: 'unified-table',
	configVersion: 3,
	strategy: 'protocols',
	rowHeaders: ['chain', 'protocol'],
	params: { chains: ['All'] }
}

const button = (name: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button')].find((element) => element.textContent?.startsWith(name))!
const grouping = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((element) =>
		element.textContent?.startsWith(label)
	)!
const tab = (value: string) => document.querySelector<HTMLButtonElement>(`[role="tab"][id$="-tab-${value}"]`)!
const discardQuestion = () => document.querySelector('[role="alertdialog"]')?.querySelector('h2')?.textContent ?? null

async function click(element: HTMLElement) {
	await act(async () => {
		element.focus()
		element.click()
	})
}
async function pressEscape() {
	await act(async () => {
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
	})
}
async function show(editItem?: UnifiedTableConfig) {
	const onClose = vi.fn()
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleEditItem: editTable }}>
					<AddChartModal isOpen onClose={onClose} {...(editItem ? { editItem } : {})} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await waitForUi(() => expect(grouping('Category')).toBeDefined())
	return onClose
}

test('a grouping change to a saved protocols table asks before Escape drops it', async () => {
	const onClose = await show(savedTable)
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('false')
	await click(grouping('Category'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('true')

	await pressEscape()
	await waitForUi(() => expect(discardQuestion()).toBe('Discard your changes?'))
	expect(onClose).not.toHaveBeenCalled()
})

test('a saved protocols table browsed without changes closes at once on Escape', async () => {
	const onClose = await show(savedTable)
	await click(button('Columns ('))
	expect(document.querySelector('button[aria-pressed]')).toBeNull()
	await click(button('Grouping & views'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('false')

	await pressEscape()
	expect(onClose).toHaveBeenCalledTimes(1)
	expect(discardQuestion()).toBeNull()
})

test('a new protocols table keeps its grouping after the reader visits another tab', async () => {
	await act(async () =>
		root.render(
			<session.Wrapper>
				<DashboardTestProvider editorActions={{ handleEditItem: editTable }}>
					<AddChartModal isOpen onClose={vi.fn()} />
				</DashboardTestProvider>
			</session.Wrapper>
		)
	)
	await click(tab('table'))
	await click(button('Protocols'))
	await waitForUi(() => expect(grouping('Category')).toBeDefined())
	await click(grouping('Category'))

	await click(tab('text'))
	expect(document.querySelector('button[aria-pressed]')).toBeNull()
	await click(tab('table'))
	expect(grouping('Category').getAttribute('aria-pressed')).toBe('true')
})
