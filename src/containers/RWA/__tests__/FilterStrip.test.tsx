// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RWAResetAllFilters } from '../FilterStrip'

const router = {
	pathname: '/rwa/perps',
	asPath: '/rwa/perps',
	query: { groupBy: 'asset', platforms: 'Ondo', venues: 'Binance', includeDex: 'false' } as Record<string, string>,
	push: vi.fn(async () => true)
}
vi.mock('next/router', () => ({ useRouter: () => router }))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
	router.push.mockClear()
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

const resetButton = () => [...document.querySelectorAll('button')].find((button) => button.textContent === 'Reset all')

test('Reset all shows only when the page counts an active filter, whatever keys the URL holds', async () => {
	await act(async () => root.render(<RWAResetAllFilters active={false} keys={['platforms', 'venues']} />))
	expect(resetButton()).toBeUndefined()
})

test('Reset all clears the keys the page reads and keeps the grouping and the keys it ignores', async () => {
	await act(async () =>
		root.render(<RWAResetAllFilters active keys={['venues', 'excludeVenues', 'includeCex', 'includeDex']} />)
	)
	await act(async () => resetButton()!.click())
	expect(router.push).toHaveBeenCalledWith(
		{ pathname: '/rwa/perps', query: { groupBy: 'asset', platforms: 'Ondo' } },
		undefined,
		{ shallow: true }
	)
})
