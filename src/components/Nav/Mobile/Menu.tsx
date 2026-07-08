import * as Ariakit from '@ariakit/react'
import * as React from 'react'
import { lazy, Suspense, useState } from 'react'
import { Icon } from '~/components/Icon'
import { Account } from '../Account'
import { PremiumHeader } from '../PremiumHeader'
import { LinkToPage, navActionStyles, navSummaryStyles } from '../shared'
import type { TNavLink, TNavLinks, TOldNavLink } from '../types'

const ReorderablePinnedPages = lazy(() => import('./ReorderablePinnedPages'))

export function Menu({
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
	const [show, setShow] = useState(false)
	const handleClose = () => setShow(false)

	return (
		<Ariakit.DialogProvider open={show} setOpen={setShow}>
			<Ariakit.DialogDisclosure className="-my-0.5 rounded-md bg-surface/15 p-3 text-on-brand shadow hover:bg-surface/25 focus-visible:bg-surface/25 active:bg-surface/25">
				<span className="sr-only">Open Navigation Menu</span>
				<Icon name="menu" height={16} width={16} />
			</Ariakit.DialogDisclosure>

			<Ariakit.Dialog
				unmountOnHide={false}
				className="fixed top-0 right-0 bottom-0 z-10 flex w-full max-w-[300px] drawer-to-left flex-col overflow-auto overscroll-contain bg-surface p-4 pl-5 text-primary"
			>
				<nav className="flex flex-1 flex-col">
					<Ariakit.DialogDismiss className="ml-auto">
						<span className="sr-only">Close Navigation Menu</span>
						<Icon name="x" height={20} width={20} strokeWidth="4px" />
					</Ariakit.DialogDismiss>

					{mainLinks.map(({ category, pages }) => (
						<div key={`mobile-nav-${category}`} className="group mb-3 flex flex-col first:mb-auto">
							{category === 'Premium' ? <PremiumHeader /> : <p className="mb-1 label-sm text-secondary">{category}</p>}
							<hr className="border-subtle" />
							{pages.map(({ name, route, icon, attention, isNew, umamiEvent }) => (
								<LinkToPage
									route={route}
									name={name}
									icon={icon}
									attention={attention}
									isNew={isNew}
									key={`mobile-nav-${name}-${route}`}
									asPath={asPath}
									onClick={handleClose}
									umamiEvent={umamiEvent}
								/>
							))}
						</div>
					))}

					<details className="group mb-3">
						<summary className={`${navSummaryStyles} label-sm`}>
							<span>Old Menu</span>
							<Icon name="chevron-down" className="size-4 shrink-0 group-open:rotate-180" />
						</summary>
						<div className="border-l border-subtle pl-2 group-open:border-l">
							{oldMetricLinks.map(({ name, route, pages }: TOldNavLink) => (
								<React.Fragment key={`mobile-nav-old-${name}-${route}`}>
									{pages ? (
										<details className="group/second">
											<summary className={navSummaryStyles}>
												<span>{name}</span>
												<Icon name="chevron-down" className="size-4 shrink-0 group-open/second:rotate-180" />
											</summary>
											<div className="border-l border-subtle pl-2">
												{pages.map(({ name: pageName, route: pageRoute }) => (
													<LinkToPage
														route={pageRoute}
														name={pageName}
														key={`mobile-nav-old-${pageName}-${pageRoute}`}
														asPath={asPath}
														onClick={handleClose}
														isOld={true}
													/>
												))}
											</div>
										</details>
									) : route ? (
										<LinkToPage
											route={route}
											name={name}
											key={`mobile-nav-old-${name}-${route}`}
											asPath={asPath}
											onClick={handleClose}
										/>
									) : null}
								</React.Fragment>
							))}
						</div>
					</details>

					{pinnedPages.length > 0 ? (
						<PinnedPagesSection pinnedPages={pinnedPages} asPath={asPath} onClose={handleClose} />
					) : null}

					{userDashboards.length > 0 ? (
						<div className="group mb-3 flex flex-col first:mb-auto">
							<p className="mb-1 label-sm text-secondary">Your Dashboards</p>
							<hr className="border-subtle" />
							{userDashboards.map(({ name, route, icon }) => (
								<LinkToPage
									route={route}
									name={name}
									icon={icon}
									key={`mobile-nav-${name}-${route}`}
									asPath={asPath}
									onClick={handleClose}
								/>
							))}
						</div>
					) : null}

					{footerLinks.map(({ category, pages }) => (
						<div key={`mobile-nav-${category}`} className="group mb-3 flex flex-col first:mb-auto">
							<p className="mb-1 label-sm text-secondary">{category}</p>
							<hr className="border-subtle" />
							{pages.map(({ name, route, icon }) => (
								<LinkToPage
									route={route}
									name={name}
									icon={icon}
									key={`mobile-nav-${name}-${route}`}
									asPath={asPath}
									onClick={handleClose}
								/>
							))}
						</div>
					))}

					<hr className="my-3 border-subtle" />

					<Account asPath={asPath} />
				</nav>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function PinnedPagesSection({
	pinnedPages,
	asPath,
	onClose
}: {
	pinnedPages: Array<TNavLink>
	asPath: string
	onClose: () => void
}) {
	const [isReordering, setIsReordering] = useState(false)

	React.useEffect(() => {
		if (pinnedPages.length <= 1 && isReordering) {
			setIsReordering(false)
		}
	}, [isReordering, pinnedPages.length])

	return (
		<div className="group/pinned mb-3 flex flex-col first:mb-auto">
			<div className="mb-1 flex items-center justify-between gap-2 label-sm text-secondary">
				<span>Pinned Pages</span>
				{pinnedPages.length > 1 ? (
					<button type="button" className={navActionStyles} onClick={() => setIsReordering((v) => !v)}>
						{isReordering ? 'Done' : 'Reorder'}
					</button>
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
							onClick={onClose}
						/>
					))}
				</div>
			)}
		</div>
	)
}
