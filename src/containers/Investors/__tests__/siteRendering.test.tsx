// @vitest-environment happy-dom

import type { AppProps } from 'next/app'
import { act, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { InvestorsSiteId } from '../config'

const { checkParentAuth, renderedAnalyticsIds } = vi.hoisted(() => ({
	checkParentAuth: vi.fn(async () => null),
	renderedAnalyticsIds: [] as Array<string>
}))
vi.mock('next/head', () => ({ default: () => null }))
vi.mock('next/script', () => ({
	default: (props: { 'data-website-id': string }) => {
		renderedAnalyticsIds.push(props['data-website-id'])
		return <span data-website-id={props['data-website-id']} />
	}
}))
vi.mock('next/router', () => ({ default: { events: { on: vi.fn(), off: vi.fn() } } }))
vi.mock('~/auth', () => ({ AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@tanstack/react-query-devtools', () => ({ ReactQueryDevtools: () => null }))
vi.mock('~/components/DashboardSaveGuard', () => ({ DashboardSaveGuard: () => null }))
vi.mock('~/components/RouteProgressIndicator', () => ({ RouteProgressIndicator: () => null }))
vi.mock('~/components/UserSettingsSync', () => ({ UserSettingsSync: () => null }))
vi.mock('~/hooks/useReferrer', () => ({ useReferrer: () => {} }))
vi.mock('~/hooks/useUmamiIdentityTracker', () => ({ useUmamiIdentityTracker: () => {} }))
vi.mock('~/utils/checkParentAuth', () => ({ checkParentAuth }))
vi.mock('~/components/SEO', () => ({ SEO: () => null }))
vi.mock('~/components/Nav/ThemeSwitch', () => ({ ThemeSwitch: () => null }))
vi.mock('~/components/Link', () => ({
	BasicLink: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{props.children}</a>
}))
vi.mock('~/contexts/LocalStorage', () => ({ useDarkModeManager: () => [false, () => {}] }))
vi.mock('~/containers/ProDashboard/AppMetadataContext', () => ({
	AppMetadataProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}))
vi.mock('../registry', () => ({
	getDashboardModule: async () => ({
		tabs: [
			{ id: 'overview', label: 'Overview' },
			{ id: 'metrics', label: 'Metrics' }
		]
	})
}))
vi.mock('../DashboardTabsContent', () => ({
	DEFAULT_TABS: [{ id: 'overview', label: 'Overview' }],
	SkeletonTable: () => null,
	TabLabel: ({ tab }: { tab: { label: string } }) => <>{tab.label}</>,
	CustomOnlyContent: ({ displayName, activeTab }: { displayName: string; activeTab: string }) => (
		<div data-content>
			{displayName}:{activeTab}
		</div>
	),
	InvestorsContent: ({ displayName, activeTab }: { displayName: string; activeTab: string }) => (
		<div data-content>
			{displayName}:{activeTab}
		</div>
	)
}))

import App from '~/pages/_app'
import InvestorsPage from '~/pages/investors'
import { INVESTORS_SITES } from '../config'
import InvestorsDashboard from '../index'
import { Logo, TextLoader } from '../Logo'

function Branding() {
	return (
		<>
			<Logo />
			<TextLoader />
		</>
	)
}

function app(siteId?: InvestorsSiteId, Component: AppProps['Component'] = Branding) {
	return (
		<App
			Component={Component}
			pageProps={siteId ? { investorsSiteId: siteId } : {}}
			router={{} as AppProps['router']}
		/>
	)
}

describe('request-specific IR rendering and analytics', () => {
	let container: HTMLDivElement
	let root: Root | undefined

	beforeEach(() => {
		container = document.createElement('div')
		document.body.appendChild(container)
		window.location.href = 'https://defillama.com/'
		localStorage.clear()
		sessionStorage.clear()
		checkParentAuth.mockClear()
		renderedAnalyticsIds.length = 0
		vi.spyOn(console, 'log').mockImplementation(() => {})
	})

	afterEach(async () => {
		if (root) await act(async () => root?.unmount())
		root = undefined
		container.remove()
		vi.restoreAllMocks()
	})

	test.each(['enterprise', 'investors'] as const)(
		'hydrates %s with server-provided branding and analytics',
		async (siteId) => {
			window.location.href = `https://${siteId}.defillama.com/`
			const view = app(siteId)
			const errors = vi.fn()
			container.innerHTML = renderToString(view)
			expect(container.querySelector<HTMLElement>('[data-website-id]')?.dataset.websiteId).toBe(
				INVESTORS_SITES[siteId].umamiWebsiteId
			)
			expect(container.textContent).toContain(siteId === 'enterprise' ? 'Enterprise' : 'Investor Relations')
			await act(async () => {
				root = hydrateRoot(container, view, { onRecoverableError: errors })
			})
			expect(errors).not.toHaveBeenCalled()
			expect(container.querySelector<HTMLElement>('[data-website-id]')?.dataset.websiteId).toBe(
				INVESTORS_SITES[siteId].umamiWebsiteId
			)
			expect(checkParentAuth).toHaveBeenCalledTimes(1)
		}
	)

	test('preserves each landing and its internal versus external links on the server', () => {
		container.innerHTML = renderToString(app('investors', InvestorsPage))
		expect(container.querySelector('a[href="/spark"]')).not.toBeNull()
		expect(container.querySelector('a[href="/odyssey-ecosystem"]')).toBeNull()
		expect(container.querySelector('a[href="/kpk"]')).toBeNull()
		expect(container.textContent).toContain('KPK')
		container.innerHTML = renderToString(app('enterprise', InvestorsPage))
		expect(container.querySelector('a[href="/odyssey-ecosystem"]')).not.toBeNull()
		expect(container.querySelector('a[href="https://investors.defillama.com/spark"]')?.getAttribute('target')).toBe(
			'_blank'
		)
		expect(container.textContent).not.toContain('KPK')
	})

	test('resolves an IR host on pages without site props before loading analytics', async () => {
		window.location.href = 'https://enterprise.defillama.com/404'
		const view = app()
		container.innerHTML = renderToString(view)
		expect(renderedAnalyticsIds).toEqual([])
		await act(async () => {
			root = hydrateRoot(container, view)
		})
		expect(renderedAnalyticsIds.length).toBeGreaterThan(0)
		expect(new Set(renderedAnalyticsIds)).toEqual(new Set([INVESTORS_SITES.enterprise.umamiWebsiteId]))
		expect(checkParentAuth).toHaveBeenCalledTimes(1)
	})

	test('keeps the shell projects, navigation and scroll behavior specific to each site', async () => {
		const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
		root = createRoot(container)
		await act(async () => root?.render(app('investors', InvestorsDashboard)))
		const click = async (label: string) => {
			const button = Array.from(container.querySelectorAll('nav button')).find((node) => node.textContent === label)
			expect(button).toBeDefined()
			await act(async () => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
		}
		expect(container.querySelector('nav')?.textContent).toContain('Spark')
		expect(container.querySelector('nav')?.textContent).not.toContain('Odyssey')
		await click('Metrics')
		expect(container.querySelector('[data-content]')?.textContent).toBe('Spark:metrics')
		await click('NEAR')
		expect(container.querySelector('[data-content]')?.textContent).toBe('NEAR:overview')
		expect(scroll).toHaveBeenCalledTimes(2)
		await act(async () => root?.render(app('enterprise', InvestorsDashboard)))
		expect(container.querySelector('nav')?.textContent).toContain('Odyssey Ecosystem')
		expect(container.querySelector('nav')?.textContent).not.toContain('Spark')
		expect(container.querySelector('[data-content]')?.textContent).toBe('Odyssey Ecosystem:overview')
	})

	test('keeps the parent auth bridge on the main site and off both IR sites', async () => {
		const postMessage = vi.fn()
		const message = () =>
			new MessageEvent('message', {
				origin: 'https://investors.defillama.com',
				data: { type: 'auth-check' },
				source: { postMessage } as unknown as Window
			})
		localStorage.setItem('pocketbase_auth', JSON.stringify({ token: 'test-only', record: { id: 'test-user' } }))
		root = createRoot(container)
		await act(async () => root?.render(app()))
		window.dispatchEvent(message())
		expect(postMessage).toHaveBeenCalledWith(
			{ type: 'auth-response', user: { id: 'test-user' } },
			{ targetOrigin: 'https://investors.defillama.com' }
		)
		expect(checkParentAuth).not.toHaveBeenCalled()
		expect(container.querySelector<HTMLElement>('[data-website-id]')?.dataset.websiteId).toBe(
			'ca346731-f7ec-437f-9727-162f29bb67ae'
		)
		postMessage.mockClear()
		await act(async () => root?.render(app('investors')))
		window.dispatchEvent(message())
		expect(postMessage).not.toHaveBeenCalled()
		await act(async () => root?.render(app('enterprise')))
		window.dispatchEvent(message())
		expect(postMessage).not.toHaveBeenCalled()
	})
})
