import * as React from 'react'
import { BasicLink } from '~/components/Link'
import { Icon } from '~/ui/Icon'
import { Account } from '../Account'
import { PremiumHeader } from '../PremiumHeader'
import { LinkToPage, navSummaryStyles, PrimaryNavGroup, SidebarDivider } from '../shared'
import { ThemeSwitch } from '../ThemeSwitch'
import type { TNavLink, TNavLinks, TOldNavLink } from '../types'
import { PinnedPages } from './PinnedPages'

export function DesktopNav({
	mainLinks,
	pinnedPages,
	userDashboards,
	footerLinks,
	oldMetricLinks,
	asPath
}: {
	mainLinks: TNavLinks
	pinnedPages: Array<TNavLink>
	userDashboards: Array<TNavLink>
	footerLinks: TNavLinks
	oldMetricLinks: Array<TOldNavLink>
	asPath: string
}) {
	const isResearch = asPath.startsWith('/research')
	return (
		<span className="desktop-nav-shell col-span-1 max-lg:hidden">
			<nav className="sticky top-0 bottom-0 left-0 isolate col-span-1 flex h-screen flex-col gap-1 overflow-x-hidden overflow-y-auto bg-page py-4 *:pl-4">
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
							{pages.map(({ name, route, icon, attention, isNew, umamiEvent, children }) =>
								children ? (
									<PrimaryNavGroup
										key={`desktop-nav-${name}-${route}`}
										name={name}
										route={route}
										icon={icon}
										pages={children}
										asPath={asPath}
									/>
								) : (
									<LinkToPage
										key={`desktop-nav-${name}-${route}`}
										route={route}
										name={name}
										icon={icon}
										attention={attention}
										isNew={isNew}
										asPath={asPath}
										umamiEvent={umamiEvent}
									/>
								)
							)}
						</div>
					))}

					<details className="group">
						<summary className={`${navSummaryStyles} label-sm`}>
							<span>Old Menu</span>
							<Icon name="chevron-down" className="size-4 shrink-0 text-tertiary group-open:rotate-180" />
						</summary>
						<div className="border-l border-subtle pl-2">
							{oldMetricLinks.map(({ name, route, pages }: TOldNavLink) => (
								<React.Fragment key={`old-nav-desktop-${name}-${route ?? ''}`}>
									{pages ? (
										<details className="group/second">
											<summary className={navSummaryStyles}>
												<span>{name}</span>
												<Icon
													name="chevron-down"
													className="size-4 shrink-0 text-tertiary group-open/second:rotate-180"
												/>
											</summary>
											<div className="border-l border-subtle pl-2">
												{pages.map(({ name: pageName, route: pageRoute }) => (
													<LinkToPage
														key={`old-desktop-nav-${pageName}-${pageRoute}`}
														route={pageRoute}
														name={pageName}
														asPath={asPath}
														isOld
													/>
												))}
											</div>
										</details>
									) : route ? (
										<LinkToPage key={`old-desktop-nav-${name}-${route}`} route={route} name={name} asPath={asPath} />
									) : null}
								</React.Fragment>
							))}
						</div>
					</details>

					{pinnedPages.length > 0 ? <PinnedPages pinnedPages={pinnedPages} asPath={asPath} /> : null}

					{userDashboards.length > 0 ? (
						<div className="group">
							<p className="flex items-center justify-between gap-3 rounded-md pt-1.5 label-sm text-secondary">
								Your Dashboards
							</p>
							<div>
								{userDashboards.map(({ name, route }) => (
									<LinkToPage key={`desktop-nav-${name}-${route}`} route={route} name={name} asPath={asPath} />
								))}
							</div>
						</div>
					) : null}

					{footerLinks.map(({ category, pages }) => (
						<NavDetailsSection key={`desktop-nav-${category}`} category={category} pages={pages} asPath={asPath} />
					))}
				</div>

				<div className="sticky bottom-0 flex w-full flex-col gap-2 bg-page">
					<SidebarDivider className="-ml-1.5 pb-1" />
					<Account asPath={asPath} />
					<ThemeSwitch />
				</div>
			</nav>
		</span>
	)
}

function NavDetailsSection({ category, pages, asPath }: { category: string; pages: Array<TNavLink>; asPath: string }) {
	const lastItemRef = React.useRef<HTMLDivElement>(null)

	return (
		<details
			className={`group ${category === 'More' ? 'mt-auto' : ''}`}
			onToggle={(e) => {
				if (e.currentTarget.open) {
					setTimeout(() => {
						lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
					}, 0)
				}
			}}
		>
			<summary className={navSummaryStyles}>
				<span>{category}</span>
				<Icon name="chevron-up" className="size-4 shrink-0 text-tertiary group-open:rotate-180" />
			</summary>
			<div className="border-l border-subtle pl-2">
				{pages.map(({ name, route, icon, attention }, index) => (
					<div key={`desktop-nav-${name}-${route}`} ref={index === pages.length - 1 ? lastItemRef : null}>
						<LinkToPage route={route} name={name} icon={icon} attention={attention} asPath={asPath} />
					</div>
				))}
			</div>
		</details>
	)
}
