/*
 * menu-layout-v1 compares two main menus. A is the menu from public/pages.json, with Equities' child labels aligned
 * to the parent text. B is MENU_VARIANT_B below: the same row recipe, grouped, with Rewards added to Tools. In both,
 * the current page's group opens on its own and at most one group is open (groupState.ts). Premium, pinned pages,
 * personal dashboards, Old Menu and the footer destinations stay in both.
 *
 * It is a `site` experiment in EXPERIMENTS (~/utils/analytics/experiment): the variant is the site's persistent 50/50
 * `defillama-ab-group` assignment (AB_GROUP_COOKIE_NAME in ~/utils/abTesting), so it shares cohorts with other site experiments and never rerandomizes on navigation.
 * PrimaryNavLinks server-renders both layouts and the pre-paint `data-ab-group` attribute shows one through CSS;
 * without an assignment the menu is A. Never pick the layout on the client, or the other one flashes first.
 */
import type { TNavLink } from './types'

export const MENU_EXPERIMENT_ID = 'menu-layout-v1'

export const MENU_VARIANT_B: Array<TNavLink> = [
	{ name: 'Overview', route: '/', icon: 'house' },
	{
		name: 'DeFi',
		route: '/chains',
		icon: 'earth',
		children: [
			{ name: 'Chains', route: '/chains' },
			{ name: 'Categories', route: '/categories' },
			{ name: 'Yields', route: '/yields' },
			{ name: 'Hacks', route: '/hacks' }
		]
	},
	{
		name: 'Metrics',
		route: '/metrics',
		icon: 'bar-chart-2',
		children: [
			{ name: 'All Metrics', route: '/metrics' },
			{ name: 'DEXs', route: '/dexs' },
			{ name: 'Perps', route: '/perps' },
			{ name: 'Revenue', route: '/revenue' },
			{ name: 'Fees', route: '/fees' },
			{ name: 'Holders Revenue', route: '/holders-revenue' }
		]
	},
	{
		name: 'Tools',
		route: '/tools',
		icon: 'pencil-ruler',
		children: [
			{ name: 'All Tools', route: '/tools' },
			{ name: 'Crypto Cards', route: '/crypto-cards' },
			{ name: 'ChainList', route: 'https://chainlist.org/' },
			{ name: 'Dashboard Builder', route: '/pro' },
			{ name: 'Watchlist', route: '/watchlist' },
			{ name: 'Rewards', route: '/rewards' }
		]
	},
	{
		name: 'Assets',
		route: '/tokens',
		icon: 'tag',
		children: [
			{ name: 'Tokens', route: '/tokens' },
			{ name: 'Stablecoins', route: '/stablecoins' },
			{ name: 'RWAs', route: '/rwa' },
			{ name: 'ETFs', route: '/etfs' },
			{ name: 'Universal Token Rating', route: '/universal-token-rating' }
		]
	},
	{
		name: 'Equities',
		route: '/equities',
		icon: 'trending-up',
		children: [
			{ name: 'Rankings', route: '/equities' },
			{ name: 'Sectors', route: '/equities/sectors' },
			{ name: 'Industries', route: '/equities/industries' },
			{ name: 'Earnings Calendar', route: '/equities/earnings-calendar' },
			{ name: 'Pre-IPO', route: '/pre-ipo' }
		]
	},
	{
		name: 'Exchanges',
		route: '/exchanges',
		icon: 'bar-chart-2',
		children: [
			{ name: 'Exchanges', route: '/exchanges' },
			{ name: 'MiCA', route: '/mica' },
			{ name: 'Reserves', route: '/cexs' },
			{ name: 'Market Makers', route: '/market-makers' }
		]
	},
	{ name: 'DefiLlama Research', route: '/research' },
	{ name: 'Investor Relations', route: 'https://investors.defillama.com/', icon: 'trending-up' },
	{ name: 'Support', route: '/support', icon: 'headset' },
	{ name: 'API & MCP', route: 'https://api-docs.defillama.com/', icon: 'code' },
	{ name: 'DEX Aggregator', route: 'https://swap.defillama.com/', icon: 'landmark' }
]
