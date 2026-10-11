import * as React from 'react'
import { Button, StableLabel } from '~/ui/Button'
import { keepFocus, neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { mutatePinnedMetrics } from '../pinnedUtils'
import { LinkToPage } from '../shared'
import type { TNavLink } from '../types'

const ReorderablePinnedPages = React.lazy(() => import('./ReorderablePinnedPages'))

export function PinnedPages({ pinnedPages, asPath }: { pinnedPages: Array<TNavLink>; asPath: string }) {
	const [isReordering, setIsReordering] = React.useState(false)

	// Reordering ends as soon as there is nothing left to reorder, in the same render. Self-terminating:
	// the next render sees isReordering false.
	if (pinnedPages.length <= 1 && isReordering) {
		setIsReordering(false)
	}

	return (
		<div className="group/pinned flex flex-col">
			<div
				className="group flex items-center justify-between gap-3 rounded-md pt-1.5 label-sm text-secondary"
				data-reordering={isReordering}
			>
				<span>Pinned Pages</span>
				{pinnedPages.length > 1 ? (
					<Button
						variant="ghost"
						size="sm"
						className={isReordering ? '' : 'invisible group-focus-within/pinned:visible group-hover/pinned:visible'}
						onClick={() => setIsReordering((value) => !value)}
					>
						<StableLabel labels={['Reorder', 'Done']} current={isReordering ? 'Done' : 'Reorder'} />
					</Button>
				) : null}
			</div>
			{isReordering ? (
				<>
					<p className="body-sm text-tertiary">Drag to reorder, click X to unpin</p>
					<React.Suspense fallback={<div className="min-h-[40px]" />}>
						<ReorderablePinnedPages pinnedPages={pinnedPages} />
					</React.Suspense>
				</>
			) : (
				<div className="flex flex-col">
					{pinnedPages.map((page) => (
						<span
							key={`pinned-page-${page.name}-${page.route}`}
							className="group relative flex w-full items-start gap-1"
						>
							<LinkToPage
								route={page.route}
								name={page.name}
								icon={page.icon}
								attention={page.attention}
								asPath={asPath}
							/>
							<Tooltip
								content="Unpin from navigation"
								render={
									<Button
										variant="ghost"
										size="sm"
										square
										aria-label={`Unpin ${page.name}`}
										data-menu-name="Unpin from navigation"
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
											// The neighbour's × shows only on hover or focus, so focus cannot land on it:
											// its link takes focus.
											const row = e.currentTarget.parentElement!
											const next = neighbourRowControl(row, row)?.querySelector('a')
											keepFocus(
												() => mutatePinnedMetrics((routes) => routes.filter((route) => route !== page.route)),
												() => next
											)
										}}
									/>
								}
								// On the active row (solid brand fill) the x takes the row's on-brand text and ring.
								className="absolute top-1/2 right-1 -translate-y-1/2 not-group-focus-within:not-group-hover:hidden group-has-[[aria-current=page]]:focus-visible:focus-ring-on-brand"
							>
								<Icon name="x" className="size-4 group-has-[[aria-current=page]]:text-on-brand" />
							</Tooltip>
						</span>
					))}
				</div>
			)}
		</div>
	)
}
