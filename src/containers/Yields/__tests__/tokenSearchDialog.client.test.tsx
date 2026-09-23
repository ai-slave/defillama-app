// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TokenSearchDialog } from '../Filters/TokenSearchDialog'

const virtual = vi.hoisted(() => ({ getScrollElement: () => null as Element | null }))
vi.mock('@tanstack/react-virtual', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@tanstack/react-virtual')>()
	return {
		...actual,
		useVirtualizer: (options: Parameters<typeof actual.useVirtualizer>[0]) => {
			virtual.getScrollElement = options.getScrollElement
			return actual.useVirtualizer({
				...options,
				observeElementRect: (_, callback) => {
					callback({ width: 400, height: 280 })
					return () => {}
				},
				observeElementOffset: (_, callback) => {
					callback(0, false)
					return () => {}
				}
			})
		}
	}
})
let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})
const options: Array<[string, string]> = [
	['Ether family', 'family:eth'],
	['Ethereum', 'ETH'],
	['USD Coin', 'USDC']
]
async function render(nextOptions = options, selectedValues: Array<string> = []) {
	await act(async () =>
		root.render(
			<TokenSearchDialog
				open
				onClose={() => {}}
				title="Tokens"
				options={nextOptions}
				selectedValues={selectedValues}
				multiple
				onToggle={() => {}}
				onClear={() => {}}
			/>
		)
	)
}

test('query resets only results, retaining search focus and scroll position on selection updates', async () => {
	await render([])
	await render()
	const input = document.querySelector<HTMLInputElement>('input')!
	expect(document.body.textContent).toContain('Ethereum')
	expect(document.body.textContent).toContain('USD Coin')
	const firstResults = virtual.getScrollElement()!
	firstResults.scrollTop = 150
	await render(options, ['ETH'])
	expect(virtual.getScrollElement()!.scrollTop).toBe(150)
	await act(async () => {
		input.focus()
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'USD')
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})
	expect(virtual.getScrollElement()!.textContent).toContain('USD Coin')
	expect(virtual.getScrollElement()!.textContent).not.toContain('Ethereum')
	expect(virtual.getScrollElement()!.scrollTop).toBe(0)
	expect(document.activeElement).toBe(input)
	await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Clear search"]')!.click())
	expect(document.body.textContent).toContain('Ethereum')
	expect(document.body.textContent).toContain('USD Coin')
	expect(virtual.getScrollElement()!.scrollTop).toBe(0)
	expect(document.activeElement).toBe(input)
})
