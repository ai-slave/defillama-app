import type { GetStaticPropsContext } from 'next'
import { describe, expect, test, vi } from 'vitest'
import { installMetadataSeeder } from '~/utils/test/metadataCache'

// Chain-native rankings read the fees overview's chain rows; app-aggregation rankings read chain metadata totals.
// The fixture gives each source different numbers so the returned rows show which builder a page uses.
const chainRow = (name: string, total24h: number) => ({
	name,
	displayName: name,
	slug: name.toLowerCase(),
	protocolType: 'chain',
	total24h,
	total7d: null,
	total30d: total24h * 10
})

vi.mock('~/utils/async', async (importOriginal) => ({
	...(await importOriginal<typeof import('~/utils/async')>()),
	fetchJson: async (url: string) => {
		const { pathname, searchParams } = new URL(url)
		if (pathname.endsWith('/metrics/fees/chain/base')) return { protocols: [] }
		if (pathname.endsWith('/metrics/fees')) {
			const dataType = searchParams.get('dataType')
			if (dataType === 'dailyFees') return { protocols: [chainRow('Base', 100)] }
			if (dataType === 'dailyRevenue') return { protocols: [chainRow('Base', 40)] }
			if (dataType === null) return { protocols: [chainRow('Base', 70)] }
		}
		throw new Error(`Unrouted upstream request: ${url}`)
	}
}))

// Heavy page chrome; these tests only read getStaticProps output.
vi.mock('~/layout', () => ({ default: () => null }))
vi.mock('~/containers/AdapterMetrics/ChainsByAdapter', () => ({ ChainsByAdapter: () => null }))

const metadata = installMetadataSeeder()

const chainMetadata = {
	base: {
		id: 'base',
		name: 'Base',
		chainFees: true,
		chainRevenue: true,
		fees: true,
		revenue: true,
		dimAgg: { fees: { daf: { '24h': 5 }, dar: { '24h': 6 }, dhr: { '24h': 7 } } }
	},
	appchain: {
		id: 'appchain',
		name: 'Appchain',
		fees: true,
		revenue: true,
		dimAgg: { fees: { daf: { '24h': 1 }, dar: { '24h': 2 }, dhr: { '24h': 3 } } }
	}
}

const rankingPages = [
	{ route: '/fees/chains', loadPage: () => import('~/pages/fees/chains'), rows: [['Base', 100]] },
	{ route: '/revenue/chains', loadPage: () => import('~/pages/revenue/chains'), rows: [['Base', 40]] },
	{
		route: '/app-fees/chains',
		loadPage: () => import('~/pages/app-fees/chains'),
		rows: [
			['Base', 5],
			['Appchain', 1]
		]
	},
	{
		route: '/app-revenue/chains',
		loadPage: () => import('~/pages/app-revenue/chains'),
		rows: [
			['Base', 6],
			['Appchain', 2]
		]
	},
	{
		route: '/holders-revenue/chains',
		loadPage: () => import('~/pages/holders-revenue/chains'),
		rows: [
			['Base', 7],
			['Appchain', 3]
		]
	},
	{ route: '/rev/chains', loadPage: () => import('~/pages/rev/chains'), rows: [['Base', 70]] }
]

describe('fees and revenue page semantics', () => {
	test.each(rankingPages)('$route ranks chains from its own fee/revenue source', async ({ loadPage, rows }) => {
		metadata.seed({ chainMetadata })
		const page = await loadPage()

		const result = await page.getStaticProps({} as GetStaticPropsContext)

		expect('props' in result && result.props.chains.map((chain) => [chain.name, chain.total24h])).toEqual(rows)
	})
})
