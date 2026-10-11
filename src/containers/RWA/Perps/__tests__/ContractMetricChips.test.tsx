// @vitest-environment happy-dom
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import type { NextRouter } from 'next/router'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RWAPerpsContractPage } from '../Contract'
import { TEST_CONTRACT } from './contractFixture'

// The real router context, so a navigation re-renders the page the way Next does. The chart reads the URL's search.
let asPath = '/rwa/perps/contract/xyz-meta'
const push = vi.fn(async ({ query }: { query: Record<string, string> }) => {
	const search = new URLSearchParams(query).toString()
	asPath = `/rwa/perps/contract/xyz-meta${search ? `?${search}` : ''}`
	await act(async () => root.render(page()))
})
const router = () =>
	({
		pathname: '/rwa/perps/contract/xyz-meta',
		asPath,
		isReady: true,
		query: Object.fromEntries(new URLSearchParams(asPath.split('?')[1] ?? '')),
		push
	}) as unknown as NextRouter

let container: HTMLDivElement
let root: Root
const page = () => (
	<RouterContext.Provider value={router()}>
		<RWAPerpsContractPage contract={TEST_CONTRACT} />
	</RouterContext.Provider>
)

beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

// A chip is the button named "Remove <metric>".
const chip = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${label}"]`)
const chips = () =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove "]')].map((button) =>
		button.getAttribute('aria-label')
	)
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}

test('a metric chip that turns its metric off hands focus to the next chip, else the previous, else Add Metrics', async () => {
	asPath = '/rwa/perps/contract/xyz-meta?vol24h=true'
	await act(async () => root.render(page()))
	expect(chips()).toEqual(['Remove Open Interest', 'Remove Volume 24h', 'Remove Price'])

	await click(chip('Volume 24h')!)
	expect(chips()).toEqual(['Remove Open Interest', 'Remove Price'])
	expect(document.activeElement).toBe(chip('Price'))

	await click(chip('Price')!)
	expect(document.activeElement).toBe(chip('Open Interest'))

	await click(chip('Open Interest')!)
	expect(chips()).toEqual([])
	expect(document.activeElement?.textContent).toBe('Add Metrics')
})
