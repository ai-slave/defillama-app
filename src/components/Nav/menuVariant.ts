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
