import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tabs'
import { Tooltip } from '~/ui/Tooltip'
import { withCountryParam } from './queryState'

const EXCHANGES_PAGES = {
	exchanges: {
		href: '/exchanges',
		label: 'Exchanges',
		heading: 'Exchanges',
		description: 'Activity, liquidity, fees and compliance across CEXs and DEXs.'
	},
	rank: {
		href: '/exchanges/rank',
		label: 'Ranking',
		heading: 'REAL Ranking',
		description: 'Every exchange scored on Reserves, Execution, Activity and Liquidity, with how each pillar is built.'
	},
	reserves: {
		href: '/cexs',
		label: 'Reserves',
		heading: 'Exchange reserves',
		description: 'Tracked CEX wallet assets, clean reserves and net inflows.'
	},
	charts: {
		href: '/exchanges/charts',
		label: 'Charts',
		heading: 'Exchange charts',
		description: 'Historical volume, open interest, depth and normalized volume.'
	},
	tokens: {
		href: '/exchanges/tokens',
		label: 'Token finder',
		heading: 'Find exchanges by token',
		description: 'Exchanges and segments listing all or any of the tokens you pick.'
	},
	ramp: {
		href: '/ramp',
		label: 'Fiat ramps',
		heading: 'Fiat on-ramp and off-ramp costs',
		description: 'What a fiat round trip costs per venue, country and currency: rail, taker fee, slippage and transfer.'
	}
} as const

const EXCHANGES_PAGE_ORDER = ['exchanges', 'rank', 'reserves', 'charts', 'tokens', 'ramp'] as const

export type ExchangesPage = keyof typeof EXCHANGES_PAGES

/** Pages whose own content already states the description; see the render note below. */
const BLURB_IS_REDUNDANT = new Set<ExchangesPage>(['exchanges', 'charts'])

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
							<TabLink as={BasicLink} key={pageId} href={href} aria-current="page">
								{page.label}
							</TabLink>
						)
					}
					return (
						<Tooltip key={pageId} content={page.description} render={<TabLink as={BasicLink} href={href} />}>
							{page.label}
						</Tooltip>
					)
				})}
			</nav>
			<h1 className="sr-only">{selectedPage.heading}</h1>
			{/* Two pages drop the blurb because they already say it themselves: the directory
			    carries a visible "Find My Exchange" heading, and charts opens on section
			    headings ("Activity", "Liquidity") that name the same four metrics. On both it
			    would only repeat and push the content below the fold. */}
			{BLURB_IS_REDUNDANT.has(activePage) ? null : (
				<p className="px-1 body-sm text-secondary">{selectedPage.description}</p>
			)}
		</div>
	)
}
