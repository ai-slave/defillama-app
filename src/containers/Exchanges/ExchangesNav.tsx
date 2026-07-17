import { BasicLink } from '~/components/Link'
import { TabLink, tabTrackStyles } from '~/ui/Tab'
import { Tooltip } from '~/ui/Tooltip'

const EXCHANGES_PAGES = {
	exchanges: {
		href: '/exchanges',
		label: 'Exchanges',
		heading: 'Exchanges',
		description: 'Activity, liquidity, fees, and compliance across CEXs and DEXs.'
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
	mica: {
		href: '/mica',
		label: 'MiCA venues',
		heading: 'MiCA-regulated exchanges',
		description: 'Compare EU-regulated exchanges by liquidity, fees, funding options, and verification requirements.'
	}
} as const

const EXCHANGES_PAGE_ORDER = ['exchanges', 'reserves', 'charts', 'mica'] as const

export type ExchangesPage = keyof typeof EXCHANGES_PAGES

export function ExchangesNav({ activePage }: { activePage: ExchangesPage }) {
	const selectedPage = EXCHANGES_PAGES[activePage]
	return (
		<div className="flex flex-col gap-2 pb-2">
			<nav className={tabTrackStyles} aria-label="Exchanges pages">
				{EXCHANGES_PAGE_ORDER.map((pageId) => {
					const page = EXCHANGES_PAGES[pageId]
					if (pageId === activePage) {
						return (
							<TabLink as={BasicLink} key={pageId} href={page.href} data-active aria-current="page">
								{page.label}
							</TabLink>
						)
					}
					return (
						<Tooltip
							key={pageId}
							content={page.description}
							render={<TabLink as={BasicLink} href={page.href} data-active={false} />}
						>
							{page.label}
						</Tooltip>
					)
				})}
			</nav>
			<h1 className="sr-only">{selectedPage.heading}</h1>
			<p className="px-1 body-sm text-secondary">{selectedPage.description}</p>
		</div>
	)
}
