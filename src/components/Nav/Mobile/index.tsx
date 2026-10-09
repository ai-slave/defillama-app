import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import { MobileSearch } from '~/components/Search'
import type { TNavLink, TNavLinks } from '../types'
import { Menu } from './Menu'
import { Settings } from './Settings'

export function MobileNav({
	mainLinks,
	pinnedPages,
	userDashboards,
	dashboardsStatus,
	footerLinks,
	tvlOptions,
	asPath
}: {
	mainLinks: TNavLinks
	pinnedPages: Array<TNavLink>
	userDashboards: Array<TNavLink>
	dashboardsStatus: ReactNode
	footerLinks: TNavLinks
	tvlOptions?: Array<{ name: string; key: string }>
	asPath: string
}) {
	const isResearch = asPath.startsWith('/research')
	return (
		<nav className="col-span-full flex items-center gap-2 bg-brand px-4 py-3 lg:hidden">
			<BasicLink href={isResearch ? '/research' : '/'} className="mr-auto shrink-0">
				<span className="sr-only">{isResearch ? 'Navigate to DefiLlama Research' : 'Navigate to DeFi Dashboard'}</span>
				<img
					src={isResearch ? '/assets/research_logo_dark.webp' : '/assets/defillama.webp'}
					alt=""
					height={36}
					width={105}
					className="mr-auto object-contain object-left"
					fetchPriority="high"
					loading="eager"
					decoding="sync"
				/>
			</BasicLink>

			<MobileSearch searchTrigger={isResearch ? <ResearchSearchDialog variant="mobile" /> : undefined} />

			<Settings tvlOptions={tvlOptions} />

			<Menu
				mainLinks={mainLinks}
				pinnedPages={pinnedPages}
				userDashboards={userDashboards}
				dashboardsStatus={dashboardsStatus}
				footerLinks={footerLinks}
				asPath={asPath}
			/>
		</nav>
	)
}
