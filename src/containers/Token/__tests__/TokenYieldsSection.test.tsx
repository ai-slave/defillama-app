import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IYieldTableRow } from '~/containers/Yields/Tables/types'

var queryState: {
	data?: IYieldTableRow[]
	error?: Error | null
	isLoading: boolean
} = {
	data: [],
	error: null,
	isLoading: false
}

var yieldsQueryState = {
	selectedChains: [] as string[],
	minTvl: null as number | null,
	maxTvl: null as number | null,
	minApy: null as number | null,
	maxApy: null as number | null
}

var routerState = {
	pathname: '/token/[token]',
	query: {} as Record<string, string | string[]>,
	push: vi.fn()
}

const { yieldsTableCalls } = vi.hoisted(() => ({
	yieldsTableCalls: [] as Array<{
		appearance?: string
		dataLength: number
		initialPageIndex?: number
		initialPageSize?: number
		interactionDisabled?: boolean
		loadingLabel?: string
	}>
}))

// The v2 earn fetch is enabled off the resolved token keys; the section renders
// hydration.rows until the client fetch resolves. The mock ignores `enabled` and
// always returns queryState so tests drive the fetched vs hydrated paths directly.
vi.mock('@tanstack/react-query', () => ({
	useQuery: () => queryState
}))

vi.mock('next/router', () => ({
	useRouter: () => routerState
}))

vi.mock('~/components/Filters/ResponsiveFilterLayout', () => ({
	ResponsiveFilterLayout: ({ children }: { children: (nestedMenu: boolean) => React.ReactNode }) => (
		<div>{children(false)}</div>
	)
}))

vi.mock('~/components/Filters/TVLRange', () => ({
	TVLRange: () => <div>TVL Range</div>
}))

vi.mock('~/ui/Icon', () => ({
	Icon: ({ name }: { name: string }) => <span>{name}</span>
}))

vi.mock('~/ui/Loaders', () => ({
	LocalLoader: () => <div>loader</div>,
	LoadingSpinner: () => <div>spinner</div>,
	LoadingDots: () => <span>...</span>
}))

vi.mock('~/containers/Yields/Filters/APYRange', () => ({
	APYRange: () => <div>APY</div>
}))

vi.mock('~/containers/Yields/Filters/Chains', () => ({
	FilterByChain: () => <div>Chains</div>
}))

vi.mock('~/containers/Yields/hooks', () => ({
	useFormatYieldQueryParams: () => yieldsQueryState
}))

vi.mock('../deferred/DeferredPaginatedYieldsPoolTable', () => ({
	DeferredPaginatedYieldsPoolTable: ({
		data,
		appearance,
		initialPageSize,
		initialPageIndex,
		interactionDisabled,
		loadingLabel
	}: {
		data: Array<{ pool: string }>
		appearance?: string
		initialPageSize?: number
		initialPageIndex?: number
		interactionDisabled?: boolean
		loadingLabel?: string
	}) => {
		yieldsTableCalls.push({
			appearance,
			dataLength: data.length,
			initialPageIndex,
			initialPageSize,
			interactionDisabled,
			loadingLabel
		})
		return <div>Yield pools table</div>
	}
}))

afterEach(() => {
	queryState = {
		data: [],
		error: null,
		isLoading: false
	}
	yieldsQueryState = {
		selectedChains: [],
		minTvl: null,
		maxTvl: null,
		minApy: null,
		maxApy: null
	}
	routerState = {
		pathname: '/token/[token]',
		query: {},
		push: vi.fn()
	}
	yieldsTableCalls.length = 0
	vi.clearAllMocks()
})

import { TokenYieldsSection } from '../TokenYieldsSection'

function makeYieldRow(overrides: Partial<IYieldTableRow> = {}): IYieldTableRow {
	return {
		id: 'pool-1',
		pool: 'stETH-ETH',
		poolMeta: null,
		project: 'Aave',
		projectslug: 'aave',
		airdrop: false,
		raiseValuation: null,
		configID: 'pool-1',
		chains: ['Ethereum'],
		tvl: 1_000_000,
		apy: 5.1,
		apyBase: null,
		apyReward: null,
		apyMean30d: null,
		apyRewardRaw: null,
		rewardTokens: [],
		rewardTokensSymbols: [],
		intrinsicSourceSymbol: null,
		volumeUsd1d: null,
		pricePerShare: null,
		holderCount: null,
		avgPositionUsd: null,
		top10Pct: null,
		stabilityScore: null,
		stabilityRating: null,
		sparkline: null,
		resolvedApy: { base: null, reward: null, intrinsic: null, total: 5.1 },
		stablecoin: false,
		tokenSymbols: ['stETH', 'ETH'],
		singleAssetExposure: false,
		ilRisk: false,
		url: 'https://example.com/pool-1',
		category: 'Lending',
		referenceAsset: 'ETH',
		...overrides
	}
}

function makeHydration(overrides: Partial<import('../types').TokenYieldsHydration> = {}) {
	return {
		rows: [makeYieldRow()],
		rowCount: 1,
		chainList: ['Ethereum'],
		pageSize: 10,
		tokenKeys: ['family:eth'],
		...overrides
	}
}

describe('TokenYieldsSection', () => {
	it('renders the yields filter controls and paginated table (no token/column filters)', () => {
		queryState = {
			data: [makeYieldRow()],
			error: null,
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('Tracking 1 pool, average APY 5.10%')
		expect(html).toContain('Chains')
		expect(html).toContain('TVL Range')
		expect(html).toContain('APY')
		expect(html).not.toContain('Tokens')
		expect(html).not.toContain('Columns')
		expect(yieldsTableCalls[0]).toMatchObject({
			appearance: 'embedded',
			dataLength: 1,
			initialPageIndex: 0,
			initialPageSize: 10
		})
	})

	it('renders prefetched rows without waiting for a client fetch', () => {
		queryState = {
			data: undefined,
			error: null,
			isLoading: true
		}

		const html = renderToStaticMarkup(<TokenYieldsSection hydration={makeHydration()} />)

		expect(html).toContain('Tracking 1 pool, average APY 5.10%')
		expect(yieldsTableCalls[0]).toMatchObject({
			dataLength: 1,
			initialPageIndex: 0,
			initialPageSize: 10
		})
	})

	it('shows deferred pagination controls when only the first page is prefetched', () => {
		queryState = {
			data: undefined,
			error: null,
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenYieldsSection hydration={makeHydration({ rowCount: 25 })} />)

		expect(html).toContain('Showing 1 of 25 pools')
		expect(html).toContain('Page 1 of 3')
	})

	it('delegates the background loading status to the table while filters trigger a full fetch', () => {
		queryState = {
			data: undefined,
			error: null,
			isLoading: false
		}
		routerState.query = { chain: 'Ethereum' }

		renderToStaticMarkup(<TokenYieldsSection hydration={makeHydration({ rowCount: 25 })} />)

		expect(yieldsTableCalls[0]).toMatchObject({
			dataLength: 1,
			initialPageIndex: 0,
			initialPageSize: 10,
			interactionDisabled: true,
			loadingLabel: 'Loading full dataset...'
		})
	})

	it('ignores null APYs when computing the average', () => {
		queryState = {
			data: [
				makeYieldRow(),
				makeYieldRow({
					pool: 'wstETH-ETH',
					project: 'Lido',
					projectslug: 'lido',
					configID: 'pool-2',
					tvl: 900000,
					apy: null
				})
			],
			error: null,
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('Tracking 2 pools, average APY 5.10%')
	})

	it('shows a loader while data is loading', () => {
		queryState = {
			data: undefined,
			error: null,
			isLoading: true
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('Loading')
	})

	it('shows an error state when the fetch fails', () => {
		queryState = {
			data: [],
			error: new Error('Failed to fetch yields data'),
			isLoading: false
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('Failed to fetch yields data')
	})

	it('shows an empty state when no pools match the token', () => {
		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('No yield pools found.')
	})

	it('shows the filtered empty state when selectors remove all rows', () => {
		queryState = {
			data: [makeYieldRow()],
			error: null,
			isLoading: false
		}
		yieldsQueryState = {
			...yieldsQueryState,
			minTvl: 2000000
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('No pools match current filters')
		expect(yieldsTableCalls).toHaveLength(0)
	})

	it('does not show reset filters when only column visibility query params are active', () => {
		queryState = {
			data: [makeYieldRow()],
			error: null,
			isLoading: false
		}
		routerState = {
			...routerState,
			query: {
				showMedianApy: 'true'
			}
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).not.toContain('Reset filters')
	})

	it('shows reset filters when a real filter query param is active', () => {
		queryState = {
			data: [makeYieldRow()],
			error: null,
			isLoading: false
		}
		routerState = {
			...routerState,
			query: {
				minApy: '4'
			}
		}

		const html = renderToStaticMarkup(<TokenYieldsSection />)

		expect(html).toContain('Reset filters')
	})
})
