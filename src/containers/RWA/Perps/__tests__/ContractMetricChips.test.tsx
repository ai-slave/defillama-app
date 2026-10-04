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

const chip = (metric: string) => container.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${metric}"]`)
async function click(el: HTMLElement) {
	await act(async () => {
		el.focus()
		el.click()
	})
}

test('a metric chip that turns its metric off hands focus to the next chip, else the previous, else Add Metrics', async () => {
	asPath = '/rwa/perps/contract/xyz-meta?vol24h=true'
	await act(async () => root.render(page()))
	const chips = () => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map((el) => el.value)
	expect(chips()).toEqual(['openInterest', 'volume24h', 'price'])

	await click(chip('volume24h')!)
	expect(chips()).toEqual(['openInterest', 'price'])
	expect(document.activeElement).toBe(chip('price'))

	await click(chip('price')!)
	expect(document.activeElement).toBe(chip('openInterest'))

	await click(chip('openInterest')!)
	expect(chips()).toEqual([])
	expect(document.activeElement?.textContent).toBe('Add Metrics')
})
