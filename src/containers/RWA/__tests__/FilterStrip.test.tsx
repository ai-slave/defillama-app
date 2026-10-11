// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
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

const resetButton = () =>
	[...document.querySelectorAll('button')].find((button) => accessibleName(button) === 'Reset all')

test('Reset all stays in place and disabled once its press clears the filters, so it keeps focus', async () => {
	await act(async () => root.render(<RWAResetAllFilters active keys={['venues']} />))
	const reset = resetButton()!
	await act(async () => reset.focus())
	await act(async () => reset.click())
	expect(router.push).toHaveBeenCalledTimes(1)
	// The router change clears the filters, so the page re-renders it inactive.
	await act(async () => root.render(<RWAResetAllFilters active={false} keys={['venues']} />))
	expect(resetButton()).toBe(reset)
	// happy-dom keeps focus on a disabled button where Chrome drops it, so assert the cause.
	expect(reset.getAttribute('aria-disabled')).toBe('true')
	expect(reset.disabled).toBe(false)
})
