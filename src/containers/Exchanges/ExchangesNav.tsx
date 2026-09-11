import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { Tooltip } from '~/ui/Tooltip'
import { withCountryParam } from './queryState'

const EXCHANGES_PAGES = {
	exchanges: {
		href: '/exchanges',
		label: 'Exchanges',
		heading: 'Exchanges',
		description: 'Activity, liquidity, fees, and compliance across CEXs and DEXs.'
	},
	rank: {
		href: '/exchanges/rank',
		label: 'Ranking',
		heading: 'REAL Ranking',
		description:
			'The REAL score — Reserves, Execution, Activity, Liquidity — for every exchange, and how each pillar is built.'
	},
	reserves: {
		href: '/cexs',
		label: 'Reserves',
		heading: 'Exchange reserves',
		description: 'Tracked CEX wallet assets, clean reserves, and net inflows.'
	},
	charts: {
		href: '/exchanges/charts',
		label: 'Charts',
		heading: 'Exchange charts',
		description: 'Historical volume, open interest, depth, and normalized volume across exchanges.'
	},
	tokens: {
		href: '/exchanges/tokens',
		label: 'Token finder',
		heading: 'Find exchanges by token',
		description: 'Find exchanges and market segments listing all or any selected tokens.'
	},
	ramp: {
		href: '/ramp',
		label: 'Fiat ramps',
		heading: 'Fiat on-ramp and off-ramp costs',
		description:
			'What a fiat round trip costs on each venue: rail fee, taker fee, slippage and the BTC transfer, per country and currency.'
	}
} as const

const EXCHANGES_PAGE_ORDER = ['exchanges', 'rank', 'reserves', 'charts', 'tokens', 'ramp'] as const

export type ExchangesPage = keyof typeof EXCHANGES_PAGES

export function ExchangesNav({ activePage, country = null }: { activePage: ExchangesPage; country?: string | null }) {
	const selectedPage = EXCHANGES_PAGES[activePage]
	return (
		<div className="flex flex-col gap-2 pb-2">
			<nav className={tabTrackStyles} aria-label="Exchanges pages">
				{EXCHANGES_PAGE_ORDER.map((pageId) => {
					const page = EXCHANGES_PAGES[pageId]
					const href =
						pageId === 'exchanges' || pageId === 'tokens' || pageId === 'ramp'
							? withCountryParam(page.href, country)
							: page.href
					if (pageId === activePage) {
						return (
							<TabLink as={BasicLink} key={pageId} href={href} data-active aria-current="page">
								{page.label}
							</TabLink>
						)
					}
					return (
						<Tooltip
							key={pageId}
							content={page.description}
							render={<TabLink as={BasicLink} href={href} data-active={false} />}
						>
							{page.label}
						</Tooltip>
					)
				})}
			</nav>
			<h1 className="sr-only">{selectedPage.heading}</h1>
			{/* The directory carries its own visible "Find My Exchange" heading, so the blurb
			    would only repeat it and push the table below the fold. */}
			{activePage === 'exchanges' ? null : <p className="px-1 body-sm text-secondary">{selectedPage.description}</p>}
		</div>
	)
}
