import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { lazy, Suspense, useState } from 'react'
import { Button, StableLabel } from '~/ui/Button'
import { DialogCloseButton } from '~/ui/Dialog'
import { catchLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { Account } from '../Account'
import { observeMenu, trackMenuClick } from '../menuAnalytics'
import { PremiumHeader } from '../PremiumHeader'
import { NavItems, PrimaryNavLinks } from '../PrimaryNavLinks'
import { LinkToPage, navSummaryStyles, useDashboardsDisclosure } from '../shared'
import type { TNavLink, TNavLinks } from '../types'

const ReorderablePinnedPages = lazy(() => import('./ReorderablePinnedPages'))

export function Menu({
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
	const [show, setShow] = useState(false)
	const dashboardsDisclosure = useDashboardsDisclosure()
	// An explicit store: inside the Tooltip's provider the disclosure would otherwise open the tooltip's own store.
	const dialog = Ariakit.useDialogStore({ open: show, setOpen: setShow })

	return (
		<>
			<Tooltip
				content="Open navigation menu"
				render={
					<Ariakit.DialogDisclosure
						store={dialog}
						render={<Button variant="onBrand" size="lg" square aria-label="Open navigation menu" className="-my-0.5" />}
					/>
				}
			>
				<Icon name="menu" height={16} width={16} />
			</Tooltip>

			<Ariakit.Dialog
				store={dialog}
				aria-label="Navigation menu"
				ref={catchLostFocus}
				// Keep expanded navigation sections and the scroll position when reopening.
				unmountOnHide={false}
				className="fixed top-0 right-0 bottom-0 z-10 flex w-full max-w-[300px] drawer-to-left flex-col overflow-auto overscroll-contain bg-surface p-4 pl-5 text-primary"
			>
				<nav
					ref={observeMenu}
					data-menu-layout="mobile"
					onClickCapture={(event) => {
						trackMenuClick(event)
						// Any link in the drawer navigates, so following one closes the drawer.
						if (event.target instanceof Element && event.target.closest('a[href]')) setShow(false)
					}}
					onAuxClickCapture={trackMenuClick}
					className="flex flex-1 flex-col"
				>
					<DialogCloseButton className="ml-auto" ariaLabel="Close navigation menu" />

					{mainLinks.map(({ category, pages }) => (
						<div key={`mobile-nav-${category}`} className="group mb-3 flex flex-col first:mb-auto">
							{category === 'Premium' ? <PremiumHeader /> : <p className="mb-1 label-sm text-secondary">{category}</p>}
							<hr className="border-subtle" />
							{category === 'Main' ? (
								<PrimaryNavLinks pages={pages} asPath={asPath} />
							) : (
								<NavItems pages={pages} asPath={asPath} />
							)}
						</div>
					))}

					{pinnedPages.length > 0 ? <PinnedPagesSection pinnedPages={pinnedPages} asPath={asPath} /> : null}

					{userDashboards.length > 0 || dashboardsStatus ? (
						<details className="group mb-3" data-nav-dashboards {...dashboardsDisclosure}>
							<summary className={`${navSummaryStyles} label-sm`}>
								<span>Your Dashboards</span>
								<Icon name="chevron-down" className="size-4 shrink-0 text-tertiary group-open:rotate-180" />
							</summary>
							<div className="flex flex-col">
								{userDashboards.map(({ name, route, icon }) => (
									<LinkToPage
										route={route}
										name={name}
										icon={icon}
										key={`mobile-nav-${name}-${route}`}
										asPath={asPath}
									/>
								))}
							</div>
							{dashboardsStatus ? <div className="pt-2">{dashboardsStatus}</div> : null}
						</details>
					) : null}

					{footerLinks.map(({ category, pages }) => (
						<div key={`mobile-nav-${category}`} className="group mb-3 flex flex-col first:mb-auto">
							<p className="mb-1 label-sm text-secondary">{category}</p>
							<hr className="border-subtle" />
							{pages.map(({ name, route, icon }) => (
								<LinkToPage route={route} name={name} icon={icon} key={`mobile-nav-${name}-${route}`} asPath={asPath} />
							))}
						</div>
					))}

					<hr className="my-3 border-subtle" />

					<Account />
				</nav>
			</Ariakit.Dialog>
		</>
	)
}

function PinnedPagesSection({ pinnedPages, asPath }: { pinnedPages: Array<TNavLink>; asPath: string }) {
	const [isReordering, setIsReordering] = useState(false)

	// Reordering ends as soon as there is nothing left to reorder, in the same render. Self-terminating:
	// the next render sees isReordering false.
	if (pinnedPages.length <= 1 && isReordering) {
		setIsReordering(false)
	}

	return (
		<div className="group/pinned mb-3 flex flex-col first:mb-auto">
			<div className="mb-1 flex items-center justify-between gap-2 label-sm text-secondary">
				<span>Pinned Pages</span>
				{pinnedPages.length > 1 ? (
					<Button variant="ghost" size="sm" onClick={() => setIsReordering((v) => !v)}>
						<StableLabel labels={['Reorder', 'Done']} current={isReordering ? 'Done' : 'Reorder'} />
					</Button>
				) : null}
			</div>
			<hr className="border-subtle" />
			{isReordering ? (
				<>
					<p className="mt-1 body-sm text-tertiary">Drag to reorder, tap remove to unpin</p>
					<Suspense fallback={<div className="mt-1 min-h-[40px]" />}>
						<ReorderablePinnedPages pinnedPages={pinnedPages} />
					</Suspense>
				</>
			) : (
				<div className="mt-1 flex flex-col gap-1">
					{pinnedPages.map((page) => (
						<LinkToPage
							key={`mobile-nav-pinned-${page.name}-${page.route}`}
							route={page.route}
							name={page.name}
							icon={page.icon}
							attention={page.attention}
							asPath={asPath}
						/>
					))}
				</div>
			)}
		</div>
	)
}
