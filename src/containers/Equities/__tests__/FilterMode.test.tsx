// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, test, vi } from 'vitest'
import { EquitiesFiltersDialog } from '../EquityFiltersDialog'

vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/equities', query: {} }) }))
vi.mock('~/hooks/useMedia', () => ({ useMedia: () => false }))
let root: Root
let container: HTMLDivElement
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
function button(name: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === name)!
}
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}
async function exclude() {
	await act(async () => {
		const radio = document.querySelector<HTMLInputElement>('input[value="include"]')!
		radio.focus()
		radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
	})
	await vi.waitFor(() => expect(document.querySelector<HTMLInputElement>('input[value="exclude"]')!.checked).toBe(true))
}
test('mode navigation stays in the dialog draft until Done and cancellation restores the applied mode', async () => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	const change = vi.fn()
	await act(async () =>
		root.render(
			<EquitiesFiltersDialog
				categoricalOptions={{ country: ['US'], sector: [], industry: [] }}
				filters={[{ kind: 'categorical', id: 'country', mode: 'include', values: ['US'] }]}
				onFiltersChange={change}
			/>
		)
	)
	const trigger = [...container.querySelectorAll('button')].find((el) => el.textContent?.includes('Filters'))!
	await click(trigger)
	await exclude()
	expect(change).not.toHaveBeenCalled()
	await click(button('Cancel'))
	await click(trigger)
	expect(document.querySelector<HTMLInputElement>('input[value="include"]')!.checked).toBe(true)
	await exclude()
	await click(button('Done'))
	expect(change).toHaveBeenCalledExactlyOnceWith([
		{ kind: 'categorical', id: 'country', mode: 'exclude', values: ['US'] }
	])
})
