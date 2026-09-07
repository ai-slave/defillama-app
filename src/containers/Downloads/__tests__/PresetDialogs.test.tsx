// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DownloadsCatalog } from '../DownloadsCatalog'
import type { SavedDownload } from '../savedDownloads'
const { deleted, renamed } = vi.hoisted(() => ({ deleted: vi.fn(), renamed: vi.fn() }))
vi.mock('~/auth', () => ({
	useAuthContext: () => ({ isAuthenticated: true, hasActiveSubscription: true, loaders: {} })
}))
vi.mock('~/contexts/LocalStorage', () => ({
	useRecentDownloads: () => ({ recentDownloads: [], clearRecents: vi.fn() }),
	useSavedDownloads: () => {
		const [savedDownloads, setSavedDownloads] = useState<Array<SavedDownload>>([
			{ id: 'one', name: 'First preset', kind: 'dataset', slug: 'protocols', columns: [], createdAt: 1 },
			{ id: 'two', name: 'Second preset', kind: 'dataset', slug: 'protocols', columns: [], createdAt: 2 }
		])
		return {
			savedDownloads,
			deleteDownload: (id: string) => {
				deleted(id)
				setSavedDownloads((items) => items.filter((item) => item.id !== id))
			},
			renameDownload: renamed
		}
	}
}))
vi.mock('../DatasetPreviewModal', () => ({ DatasetPreviewModal: () => null }))
vi.mock('../ChartDatasetModal', () => ({ ChartDatasetModal: () => null }))
vi.mock('../MultiMetricModal', () => ({ MultiMetricModal: () => null }))
vi.mock('~/containers/Subscription/shared/TrialCsvLimitModal', () => ({ TrialCsvLimitModal: () => null }))
let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	vi.clearAllMocks()
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(<DownloadsCatalog chartOptionsMap={{}} />))
	await click(button('Saved'))
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
		(el) => el.getAttribute('aria-label') === name || el.textContent?.trim() === name
	)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function escape() {
	await act(async () =>
		document.activeElement!.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		)
	)
}

test('delete cancellation returns focus; confirming returns to Saved even after the last preset', async () => {
	const trigger = button('Delete First preset')
	await click(trigger)
	const dialog = document.querySelector('[role="alertdialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Delete preset?')
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Cancel')))
	await escape()
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(deleted).not.toHaveBeenCalled()
	const deletePreset = async (name: string, id: string) => {
		await click(button(`Delete ${name}`))
		await click(button('Delete'))
		await vi.waitFor(() => expect(document.activeElement).toBe(button('Saved')))
		expect(deleted).toHaveBeenLastCalledWith(id)
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	}
	await deletePreset('First preset', 'one')
	await deletePreset('Second preset', 'two')
	expect(deleted).toHaveBeenCalledTimes(2)
	expect(container.textContent).toContain('Pin your first preset')
})

test('rename starts in the named input, retains edits through rerender, and cancels without saving', async () => {
	const trigger = button('Rename First preset')
	await click(trigger)
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Rename preset')
	const input = dialog.querySelector<HTMLInputElement>('input')!
	await vi.waitFor(() => expect(document.activeElement).toBe(input))
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Unsubmitted draft')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => root.render(<DownloadsCatalog chartOptionsMap={{}} />))
	expect(input.value).toBe('Unsubmitted draft')
	await escape()
	await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
	expect(renamed).not.toHaveBeenCalled()
	await click(trigger)
	expect(document.querySelector<HTMLInputElement>('[role="dialog"] input')!.value).toBe('First preset')
})

test('catalog navigation preserves visible search and category deselection without activating on arrow focus', async () => {
	await click(button('Datasets'))
	const categories = document.querySelector('[role="group"][aria-label="Dataset categories"]')!
	const all = categories.querySelector<HTMLButtonElement>('button')!
	const category = categories.querySelectorAll<HTMLButtonElement>('button')[1]!
	await click(category)
	expect(category.getAttribute('aria-pressed')).toBe('true')
	expect(all.getAttribute('aria-pressed')).toBe('false')
	await click(category)
	expect(category.getAttribute('aria-pressed')).toBe('false')
	expect(all.getAttribute('aria-pressed')).toBe('true')

	const input = document.querySelector<HTMLInputElement>('input[inputmode="search"]')!
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'no-matching-dataset')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(container.textContent).toContain('No datasets match your search.')
	await click(button('Saved'))
	expect(document.querySelector('input[inputmode="search"]')).toBeNull()
	await click(button('Datasets'))
	expect(document.querySelector<HTMLInputElement>('input[inputmode="search"]')!.value).toBe('no-matching-dataset')
	expect(container.textContent).toContain('No datasets match your search.')

	await act(async () => {
		button('Datasets').focus()
		button('Datasets').dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
		)
	})
	await vi.waitFor(() => expect(document.activeElement).toBe(button('Time Series')))
	expect(button('Datasets').getAttribute('aria-selected')).toBe('true')
	await click(button('Time Series'))
	const panel = document.querySelector('[role="tabpanel"]')!
	expect(button('Time Series').getAttribute('aria-controls')).toBe(panel.id)
	expect(panel.getAttribute('aria-labelledby')).toBe(button('Time Series').id)
	expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
})
