import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { DisclosureArrow } from '~/ui/ComboboxSelectTrigger'
import { DisclosureChevron } from '~/ui/DisclosureChevron'
import { MenuItem, MenuSurface } from '~/ui/PopoverSurface'
import { Account } from '../Account'
import { observeMenu, trackMenuClick } from '../menuAnalytics'
import { PremiumHeader } from '../PremiumHeader'
import { NavItems, PrimaryNavLinks } from '../PrimaryNavLinks'
import { isNavRouteActive, LinkToPage, navSummaryStyles, SidebarDivider, useDashboardsDisclosure } from '../shared'
import { ThemeSwitch } from '../ThemeSwitch'
import type { TNavLink, TNavLinks } from '../types'
import { PinnedPages } from './PinnedPages'

export function DesktopNav({
	mainLinks,
	pinnedPages,
	userDashboards,
	dashboardsStatus,
	footerLinks,
	asPath
}: {
	mainLinks: TNavLinks
	pinnedPages: Array<TNavLink>
	userDashboards: Array<TNavLink>
	/** The dashboards list's load error, shown under the list. */
	dashboardsStatus: React.ReactNode
	footerLinks: TNavLinks
	asPath: string
}) {
	const isResearch = asPath.startsWith('/research')
	const dashboardsDisclosure = useDashboardsDisclosure()
	return (
		<span className="desktop-nav-shell col-span-1 max-lg:hidden">
			<nav
				ref={observeMenu}
				data-menu-layout="desktop"
				onClickCapture={trackMenuClick}
				onAuxClickCapture={trackMenuClick}
				className="sticky top-0 bottom-0 left-0 isolate col-span-1 flex h-screen flex-col gap-1 overflow-x-hidden overflow-y-auto bg-page py-4 *:pl-4"
			>
				<BasicLink href={isResearch ? '/research' : '/'} className="mb-4 w-fit shrink-0">
					<span className="sr-only">
						{isResearch ? 'Navigate to DefiLlama Research' : 'Navigate to DeFi Dashboard'}
					</span>
					<span className="relative block h-[53px] w-[155px]">
						<img
							src={isResearch ? '/assets/research_logo_dark.webp' : '/assets/defillama.webp'}
							height={53}
							width={155}
							className="invisible absolute inset-0 object-contain object-left dark:visible"
							alt=""
							fetchPriority="high"
							loading="eager"
							decoding="sync"
						/>
						<img
							src={isResearch ? '/assets/research_logo.webp' : '/assets/defillama-dark.webp'}
							height={53}
							width={155}
							className="visible absolute inset-0 object-contain object-left dark:invisible"
							alt=""
							loading="eager"
							decoding="sync"
						/>
					</span>
				</BasicLink>

				<div className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto">
					{mainLinks.map(({ category, pages }) => (
						<div key={`desktop-nav-${category}`} className="group flex flex-col">
							{category === 'Premium' ? <PremiumHeader /> : null}
							{category === 'Main' ? (
								<PrimaryNavLinks pages={pages} asPath={asPath} />
							) : (
								<NavItems pages={pages} asPath={asPath} />
							)}
						</div>
					))}

					{pinnedPages.length > 0 ? <PinnedPages pinnedPages={pinnedPages} asPath={asPath} /> : null}

					{userDashboards.length > 0 || dashboardsStatus ? (
						<details data-nav-dashboards {...dashboardsDisclosure}>
							<summary className={`${navSummaryStyles} label-sm`}>
								<span>Your Dashboards</span>
								<DisclosureChevron kind="tree" size="md" />
							</summary>
							<div>
								{userDashboards.map(({ name, route }) => (
									<LinkToPage key={`desktop-nav-${name}-${route}`} route={route} name={name} asPath={asPath} />
								))}
							</div>
							{dashboardsStatus ? <div className="py-1 pr-2">{dashboardsStatus}</div> : null}
						</details>
					) : null}

					{footerLinks.map(({ category, pages }) => (
						<NavFooterMenu key={`desktop-nav-${category}`} category={category} pages={pages} asPath={asPath} />
					))}
				</div>

				<div className="sticky bottom-0 flex w-full flex-col gap-2 bg-page">
					<SidebarDivider className="-ml-1.5 pb-1" />
					<Account />
					<ThemeSwitch />
				</div>
			</nav>
		</span>
	)
}

/** "More" and "About Us" hold occasional utility links, so each opens as a menu beside the sidebar. Their rows stay put
    at the bottom of the nav, where an inline section pushed its own row up as it opened. A page inside them is not
    highlighted in the sidebar (aria-current still names it): these pages are rarely open, and one click away. */
function NavFooterMenu({ category, pages, asPath }: { category: string; pages: Array<TNavLink>; asPath: string }) {
	return (
		<Ariakit.MenuProvider placement="right-end">
			<Ariakit.MenuButton
				data-menu-name={category}
				data-nav-group-menu-button
				className={`${navSummaryStyles} ${category === 'More' ? 'mt-auto' : ''}`}
			>
				<span>{category}</span>
				<DisclosureArrow />
			</Ariakit.MenuButton>
			<MenuSurface variant="actions" data-nav-group-menu>
				{pages.map(({ name, route }) => {
					const isExternal = route.startsWith('http')
					return (
						<MenuItem
							key={route}
							render={
								<BasicLink
									href={route}
									aria-current={isNavRouteActive(route, asPath) ? 'page' : undefined}
									target={isExternal ? '_blank' : undefined}
									rel={isExternal ? 'noopener noreferrer' : undefined}
								/>
							}
						>
							{name}
						</MenuItem>
					)
				})}
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}
