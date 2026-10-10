// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, StrictMode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { resetExperimentTracking } from '~/utils/analytics/experiment'
import { getHeadBootstrapScript } from '~/utils/cookies'
import { installFixtureFetch, fixtureStatus } from '~/utils/testing/fixtureFetch'
import { installUmamiSink } from '~/utils/testing/umamiSink'
import { waitForUi } from '~/utils/testing/waitForUi'
import { PLAN_ORDER, PRICING_CARDS_BY_CYCLE } from '../data'
import { observePricingPage, trackPricingClick } from '../pricingExperiment'
import { SubscriptionComparisonSection } from '../sections/SubscriptionComparisonSection'
import { SubscriptionCoverage } from '../sections/SubscriptionCoverage'
import { SubscriptionPricingSection } from '../sections/SubscriptionPricingSection'
import type { BillingCycle } from '../types'

const track = installUmamiSink()
const subscribe = vi.fn()
const http = installFixtureFetch()
let queryClient: QueryClient
const observers = new Set<VisibilityObserver>()
class VisibilityObserver {
	readonly targets = new Set<Element>()
	constructor(private callback: IntersectionObserverCallback) {
		observers.add(this)
	}
	observe(target: Element) {
		this.targets.add(target)
	}
	disconnect() {
		this.targets.clear()
		observers.delete(this)
	}
	unobserve(target: Element) {
		this.targets.delete(target)
	}
	intersect(target: Element) {
		this.callback(
			[{ target, isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver
		)
	}
}
function show(node: Element) {
	for (const observer of observers) if (observer.targets.has(node)) observer.intersect(node)
}
let root: Root
let host: HTMLDivElement
beforeEach(() => {
	queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } })
	queryClient.setQueryData(['subscription-coverage'], {
		protocols: 8236,
		protocolsAddedThisWeek: 84,
		chains: 467,
		yieldPools: 16_312,
		rwaAssets: 4562
	})
	vi.stubGlobal('IntersectionObserver', VisibilityObserver)
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
	document.cookie = 'defillama-ab-group=a; path=/'
	document.cookie = 'defillama-ab-seed=00000000-0000-4000-8000-000000000000; path=/'
	new Function(getHeadBootstrapScript())()
	sessionStorage.clear()
	resetExperimentTracking()
	subscribe.mockReset()
	host = document.body.appendChild(document.createElement('div'))
	root = createRoot(host)
})
afterEach(async () => {
	await act(async () => root.unmount())
	queryClient.clear()
	host.remove()
	observers.clear()
	document.cookie = 'defillama-ab-group=; Max-Age=0; path=/'
	document.cookie = 'defillama-ab-seed=; Max-Age=0; path=/'
	document.documentElement.removeAttribute('data-ab-group')
	document.documentElement.removeAttribute('data-ab-pricing-coverage-v1')
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

function Pricing({ loading = false }: { loading?: boolean }) {
	const [cycle, setCycle] = useState<BillingCycle>('yearly')
	return (
		<QueryClientProvider client={queryClient}>
			<main ref={observePricingPage} onClickCapture={trackPricingClick} data-billing-cycle={cycle}>
				<SubscriptionPricingSection
					pricingCards={PRICING_CARDS_BY_CYCLE[cycle]}
					billingCycle={cycle}
					onBillingCycleChange={setCycle}
					isAuthenticated
					isTrialAvailable
					loading={loading ? 'stripe' : null}
					onPrimaryCtaClick={subscribe}
					onSecondaryCtaClick={subscribe}
				/>
			</main>
		</QueryClientProvider>
	)
}
const events = (metric: string) =>
	track.mock.calls.filter(([name, data]) => name === 'experiment-action' && data.metric === metric)

test.each([
	{ seed: '00000000-0000-4000-8000-000000000000', menu: 'a', variant: 'b' },
	{ seed: '00000000-0000-4000-8000-000000000008', menu: 'b', variant: 'b' },
	{ seed: '00000000-0000-4000-8000-00000000000a', menu: 'b', variant: 'a' },
	{ seed: '00000000-0000-4000-8000-000000000010', menu: 'a', variant: 'a' }
] as const)(
	'counts pricing $variant arrivals independently of menu $menu, without rerender or Strict Mode duplicates',
	async ({ seed, menu, variant }) => {
		document.cookie = `defillama-ab-seed=${seed}; path=/`
		document.cookie = `defillama-ab-group=${menu}; path=/`
		new Function(getHeadBootstrapScript())()
		await act(async () =>
			root.render(
				<StrictMode>
					<Pricing />
				</StrictMode>
			)
		)
		const main = host.querySelector('main')!
		await act(async () => show(main))
		await act(async () => show(main))
		await act(async () => document.dispatchEvent(new Event('visibilitychange')))
		await act(async () => host.querySelector<HTMLLabelElement>('label[for$="-monthly"]')!.click())
		expect(events('page-visit')).toEqual([
			['experiment-action', { experiment: 'pricing-coverage-v1', variant, metric: 'page-visit' }]
		])
		expect(document.documentElement.getAttribute('data-ab-group')).toBe(menu)
		expect(document.documentElement.getAttribute('data-ab-pricing-coverage-v1')).toBe(variant)
		await act(async () => root.render(null))
		new Function(getHeadBootstrapScript())()
		await act(async () => root.render(<Pricing />))
		await act(async () => show(host.querySelector('main')!))
		expect(events('page-visit')).toHaveLength(2)
		expect(track.mock.calls.filter(([name]) => name === 'experiment-exposure')).toEqual([
			['experiment-exposure', { experiment: 'pricing-coverage-v1', variant }]
		])
	}
)

test('a browser history restore counts a new foreground visit without duplicating exposure or clicks', async () => {
	await act(async () => root.render(<Pricing />))
	const main = host.querySelector('main')!
	await act(async () => show(main))
	await act(async () => window.dispatchEvent(new Event('pageshow')))
	expect(events('page-visit')).toHaveLength(1)
	const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
	const restored = new Event('pageshow')
	Object.defineProperty(restored, 'persisted', { value: true })
	await act(async () => window.dispatchEvent(restored))
	expect(events('page-visit')).toHaveLength(1)
	visibility.mockReturnValue('visible')
	await act(async () => document.dispatchEvent(new Event('visibilitychange')))
	expect(events('page-visit')).toHaveLength(2)
	await act(async () => show(main))
	await act(async () =>
		host
			.querySelector<HTMLButtonElement>('button[data-umami-event-plan="pro"][data-umami-event-provider="stripe"]')!
			.click()
	)
	expect(events('page-visit')).toHaveLength(2)
	expect(events('subscribe-click')).toHaveLength(1)
	expect(track.mock.calls.filter(([name]) => name === 'experiment-exposure')).toHaveLength(1)
	await act(async () => window.dispatchEvent(restored))
	expect(events('page-visit')).toHaveLength(3)
	await act(async () => root.render(null))
	await act(async () => window.dispatchEvent(restored))
	expect(events('page-visit')).toHaveLength(3)
})

test('queues early visits and repeat paid-plan clicks in order, preserving the selected plan and cycle', async () => {
	const sdk = window.umami
	delete window.umami
	await act(async () => root.render(<Pricing />))
	const pro = host.querySelector<HTMLButtonElement>(
		'button[data-umami-event-plan="pro"][data-umami-event-provider="stripe"]'
	)!
	await act(async () => pro.click())
	await act(async () => pro.click())
	await act(async () => host.querySelector<HTMLLabelElement>('label[for$="-monthly"]')!.click())
	await act(async () =>
		host
			.querySelector<HTMLButtonElement>('button[data-umami-event-plan="api"][data-umami-event-provider="llamapay"]')!
			.click()
	)
	window.umami = sdk
	await act(async () => window.dispatchEvent(new Event('umami-ready')))
	await act(async () => window.dispatchEvent(new Event('umami-ready')))
	expect(track.mock.calls).toEqual([
		['experiment-exposure', { experiment: 'pricing-coverage-v1', variant: 'b' }],
		['experiment-action', { experiment: 'pricing-coverage-v1', variant: 'b', metric: 'page-visit' }],
		...['pro', 'pro', 'api'].map((plan) => [
			'experiment-action',
			{
				experiment: 'pricing-coverage-v1',
				variant: 'b',
				metric: 'subscribe-click',
				plan,
				provider: plan === 'api' ? 'llamapay' : 'stripe',
				placement: 'cards',
				billing_cycle: plan === 'api' ? 'monthly' : 'yearly'
			}
		])
	])
	expect(subscribe.mock.calls).toEqual([['pro'], ['pro'], ['api']])
})

test('waits for the foreground and excludes trial, free signup and disabled checkout buttons', async () => {
	const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
	await act(async () => root.render(<Pricing loading />))
	await act(async () => show(host.querySelector('main')!))
	expect(events('page-visit')).toEqual([])
	visibility.mockReturnValue('visible')
	await act(async () => document.dispatchEvent(new Event('visibilitychange')))
	await act(async () => {
		host.querySelector<HTMLButtonElement>('button[data-umami-event="subscribe-trial-start"]')!.click()
		host
			.querySelector<HTMLButtonElement>('button[data-umami-event-plan="pro"][data-umami-event-provider="stripe"]')!
			.click()
	})
	await act(async () => root.render(<Pricing />))
	await act(async () =>
		[...host.querySelectorAll('button')].find((button) => button.textContent === 'Start for Free')!.click()
	)
	expect(events('page-visit')).toHaveLength(1)
	expect(events('subscribe-click')).toEqual([])
	expect(subscribe.mock.calls).toEqual([['free']])
})

test('comparison checkout counts the plan click under fallback A and excludes sales', async () => {
	document.documentElement.removeAttribute('data-ab-pricing-coverage-v1')
	await act(async () =>
		root.render(
			<main ref={observePricingPage} onClickCapture={trackPricingClick} data-billing-cycle="monthly">
				<SubscriptionComparisonSection
					planOrder={PLAN_ORDER}
					comparisonSections={[]}
					billingCycle="monthly"
					selectedPlan="api"
					currentPlan="free"
					hidePlanActions={false}
					onPlanAction={subscribe}
				/>
			</main>
		)
	)
	await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Get Started: API"]')!.click())
	await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Contact us: Enterprise"]')!.click())
	expect(events('subscribe-click')).toEqual([
		[
			'experiment-action',
			{
				experiment: 'pricing-coverage-v1',
				variant: 'a',
				metric: 'subscribe-click',
				plan: 'api',
				provider: 'stripe',
				placement: 'comparison',
				billing_cycle: 'monthly'
			}
		]
	])
	expect(subscribe.mock.calls).toEqual([['api'], ['enterprise']])
})

test('comparison-table paid-plan upgrades are not new subscribe clicks', async () => {
	await act(async () =>
		root.render(
			<main ref={observePricingPage} onClickCapture={trackPricingClick} data-billing-cycle="yearly">
				<SubscriptionComparisonSection
					planOrder={PLAN_ORDER}
					comparisonSections={[]}
					billingCycle="yearly"
					selectedPlan="api"
					currentPlan="pro"
					hidePlanActions={false}
					onPlanAction={subscribe}
				/>
			</main>
		)
	)
	await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Get Started: API"]')!.click())
	expect(subscribe).toHaveBeenCalledExactlyOnceWith('api')
	expect(events('subscribe-click')).toEqual([])
})

test('reduced motion shows complete coverage values immediately', async () => {
	vi.spyOn(window, 'matchMedia').mockReturnValue({
		matches: true,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	} as unknown as MediaQueryList)
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<SubscriptionCoverage />
			</QueryClientProvider>
		)
	)
	expect([...host.querySelectorAll('[data-coverage-count]')].map((node) => node.textContent)).toEqual([
		'8,236',
		'467',
		'16,312',
		'4,562'
	])
})

test('coverage animation waits for data, then counts rise while accessible totals stay stable', async () => {
	queryClient.clear()
	vi.useFakeTimers()
	const response = Promise.withResolvers<unknown>()
	http.serve({ '/api/public/subscription/coverage': () => response.promise })
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<SubscriptionCoverage />
			</QueryClientProvider>
		)
	)
	await act(async () => {
		for (const observer of observers) for (const target of observer.targets) observer.intersect(target)
		await vi.advanceTimersByTimeAsync(1600)
	})
	expect(host.querySelector('dl')!.textContent).toContain('Loading')
	await act(async () => {
		response.resolve({ protocols: 9000, protocolsAddedThisWeek: 20, chains: 500, yieldPools: 18_000, rwaAssets: 6000 })
		await vi.advanceTimersByTimeAsync(1)
	})
	await act(async () => {
		for (const observer of observers) for (const target of observer.targets) observer.intersect(target)
	})
	expect([...host.querySelectorAll('[data-coverage-count]')].map((node) => node.textContent)).toEqual([
		'0',
		'0',
		'0',
		'0'
	])
	await act(async () => vi.advanceTimersByTimeAsync(1600))
	const intermediate = Number(host.querySelector('[data-coverage-count="9000"]')!.textContent!.replaceAll(',', ''))
	expect(intermediate).toBeGreaterThan(0)
	expect(intermediate).toBeLessThan(9000)
	expect(host.querySelector('dd .sr-only')!.textContent).toBe('9,000')
	expect(host.querySelector('[aria-label="DefiLlama data coverage"]')!.getAttribute('aria-valuenow')).toBe('3.5')
	await act(async () => vi.advanceTimersByTimeAsync(1600))
	expect([...host.querySelectorAll('[data-coverage-count]')].map((node) => node.textContent)).toEqual([
		'9,000',
		'500',
		'18,000',
		'6,000'
	])
})

test('a refresh updates the totals and weekly additions', async () => {
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<SubscriptionCoverage />
			</QueryClientProvider>
		)
	)
	http.serve({
		'/api/public/subscription/coverage': {
			protocols: 9124,
			protocolsAddedThisWeek: 18,
			chains: 503,
			yieldPools: 18_346,
			rwaAssets: 6002
		}
	})
	await act(async () => {
		await queryClient.invalidateQueries({ queryKey: ['subscription-coverage'] })
	})
	await waitForUi(() => expect(host.textContent).toContain('+18 this week'))
	expect([...host.querySelectorAll('dd .sr-only')].map((node) => node.textContent)).toEqual([
		'9,124',
		'503',
		'18,346',
		'6,002'
	])
})

test('unavailable coverage never appears as zero or sample campaign counts', async () => {
	queryClient.clear()
	http.serve({ '/api/public/subscription/coverage': fixtureStatus(502) })
	vi.useFakeTimers()
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<SubscriptionCoverage />
			</QueryClientProvider>
		)
	)
	await act(async () => vi.advanceTimersByTimeAsync(1500))
	expect(host.querySelector('[role="alert"]')!.textContent).toBe('Coverage data is temporarily unavailable.')
	expect([...host.querySelectorAll('dd')].map((node) => node.textContent)).toEqual(['—', '—', '—', '—'])
	const response = Promise.withResolvers<unknown>()
	http.serve({ '/api/public/subscription/coverage': () => response.promise })
	let retry: Promise<void>
	await act(async () => {
		retry = queryClient.invalidateQueries({ queryKey: ['subscription-coverage'] })
	})
	expect(host.querySelector('[role="alert"]')!.textContent).toBe('Coverage data is temporarily unavailable.')
	expect(host.querySelector('dl')!.getAttribute('aria-busy')).toBe('false')
	await act(async () => {
		response.resolve({ protocols: 0, protocolsAddedThisWeek: 0, chains: 0, yieldPools: 0, rwaAssets: 0 })
		await retry!
		await vi.advanceTimersByTimeAsync(1)
	})
	expect([...host.querySelectorAll('dd .sr-only')].map((node) => node.textContent)).toEqual(['0', '0', '0', '0'])
	expect(host.textContent).toContain('0 this week')
	expect(host.textContent).not.toContain('+0')
	expect(host.querySelector('[role="alert"]')).toBeNull()
})

test('a failed background refresh keeps the last counts and identifies them as stale', async () => {
	http.serve({ '/api/public/subscription/coverage': fixtureStatus(502) })
	await act(async () =>
		root.render(
			<QueryClientProvider client={queryClient}>
				<SubscriptionCoverage />
			</QueryClientProvider>
		)
	)
	await act(async () => {
		await queryClient.invalidateQueries({ queryKey: ['subscription-coverage'] })
	})
	await waitForUi(() =>
		expect(host.querySelector('[role="alert"]')?.textContent).toBe(
			'Coverage could not refresh. Showing the last available counts.'
		)
	)
	expect([...host.querySelectorAll('dd .sr-only')].map((node) => node.textContent)).toEqual([
		'8,236',
		'467',
		'16,312',
		'4,562'
	])
})
