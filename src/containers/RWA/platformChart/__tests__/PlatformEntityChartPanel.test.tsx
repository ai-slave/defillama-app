// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { IRWAAssetsOverview } from '../../api.types'
import { foldRwaPerpsTotals } from '../../cards/cardData'
import type { RWAPlatformMeta } from '../../PlatformPage/api.types'
import { spotAsset } from '../../table/__tests__/fixtures'

let routerQuery: Record<string, string | Array<string>> = {}
const push = vi.fn().mockResolvedValue(true)

// ECharts cannot draw in happy-dom; these tests assert nothing about the chart itself.
vi.mock('~/components/ECharts/MultiSeriesChart', () => ({ default: () => null }))

vi.mock('next/router', () => ({
	useRouter: () => ({
		query: routerQuery,
		pathname: '/rwa/platform/[platform]',
		asPath: '/rwa/platform/ondo',
		push,
		replace: vi.fn()
	})
}))

import { RWAPlatformEntityChartPanel } from '../PlatformEntityChartPanel'

const assets = [spotAsset(), spotAsset({ id: 'b', canonicalMarketId: 'b', assetName: 'Beta' })]

const meta = {
	name: 'Ondo',
	slug: 'ondo',
	milestones: [{ date: '2026-05', event: 'FINRA approval' }]
} as unknown as RWAPlatformMeta

function overview(): IRWAAssetsOverview {
	return {
		platformPage: { meta },
		assets,
		perpsTotals: foldRwaPerpsTotals([]),
		typeOptions: [],
		assetClassOptions: [],
		rwaClassificationOptions: [],
		accessModelOptions: [],
		categoriesOptions: [],
		platforms: ['Ondo'],
		assetGroups: ['Bonds'],
		assetNames: ['Ondo USDY', 'Beta'],
		issuers: ['Ondo'],
		selectedPlatform: 'Ondo',
		selectedAssetGroup: 'All',
		defaultInclusion: {
			includeStablecoins: false,
			includeGovernance: false,
			includeBridgeTvl: true
		},
		selectedChain: 'All',
		selectedCategory: 'All',
		nav: { heading: 'Platforms', links: [], active: 'Ondo' },
		initialChartDatasets: [
			{
				metric: 'activeMcap',
				groupBy: 'none',
				dataset: {
					dimensions: ['timestamp', 'Total Active AUM', 'Ondo USDY', 'Beta'],
					source: [[1_700_000_000_000, 30, 20, 10]]
				}
			}
		],
		cards: null,
		chartMetricAvailability: { hasActiveMcapData: true },
		seriesLatestTimestamp: 1_800_000_000_000,
		platformLogos: {},
		chainSlug: null,
		categorySlug: null,
		platformSlug: 'ondo',
		assetGroupSlug: null
	}
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true
	push.mockReset().mockResolvedValue(true)
	container = document.createElement('div')
	document.body.append(container)
	root = createRoot(container)
})
afterEach(async () => {
	await act(async () => root.unmount())
	container.remove()
})

async function render(query: Record<string, string | Array<string>>) {
	routerQuery = query
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
	const page = overview()
	await act(async () =>
		root.render(
			<QueryClientProvider client={client}>
				<RWAPlatformEntityChartPanel
					overview={page}
					meta={meta}
					aggregateAssets={page.assets}
					includeStablecoins={false}
					includeGovernance={false}
					includeBridgeTvl
					activeFilters={false}
				/>
			</QueryClientProvider>
		)
	)
}

// A chip is the button named "Remove <metric>".
const chip = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${label}"]`)!
const chips = () =>
	[...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remove "]')].map((button) =>
		button.getAttribute('aria-label')
	)
const shallowPush = (query: Record<string, string>) => [
	{ pathname: '/rwa/platform/ondo', query },
	undefined,
	{ shallow: true }
]

describe('RWAPlatformEntityChartPanel', () => {
	test('shows a chip per metric in ?metrics= and removing one writes the rest to the URL', async () => {
		await render({ metrics: 'activeMcap,liveAssets,events' })
		expect(chips()).toEqual(['Remove Active AUM', 'Remove Live Assets', 'Remove Events'])

		await act(async () => chip('Live Assets').click())
		expect(push.mock.calls).toEqual([shallowPush({ metrics: 'activeMcap,events' })])
	})

	test('a chip that turns its metric off hands focus to the next chip, else the previous one', async () => {
		push.mockImplementation(async (url: { query: Record<string, string> }) => {
			await render(url.query)
			return true
		})
		const remove = async (label: string) =>
			act(async () => {
				chip(label).focus()
				chip(label).click()
			})
		await render({ metrics: 'activeMcap,liveAssets,events' })

		await remove('Live Assets')
		expect(chips()).toEqual(['Remove Active AUM', 'Remove Events'])
		expect(document.activeElement).toBe(chip('Events'))

		await remove('Events')
		expect(chips()).toEqual(['Remove Active AUM'])
		expect(document.activeElement).toBe(chip('Active AUM'))
	})

	test('adds a metric from the Add Metrics dialog', async () => {
		await render({})
		expect(chips()).toEqual(['Remove Active AUM'])

		const disclosure = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Add Metrics')!
		await act(async () => disclosure.click())
		const option = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(button) => button.textContent === 'Net Flows'
		)!
		await act(async () => option.click())
		expect(push.mock.calls).toEqual([shallowPush({ metrics: 'activeMcap,netFlows' })])
	})

	test('the metrics dialog resets to the default metrics instead of claiming to clear them', async () => {
		const resetButton = () =>
			[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
				(button) => button.textContent === 'Reset'
			)!
		const openDialog = async () => {
			const disclosure = [...container.querySelectorAll('button')].find(
				(button) => button.textContent === 'Add Metrics'
			)!
			await act(async () => disclosure.click())
		}

		await render({})
		await openDialog()
		expect(resetButton().getAttribute('aria-disabled')).toBe('true')
		await act(async () => root.unmount())

		root = createRoot(container)
		await render({ metrics: 'activeMcap,liveAssets' })
		await openDialog()
		expect(resetButton().getAttribute('aria-disabled')).toBeNull()
		await act(async () => resetButton().click())
		expect(push.mock.calls).toEqual([shallowPush({})])
	})

	test('choosing a period writes it to the URL and daily leaves the URL clean', async () => {
		await render({ chartPeriod: 'weekly' })
		const periodButton = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!
		await act(async () => periodButton('Monthly').click())
		await act(async () => periodButton('Daily').click())
		expect(push.mock.calls).toEqual([shallowPush({ chartPeriod: 'monthly' }), shallowPush({})])
	})
})
