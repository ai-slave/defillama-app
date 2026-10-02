// @vitest-environment happy-dom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pages from '~/public/pages.json'
import { getHeadBootstrapScript } from '~/utils/cookies'
import { renderHydrated } from '~/utils/testing/hydration'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DesktopNav } from '../Desktop'
import { resetMenuAnalytics } from '../menuAnalytics'
import { Menu } from '../Mobile/Menu'
import { PrimaryNavLinks } from '../PrimaryNavLinks'
import type { TNavLinks } from '../types'
import { observers, TestObserver } from './observer'

// Account data and subscription prompts do not participate in these navigation contracts.
vi.mock('../Account', () => ({ Account: () => null }))
vi.mock('../PremiumHeader', () => ({ PremiumHeader: () => null }))

const track = installUmamiSink()
let container: HTMLDivElement
let root: Root
const props = {
	mainLinks: [{ category: 'Main', pages: pages.Main }] as TNavLinks,
	pinnedPages: [],
	userDashboards: [],
	footerLinks: [],
	oldMetricLinks: [],
	asPath: '/tools'
}

function assign(variant: 'a' | 'b') {
	document.cookie = `defillama-ab-group=${variant}; path=/`
	// Use the real cookie-to-DOM writer that selects the visible variant before hydration.
	new Function(getHeadBootstrapScript())()
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.stubGlobal('IntersectionObserver', TestObserver)
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
	window.sessionStorage.clear()
	resetMenuAnalytics()
	observers.length = 0
	assign('a')
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	resetMenuAnalytics()
	window.sessionStorage.clear()
	document.cookie = 'defillama-ab-group=; Max-Age=0; path=/'
	document.documentElement.removeAttribute('data-ab-group')
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

function intersect(layout: string, ratio: number) {
	const node = document.querySelector<HTMLElement>(`nav[data-menu-layout="${layout}"]`)!
	const observer = observers.findLast((observer) => observer.targets.has(node))!
	observer.intersect(node, ratio)
}

test('preserves A and hydrates the grouped B destinations without changing the assigned menu', async () => {
	assign('b')
	const view = await renderHydrated(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/tools" />, {
		pageClockSec: 1
	})
	try {
		expect(view.errors).toEqual([])
		const a = view.container.querySelector('[data-ab-variant="a"]')!
		const b = view.container.querySelector('[data-ab-variant="b"]')!
		for (const link of a.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
			expect(b.querySelector(`a[href="${link.getAttribute('href')}"]`)).not.toBeNull()
		}
		expect(b.querySelector('a[href="/pre-ipo"]')?.textContent).toBe('Pre-IPO')
		expect(a.querySelector('a')?.textContent).toBe('Home')
		expect(a.querySelector('details')?.open).toBe(false)
		await act(async () => a.querySelector<HTMLElement>('summary[data-menu-name="Equities"]')!.click())
		expect(a.querySelector('details')?.open).toBe(true)
		expect([...b.querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
			['Overview', '/'],
			['Chains', '/chains'],
			['Categories', '/categories'],
			['Yields', '/yields'],
			['Hacks', '/hacks'],
			['All Metrics', '/metrics'],
			['DEXs', '/dexs'],
			['Perps', '/perps'],
			['Revenue', '/revenue'],
			['Fees', '/fees'],
			['Holders Revenue', '/holders-revenue'],
			['All Tools', '/tools'],
			['Crypto Cards', '/crypto-cards'],
			['ChainList', 'https://chainlist.org/'],
			['Dashboard Builder', '/pro'],
			['Watchlist', '/watchlist'],
			['Rewards', '/rewards'],
			['Tokens', '/tokens'],
			['Stablecoins', '/stablecoins'],
			['RWAs', '/rwa'],
			['ETFs', '/etfs'],
			['Universal Token Rating', '/universal-token-rating'],
			['Rankings', '/equities'],
			['Sectors', '/equities/sectors'],
			['Industries', '/equities/industries'],
			['Earnings Calendar', '/equities/earnings-calendar'],
			['Pre-IPO', '/pre-ipo'],
			['Exchanges', '/exchanges'],
			['MiCA', '/mica'],
			['Reserves', '/cexs'],
			['Market Makers', '/market-makers'],
			['DefiLlama Research', '/research'],
			['Investor Relations', 'https://investors.defillama.com/'],
			['Support', '/support'],
			['API & MCP', 'https://api-docs.defillama.com/'],
			['DEX Aggregator', 'https://swap.defillama.com/']
		])
		expect([...b.querySelectorAll('summary')].map((group) => group.textContent)).toEqual([
			'DeFi',
			'Metrics',
			'Tools',
			'Assets',
			'Equities',
			'Exchanges'
		])
		expect([...b.querySelectorAll('details')].map((group) => group.open)).toEqual([
			false,
			false,
			false,
			false,
			false,
			false
		])
		await act(async () => b.querySelector<HTMLElement>('summary[data-menu-name="Tools"]')!.click())
		await view.update(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/chains" />)
		expect(b.querySelector('summary[data-menu-name="Tools"]')?.parentElement?.hasAttribute('open')).toBe(true)
	} finally {
		await view.unmount()
	}
})

test.each(['a', 'b'] as const)(
	'records one exposure to %s across StrictMode, route changes and a fresh runtime in the same tab',
	async (variant) => {
		assign(variant)
		await act(async () =>
			root.render(
				<StrictMode>
					<DesktopNav {...props} />
				</StrictMode>
			)
		)
		await act(async () => intersect('desktop', 1))
		await act(async () =>
			root.render(
				<StrictMode>
					<DesktopNav {...props} asPath="/chains" />
				</StrictMode>
			)
		)
		await act(async () => intersect('desktop', 1))
		resetMenuAnalytics()
		await act(async () => intersect('desktop', 1))
		expect(track.mock.calls).toEqual([
			['experiment-exposure', { experiment: 'menu-layout-v1', variant, layout: 'desktop' }]
		])
	}
)

test('waits for the mobile drawer to be visible in the foreground and counts reopening only once', async () => {
	assign('b')
	const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
	await act(async () => root.render(<Menu {...props} />))
	const disclosure = container.querySelector<HTMLButtonElement>('button')!
	await act(async () => disclosure.click())
	await waitForUi(() => expect(disclosure.getAttribute('aria-expanded')).toBe('true'))
	await act(async () => intersect('mobile', 0))
	expect(track.mock.calls).toEqual([])
	visibility.mockReturnValue('hidden')
	await act(async () => intersect('mobile', 1))
	expect(track.mock.calls).toEqual([])
	visibility.mockReturnValue('visible')
	await act(async () => document.dispatchEvent(new Event('visibilitychange')))
	await act(async () =>
		document.querySelector<HTMLButtonElement>('button[aria-label="Close navigation menu"]')!.click()
	)
	await waitForUi(() => expect(disclosure.getAttribute('aria-expanded')).toBe('false'))
	await act(async () => intersect('mobile', 0))
	await act(async () => disclosure.click())
	await waitForUi(() => expect(disclosure.getAttribute('aria-expanded')).toBe('true'))
	await act(async () => intersect('mobile', 1))
	expect(track.mock.calls).toEqual([
		['experiment-exposure', { experiment: 'menu-layout-v1', variant: 'b', layout: 'mobile' }],
		[
			'experiment-action',
			{ experiment: 'menu-layout-v1', variant: 'b', layout: 'mobile', metric: 'action:close-navigation-menu' }
		]
	])
})

test('queues exposure before repeat actions until Umami is ready and identifies shared destinations', async () => {
	assign('b')
	const sdk = window.umami
	delete window.umami
	await act(async () => root.render(<DesktopNav {...props} />))
	const b = container.querySelector('[data-ab-variant="b"]')!
	const group = b.querySelector<HTMLElement>('summary[data-menu-name="Tools"]')!
	await act(async () => group.click())
	const allTools = b.querySelector<HTMLAnchorElement>('a[href="/tools"]')!
	await act(async () => allTools.click())
	await act(async () => allTools.click())
	await act(async () =>
		b
			.querySelector<HTMLAnchorElement>('a[href="https://chainlist.org/"]')!
			.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }))
	)
	await act(async () => group.click())
	expect(track.mock.calls).toEqual([])
	window.umami = sdk
	await act(async () => window.dispatchEvent(new Event('umami-ready')))
	await act(async () => window.dispatchEvent(new Event('umami-ready')))
	expect(track.mock.calls).toEqual([
		['experiment-exposure', { experiment: 'menu-layout-v1', variant: 'b', layout: 'desktop' }],
		...['group-open:tools', 'navigate:/tools', 'navigate:/tools', 'navigate:chainlist.org', 'group-close:tools'].map(
			(metric) => ['experiment-action', { experiment: 'menu-layout-v1', variant: 'b', layout: 'desktop', metric }]
		)
	])
})

test.each(['a', 'b'] as const)(
	'mobile %s navigation records the destination and still closes the drawer',
	async (variant) => {
		assign(variant)
		await act(async () => root.render(<Menu {...props} />))
		const disclosure = container.querySelector<HTMLButtonElement>('button')!
		await act(async () => disclosure.click())
		await waitForUi(() => expect(disclosure.getAttribute('aria-expanded')).toBe('true'))
		if (variant === 'b') {
			await act(async () =>
				document.querySelector<HTMLElement>('[data-ab-variant="b"] summary[data-menu-name="Tools"]')!.click()
			)
		}
		await act(async () =>
			document.querySelector<HTMLAnchorElement>(`[data-ab-variant="${variant}"] a[href="/tools"]`)!.click()
		)
		await waitForUi(() => expect(disclosure.getAttribute('aria-expanded')).toBe('false'))
		expect(track.mock.calls).toEqual([
			['experiment-exposure', { experiment: 'menu-layout-v1', variant, layout: 'mobile' }],
			...(variant === 'b'
				? [
						[
							'experiment-action',
							{ experiment: 'menu-layout-v1', variant, layout: 'mobile', metric: 'group-open:tools' }
						]
					]
				: []),
			['experiment-action', { experiment: 'menu-layout-v1', variant, layout: 'mobile', metric: 'navigate:/tools' }]
		])
	}
)

test('deduplicates exposure when browser storage is blocked and omits private dashboard names and query values', async () => {
	vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
		throw new Error('blocked')
	})
	vi.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
		throw new Error('blocked')
	})
	await act(async () =>
		root.render(
			<DesktopNav {...props} userDashboards={[{ name: 'Private name', route: '/pro/private-id?secret=value' }]} />
		)
	)
	await act(async () => intersect('desktop', 1))
	await act(async () => intersect('desktop', 1))
	await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/pro/private-id?secret=value"]')!.click())
	expect(track.mock.calls).toEqual([
		['experiment-exposure', { experiment: 'menu-layout-v1', variant: 'a', layout: 'desktop' }],
		[
			'experiment-action',
			{ experiment: 'menu-layout-v1', variant: 'a', layout: 'desktop', metric: 'navigate:/pro/:dashboard' }
		]
	])
})

test.each([
	['Chains', '/chains', '/chains/Non-EVM'],
	['Exchanges', '/exchanges', '/exchanges/charts']
])('keeps %s selected when browsing its subpages', async (_name, href, asPath) => {
	assign('b')
	await act(async () => root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath={asPath} />))
	const b = container.querySelector('[data-ab-variant="b"]')!
	const link = b.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!
	await act(async () => link.closest('details')!.querySelector('summary')!.click())
	expect(link.getAttribute('aria-current')).toBe('page')
})

test('records unpin clicks on desktop icon buttons', async () => {
	await act(async () => root.render(<DesktopNav {...props} pinnedPages={[{ name: 'Hacks', route: '/hacks' }]} />))
	const unpin = [...container.querySelectorAll<HTMLAnchorElement>('a[href="/hacks"]')]
		.at(-1)!
		.parentElement!.querySelector('button')!
	await act(async () => unpin.click())
	expect(track.mock.calls).toEqual([
		['experiment-exposure', { experiment: 'menu-layout-v1', variant: 'a', layout: 'desktop' }],
		[
			'experiment-action',
			{ experiment: 'menu-layout-v1', variant: 'a', layout: 'desktop', metric: 'action:unpin-from-navigation' }
		]
	])
})

test('selects the Equities sector link without also selecting Rankings', async () => {
	assign('b')
	await act(async () =>
		root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/equities/sectors/technology" />)
	)
	const b = container.querySelector('[data-ab-variant="b"]')!
	await act(async () => b.querySelector<HTMLElement>('summary[data-menu-name="Equities"]')!.click())
	expect([...b.querySelectorAll('a[aria-current="page"]')].map((link) => link.textContent)).toEqual(['Sectors'])
})
