// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readAppStorage, useSavedDownloads, writeAppStorage } from '~/contexts/LocalStorage'
import { installSubscriberSession } from '~/utils/testing/subscriberSession'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DownloadsCatalog } from '../DownloadsCatalog'
import { SavePresetDialog } from '../PresetDialogs'

// Heavy dialogs the preset list can open; these tests assert nothing about them.
vi.mock('../DatasetPreviewModal', () => ({ DatasetPreviewModal: () => null }))
vi.mock('../ChartDatasetModal', () => ({ ChartDatasetModal: () => null }))
vi.mock('../MultiMetricModal', () => ({ MultiMetricModal: () => null }))
vi.mock('~/containers/Subscription/shared/TrialCsvLimitModal', () => ({ TrialCsvLimitModal: () => null }))
vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, pathname: '/downloads', query: {} }) }))

const session = installSubscriberSession('downloader')
const savedNames = () => (readAppStorage().SAVED_DOWNLOADS ?? []).map((preset) => preset.name)
const catalog = () => (
	<session.Wrapper>
		<DownloadsCatalog chartOptionsMap={{}} />
	</session.Wrapper>
)

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
	writeAppStorage({
		SAVED_DOWNLOADS: [
			{ id: 'one', name: 'First preset', kind: 'dataset', slug: 'protocols', columns: [], createdAt: 1 },
			{ id: 'two', name: 'Second preset', kind: 'dataset', slug: 'protocols', columns: [], createdAt: 2 }
		]
	})
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	await act(async () => root.render(catalog()))
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
async function type(input: HTMLInputElement, value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
		input.dispatchEvent(new Event('input', { bubbles: true }))
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
	await waitForUi(() => expect(document.activeElement).toBe(button('Cancel')))
	await escape()
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	expect(savedNames()).toEqual(['First preset', 'Second preset'])
	const deletePreset = async (name: string, remaining: Array<string>) => {
		await click(button(`Delete ${name}`))
		await click(button('Delete'))
		await waitForUi(() => expect(document.activeElement).toBe(button('Saved')))
		expect(savedNames()).toEqual(remaining)
		expect(document.querySelector('[role="alertdialog"]')).toBeNull()
	}
	await deletePreset('First preset', ['Second preset'])
	await deletePreset('Second preset', [])
	await waitForUi(() => expect(container.textContent).toContain('Pin your first preset'))
})

test('rename starts in the named input, retains edits through rerender, and cancels without saving', async () => {
	const trigger = button('Rename First preset')
	await click(trigger)
	const dialog = document.querySelector('[role="dialog"]')!
	expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Rename preset')
	const input = dialog.querySelector<HTMLInputElement>('input')!
	await waitForUi(() => expect(document.activeElement).toBe(input))
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Unsubmitted draft')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	await act(async () => root.render(catalog()))
	expect(input.value).toBe('Unsubmitted draft')
	await escape()
	await waitForUi(() => expect(document.activeElement).toBe(trigger))
	expect(savedNames()).toEqual(['First preset', 'Second preset'])
	await click(trigger)
	expect(document.querySelector<HTMLInputElement>('[role="dialog"] input')!.value).toBe('First preset')
})

test('catalog navigation preserves visible search and the category pick without activating on arrow focus', async () => {
	await click(button('Datasets'))
	const categories = document.querySelector('[role="radiogroup"][aria-label="Dataset categories"]')!
	const radios = [...categories.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
	const names = radios.map((radio) => radio.closest('label')!.textContent)
	expect(names[0]).toMatch(/^All \d+$/)
	const sections = () => [...container.querySelectorAll('[role="tabpanel"] h2')].map((heading) => heading.textContent)
	await click(radios[1])
	expect(radios.map((radio) => radio.checked).slice(0, 2)).toEqual([false, true])
	const picked = names[1]!.replace(/ \d+$/, '')
	expect(sections()).toEqual([picked])
	expect(container.textContent).toContain(`in ${picked}`)
	await click(radios[0])
	expect(radios.map((radio) => radio.checked).slice(0, 2)).toEqual([true, false])
	expect(sections().length).toBeGreaterThan(1)

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
	await waitForUi(() => expect(document.activeElement).toBe(button('Time Series')))
	expect(button('Datasets').getAttribute('aria-selected')).toBe('true')
	await click(button('Time Series'))
	const panel = document.querySelector('[role="tabpanel"]')!
	expect(button('Time Series').getAttribute('aria-controls')).toBe(panel.id)
	expect(panel.getAttribute('aria-labelledby')).toBe(button('Time Series').id)
	expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
})

test('a saved preset offers Run, Rename and Delete as separate buttons, none nested in another', async () => {
	const run = button('Run preset First preset')
	expect(run.tagName).toBe('BUTTON')
	for (const name of ['Run preset First preset', 'Rename First preset', 'Delete First preset']) {
		expect(button(name).parentElement!.closest('button, [role="button"]')).toBeNull()
	}
	expect(document.querySelectorAll('[aria-label="Rename First preset"]')).toHaveLength(1)
})

test('Clear all on the recent strip hands focus to the selected tab', async () => {
	writeAppStorage({
		...readAppStorage(),
		RECENT_DOWNLOADS: [{ id: 'r', name: 'Recent run', kind: 'dataset', slug: 'protocols', columns: [], createdAt: 3 }]
	})
	await act(async () => root.render(catalog()))
	await click(button('Clear all'))
	await waitForUi(() => expect(container.textContent).not.toContain('Recent run'))
	expect(document.activeElement).toBe(button('Saved'))
})

// Wired the way the preview modals save a preset.
function SaveHarness() {
	const { savedDownloads, saveDownload } = useSavedDownloads()
	return (
		<SavePresetDialog
			suggestedName=""
			existingNames={savedDownloads.map((preset) => preset.name)}
			onSave={(name) =>
				saveDownload({ id: 'new', name, kind: 'dataset', slug: 'protocols', columns: [], createdAt: 3 })
			}
			onClose={() => {}}
		/>
	)
}

test('saving under a name that differs only in case replaces that preset instead of adding a second one', async () => {
	const saveRoot = createRoot(document.createElement('div'))
	await act(async () => saveRoot.render(<SaveHarness />))
	const dialog = [...document.querySelectorAll('[role="dialog"]')].find((el) =>
		el.textContent?.includes('Save preset')
	)!
	await type(dialog.querySelector('input')!, ' first PRESET ')
	expect(dialog.textContent).toContain('A preset named "First preset" exists. Saving replaces it.')
	await click(button('Replace'))
	expect(savedNames()).toEqual(['first PRESET', 'Second preset'])
	await act(async () => saveRoot.unmount())
})

test("rename refuses another preset's name, ignoring case, and keeps both presets", async () => {
	await click(button('Rename Second preset'))
	const dialog = document.querySelector('[role="dialog"]')!
	const input = dialog.querySelector<HTMLInputElement>('input')!
	await type(input, 'first PRESET')
	expect(dialog.textContent).toContain('Another preset is named "First preset". Choose a different name.')
	expect(input.getAttribute('aria-invalid')).toBe('true')
	await act(async () => {
		input.form!.requestSubmit()
	})
	expect(button('Rename').disabled).toBe(true)
	expect(savedNames()).toEqual(['First preset', 'Second preset'])
	await type(input, 'second PRESET')
	await click(button('Rename'))
	expect(savedNames()).toEqual(['First preset', 'second PRESET'])
})
