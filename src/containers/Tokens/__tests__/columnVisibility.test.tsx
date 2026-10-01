// @vitest-environment happy-dom
import { act } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { renderHydrated } from '~/utils/testing/hydration'
import { waitForUi } from '~/utils/testing/waitForUi'
import { useTokensColumnVisibility } from '../columnVisibility'

const STORAGE_KEY = 'tokens-table-column-visibility-v2'
const pageClockSec = 1_790_000_000

function ColumnProbe() {
	const [visibility, setVisibility] = useTokensColumnVisibility()
	return (
		<>
			<output>{visibility.price === false ? 'price hidden' : 'price shown'}</output>
			<button type="button" onClick={() => setVisibility((old) => ({ ...old, price: false }))}>
				Hide price
			</button>
		</>
	)
}
const shown = (container: HTMLElement) => container.querySelector('output')!.textContent

afterEach(() => {
	localStorage.clear()
	vi.restoreAllMocks()
})

test('hydrates with the default columns, then shows the stored choice', async () => {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ price: false }))
	const page = await renderHydrated(<ColumnProbe />, { pageClockSec })
	expect(page.serverHtml).toContain('price shown')
	expect(page.errors).toEqual([])
	expect(shown(page.container)).toBe('price hidden')
	await page.unmount()
})

test.each(['{not json', '"price"'])('falls back to the default columns for a stored %s', async (stored) => {
	localStorage.setItem(STORAGE_KEY, stored)
	const page = await renderHydrated(<ColumnProbe />, { pageClockSec })
	expect(shown(page.container)).toBe('price shown')
	await page.unmount()
})

test('follows a column choice saved in another tab', async () => {
	const page = await renderHydrated(<ColumnProbe />, { pageClockSec })
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ price: false }))
	await act(async () =>
		window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, storageArea: localStorage }))
	)
	await waitForUi(() => expect(shown(page.container)).toBe('price hidden'))
	await page.unmount()
})

test('saves a choice, and keeps it for the visit when storage refuses to save it', async () => {
	const page = await renderHydrated(<ColumnProbe />, { pageClockSec })
	const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
		throw new DOMException('Blocked', 'SecurityError')
	})
	await act(async () => page.container.querySelector('button')!.click())
	expect(shown(page.container)).toBe('price hidden')
	expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

	setItem.mockRestore()
	await act(async () => page.container.querySelector('button')!.click())
	expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ price: false })
	await page.unmount()
})
