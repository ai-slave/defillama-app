// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'
import { MarketMakersTabs } from '../MarketMakersTabs'

const router = vi.hoisted(() => ({ asPath: '/market-makers', query: {} as Record<string, string>, push: vi.fn() }))
vi.mock('next/router', () => ({ useRouter: () => router }))

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
			new Set([...container.querySelectorAll('a[aria-current="page"]')].map((link) => link.getAttribute('href')))
		).toEqual(new Set(['/market-makers/volume']))
		expect(container.querySelector('a[href="/market-makers/depth"]')).not.toBeNull()
		await act(async () => toggle.click())
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
	} finally {
		await act(async () => root.unmount())
		container.remove()
	}
})

test('every tab carries a picked period, and the default period stays off the links', async () => {
	const container = document.createElement('div')
	document.body.append(container)
	const root = createRoot(container)
	const hrefs = () => new Set([...container.querySelectorAll('nav a')].map((link) => link.getAttribute('href')))
	try {
		router.query = { period: '7d' }
		await act(async () => root.render(<MarketMakersTabs active="Volume" />))
		expect(hrefs()).toContain('/market-makers/depth?period=7d')
		expect(hrefs()).toContain('/market-makers?period=7d')

		router.query = { period: '30d' }
		await act(async () => root.render(<MarketMakersTabs active="Depth" />))
		expect(hrefs()).toContain('/market-makers/depth')
		expect(hrefs()).not.toContain('/market-makers/depth?period=30d')
	} finally {
		router.query = {}
		await act(async () => root.unmount())
		container.remove()
	}
})
