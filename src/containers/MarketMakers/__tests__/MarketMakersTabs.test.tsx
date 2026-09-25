// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { MarketMakersTabs } from '../MarketMakersTabs'
vi.mock('next/router', () => ({ useRouter: () => ({ asPath: '/market-makers', push: vi.fn() }) }))

test('opens and closes section navigation while keeping the active destination', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	try {
		await act(async () => root.render(<MarketMakersTabs active="Volume" />))
		const toggle = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
		await act(async () => toggle.click())
		expect(toggle.getAttribute('aria-expanded')).toBe('true')
		expect(
			new Set([...container.querySelectorAll('a[data-active="true"]')].map((link) => link.getAttribute('href')))
		).toEqual(new Set(['/market-makers/volume']))
		expect(container.querySelector('a[href="/market-makers/depth"]')).not.toBeNull()
		await act(async () => toggle.click())
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})
