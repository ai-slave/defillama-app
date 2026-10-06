// @vitest-environment happy-dom
import Router from 'next/router'
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import pages from '~/public/pages.json'
import { resetExperimentTracking } from '~/utils/analytics/experiment'
import { getHeadBootstrapScript } from '~/utils/cookies'
import { renderHydrated } from '~/utils/testing/hydration'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { DesktopNav } from '../Desktop'
import { resetNavGroupState } from '../groupState'
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
	dashboardsStatus: null,
	footerLinks: [],
	oldMetricLinks: [],
	asPath: '/'
}

function assign(variant: 'a' | 'b') {
	document.cookie = `defillama-ab-group=${variant}; path=/`
	// Use the real cookie-to-DOM writer that selects the visible variant before hydration.
	new Function(getHeadBootstrapScript())()
}

beforeEach(async () => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	vi.stubGlobal('IntersectionObserver', TestObserver)
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
	window.sessionStorage.clear()
	await act(async () => resetNavGroupState())
	resetExperimentTracking()
	observers.length = 0
	assign('a')
	container = document.createElement('div')
	document.body.appendChild(container)
	root = createRoot(container)
})

afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
	resetExperimentTracking()
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

test.each([
	['a', 'Equities', '/equities/sectors'],
	['b', 'Tools', '/tools']
] as const)(
	'keeps %s %s expanded when navigating to a submenu page remounts the menu',
	async (variant, group, destination) => {
		assign(variant)
		const renderPage = (asPath: string) =>
			root.render(<PrimaryNavLinks key={asPath} pages={props.mainLinks[0].pages} asPath={asPath} />)
		const disclosure = () =>
			container.querySelector<HTMLElement>(`[data-ab-variant="${variant}"] summary[data-menu-name="${group}"]`)!
		await act(async () => renderPage('/'))
		await act(async () => disclosure().click())
		expect((disclosure().parentElement as HTMLDetailsElement).open).toBe(true)
		await act(async () => renderPage(destination))
		expect((disclosure().parentElement as HTMLDetailsElement).open).toBe(true)
		expect(
			container.querySelector(`[data-ab-variant="${variant}"] a[href="${destination}"]`)?.getAttribute('aria-current')
		).toBe('page')
	}
)

test('opening DeFi closes Equities and clicking DeFi again collapses it', async () => {
	await act(async () => root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/" />))
	const summary = (name: string) =>
		container.querySelector<HTMLElement>(`[data-ab-variant="b"] summary[data-menu-name="${name}"]`)!
	const expanded = () =>
		[...container.querySelectorAll('[data-ab-variant="b"] details[open] summary')].map((node) => node.textContent)
	await act(async () => summary('Equities').click())
	expect(expanded()).toEqual(['Equities'])
	await act(async () => summary('DeFi').click())
	expect(expanded()).toEqual(['DeFi'])
	await act(async () => summary('DeFi').click())
	expect(expanded()).toEqual([])
})

test('keeps a collapsed active group when the navigation remounts on the same page', async () => {
	const renderPage = () => <PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />
	await act(async () => root.render(renderPage()))
	const expanded = () =>
		[...container.querySelectorAll('[data-ab-variant="b"] details[open] summary')].map((node) => node.textContent)
	const summary = container.querySelector<HTMLElement>('[data-ab-variant="b"] summary[data-menu-name="DeFi"]')!
	expect(expanded()).toEqual(['DeFi'])
	await act(async () => summary.click())
	expect(expanded()).toEqual([])
	await act(async () => root.render(null))
	await act(async () => root.render(renderPage()))
	expect(expanded()).toEqual([])
})

test.each([
	['a', 'Equities'],
	['b', 'Metrics']
] as const)(
	'a browser-opened %s group stays exclusive across menus and closes on the first click',
	async (variant, group) => {
		await act(async () =>
			root.render(
				<>
					<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />
					<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />
				</>
			)
		)
		const summary = container.querySelector<HTMLElement>(
			`[data-ab-variant="${variant}"] summary[data-menu-name="${group}"]`
		)!
		const expanded = () =>
			[...container.querySelectorAll(`[data-ab-variant="${variant}"] details[open] summary`)].map(
				(node) => node.textContent
			)
		// Find-in-page and text fragments set the native disclosure without clicking its summary.
		await act(async () => {
			;(summary.parentElement as HTMLDetailsElement).open = true
		})
		await waitForUi(() => expect(expanded()).toEqual([group, group]))
		await act(async () => summary.click())
		expect(expanded()).toEqual([])
	}
)

test('a browser-closed active group stays closed across menu instances', async () => {
	await act(async () =>
		root.render(
			<>
				<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />
				<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />
			</>
		)
	)
	const details = container.querySelector<HTMLDetailsElement>('[data-ab-variant="b"] details[open]')!
	await act(async () => {
		details.open = false
	})
	await waitForUi(() => expect(container.querySelectorAll('[data-ab-variant="b"] details[open]').length).toBe(0))
})

test('a fresh Hacks page opens DeFi automatically without restoring the previous group', async () => {
	await act(async () => root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/" />))
	await act(async () =>
		container.querySelector<HTMLElement>('[data-ab-variant="b"] summary[data-menu-name="Equities"]')!.click()
	)
	expect(container.querySelector('[data-ab-variant="b"] details[open] summary')?.textContent).toBe('Equities')
	await act(async () => root.render(null))
	// A reload creates a new JS runtime; no navigation state survives it.
	await act(async () => resetNavGroupState())
	const view = await renderHydrated(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/hacks" />, {
		pageClockSec: 1
	})
	try {
		expect(view.errors).toEqual([])
		expect(
			[...view.container.querySelectorAll('[data-ab-variant="b"] details[open] summary')].map(
				(node) => node.textContent
			)
		).toEqual(['DeFi'])
	} finally {
		await view.unmount()
	}
})

test('manual expansion overrides the active group until navigating to another grouped page', async () => {
	const renderPage = (asPath: string) =>
		root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath={asPath} />)
	const summary = (name: string) =>
		container.querySelector<HTMLElement>(`[data-ab-variant="b"] summary[data-menu-name="${name}"]`)!
	const expanded = () =>
		[...container.querySelectorAll('[data-ab-variant="b"] details[open] summary')].map((node) => node.textContent)
	await act(async () => renderPage('/hacks'))
	await act(async () => summary('DeFi').click())
	expect(expanded()).toEqual([])
	await act(async () => summary('Equities').click())
	expect(expanded()).toEqual(['Equities'])
	await act(async () => renderPage('/hacks?sort=amount#table'))
	await act(async () => Router.events.emit('routeChangeComplete', '/hacks?sort=amount#table', { shallow: true }))
	expect(expanded()).toEqual(['Equities'])
	await act(async () => renderPage('/fees'))
	expect(expanded()).toEqual(['Metrics'])
})

test.each([true, false])(
	'returning to Hacks reveals DeFi after visiting a page with navigation: %s',
	async (hasNav) => {
		const navigate = async (asPath: string) => {
			await act(async () =>
				root.render(<PrimaryNavLinks key={asPath} pages={props.mainLinks[0].pages} asPath={asPath} />)
			)
			await act(async () => Router.events.emit('routeChangeComplete', asPath, { shallow: false }))
		}
		await navigate('/hacks')
		await act(async () =>
			container.querySelector<HTMLElement>('[data-ab-variant="b"] summary[data-menu-name="Equities"]')!.click()
		)
		if (hasNav) await navigate('/fees')
		else {
			await act(async () => root.render(null))
			await act(async () => Router.events.emit('routeChangeComplete', '/fees', { shallow: false }))
		}
		await navigate('/hacks')
		expect(
			[...container.querySelectorAll('[data-ab-variant="b"] details[open] summary')].map((node) => node.textContent)
		).toEqual(['DeFi'])
	}
)

test.each([
	['/hacks#table', 'Hacks'],
	['/hacks/?sort=amount#table', 'Hacks'],
	['/equities/#rankings', 'Rankings']
])('keeps the current submenu link selected for %s', async (asPath, label) => {
	await act(async () => root.render(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath={asPath} />))
	expect(
		[...container.querySelectorAll('[data-ab-variant="b"] details[open] a[aria-current="page"]')].map(
			(node) => node.textContent
		)
	).toEqual([label])
})

test('preserves A and hydrates the grouped B destinations without changing the assigned menu', async () => {
	assign('b')
	const view = await renderHydrated(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/" />, {
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
		expect([...b.querySelectorAll('details')].map((group) => group.open)).toEqual([
			false,
			false,
			false,
			false,
			false,
			false
		])
		await act(async () => b.querySelector<HTMLElement>('summary[data-menu-name="Tools"]')!.click())
		await view.update(<PrimaryNavLinks pages={props.mainLinks[0].pages} asPath="/support" />)
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
		resetExperimentTracking()
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
	expect(link.closest('details')!.open).toBe(true)
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
	expect(b.querySelector<HTMLDetailsElement>('details[open]')?.querySelector('summary')?.textContent).toBe('Equities')
	expect([...b.querySelectorAll('a[aria-current="page"]')].map((link) => link.textContent)).toEqual(['Sectors'])
})
