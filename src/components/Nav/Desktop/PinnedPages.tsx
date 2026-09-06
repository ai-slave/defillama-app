import * as React from 'react'
import { Icon } from '~/ui/Icon'
import { Tooltip } from '~/ui/Tooltip'
import { mutatePinnedMetrics } from '../pinnedUtils'
import { LinkToPage, navActionStyles } from '../shared'
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
					<button
						type="button"
						className={`inline-flex ${navActionStyles} ${
							isReordering ? '' : 'invisible group-focus-within/pinned:visible group-hover/pinned:visible'
						}`}
						onClick={() => setIsReordering((value) => !value)}
					>
						{isReordering ? 'Done' : 'Reorder'}
					</button>
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
									<button
										type="button"
										onClick={(e) => {
											e.preventDefault()
											e.stopPropagation()
											mutatePinnedMetrics((routes) => routes.filter((route) => route !== page.route))
										}}
									/>
								}
								className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded-md p-1 text-data-down group-focus-within:block group-hover:block hover:bg-hover-row focus-visible:bg-hover-row"
							>
								<Icon name="x" className="size-4" />
							</Tooltip>
						</span>
					))}
				</div>
			)}
		</div>
	)
}
