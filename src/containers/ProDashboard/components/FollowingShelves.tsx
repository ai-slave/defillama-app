import type { ReactNode } from 'react'
import { BasicLink } from '~/components/Link'
import { TablePager } from '~/components/Table/TablePager'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { FollowAuthorButton } from '~/containers/Authors/FollowAuthorButton'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { EmptyState, PanelStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { DashedTile } from '~/ui/UploadTile'
import { useFollowingAuthors } from '../hooks/useFollowingAuthors'
import type { FollowingShelf } from '../services/DashboardAPI'
import { DashboardCard } from './DashboardCard'
import { LoadingSkeleton } from './LoadingSkeleton'

function ShelfRail({ children, itemCount }: { children: ReactNode; itemCount: number }) {
	const { ref: scrollContainerRef, canScrollLeft, canScrollRight, scrollByPage } = useHorizontalOverflow()

	return (
		<div className="group/rail relative">
			{canScrollLeft || canScrollRight ? (
				<>
					{canScrollLeft ? (
						<div className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden w-12 bg-linear-to-r from-page to-transparent md:block" />
					) : null}
					<Tooltip
						content="Scroll left"
						render={
							<Button
								size="md"
								type="button"
								square
								variant="overlay"
								aria-label="Scroll dashboards left"
								disabled={!canScrollLeft}
								accessibleWhenDisabled
								onClick={() => scrollByPage('left')}
								className="absolute top-1/2 left-2 z-10 hidden -translate-y-1/2 md:flex"
							/>
						}
					>
						<Icon name="chevron-left" className="size-4" />
					</Tooltip>
				</>
			) : null}

			<div
				ref={scrollContainerRef}
				className="-mt-1 flex scrollbar-none snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pt-1 pb-2 md:snap-none"
			>
				{children}
			</div>

			{(canScrollLeft || canScrollRight) && itemCount > 3 ? (
				<>
					{canScrollRight ? (
						<div className="pointer-events-none absolute inset-y-0 right-0 z-5 hidden w-12 bg-linear-to-l from-page to-transparent md:block" />
					) : null}
					<Tooltip
						content="Scroll right"
						render={
							<Button
								size="md"
								type="button"
								square
								variant="overlay"
								aria-label="Scroll dashboards right"
								disabled={!canScrollRight}
								accessibleWhenDisabled
								onClick={() => scrollByPage('right')}
								className="absolute top-1/2 right-2 z-10 hidden -translate-y-1/2 md:flex"
							/>
						}
					>
						<Icon name="chevron-right" className="size-4" />
					</Tooltip>
				</>
			) : null}
		</div>
	)
}

function AuthorShelf({ shelf }: { shelf: FollowingShelf }) {
	const { author } = shelf
	const hasMore = shelf.dashboardCount > shelf.dashboards.length

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<BasicLink href={`/authors/${author.slug}`} className="shrink-0">
					{author.avatarUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={author.avatarUrl} alt="" loading="lazy" className="size-10 rounded-full object-cover" />
					) : (
						<span
							className="flex size-10 items-center justify-center rounded-full body-xl"
							style={avatarColorStyle(author.slug)}
						>
							🦙
						</span>
					)}
				</BasicLink>
				<div className="min-w-0 flex-1">
					<BasicLink href={`/authors/${author.slug}`} className="block truncate title-lg text-primary hover:text-link">
						{author.displayName}
					</BasicLink>
					<p className="truncate body-sm text-tertiary">
						{shelf.dashboardCount} {shelf.dashboardCount === 1 ? 'dashboard' : 'dashboards'}
					</p>
				</div>
				<FollowAuthorButton slug={author.slug} following isOwnProfile={false} />
			</div>

			{shelf.dashboards.length === 0 ? (
				<EmptyState size="md" title="No public dashboards yet" framed />
			) : (
				<ShelfRail itemCount={shelf.dashboards.length + (hasMore ? 1 : 0)}>
					{shelf.dashboards.map((dashboard) => (
						<div
							key={dashboard.id}
							className="w-[300px] shrink-0 snap-start scroll-ml-4 md:w-[320px] md:snap-align-none"
						>
							<DashboardCard dashboard={dashboard} viewMode="grid" className="h-full" />
						</div>
					))}
					{hasMore ? (
						<DashedTile
							as={BasicLink}
							href={`/authors/${author.slug}`}
							className="w-[160px] shrink-0 snap-start md:snap-align-none"
						>
							View all {shelf.dashboardCount}
							<Icon name="chevron-right" className="size-3.5" />
						</DashedTile>
					) : null}
				</ShelfRail>
			)}
		</section>
	)
}

export function FollowingShelves() {
	const { shelves, isLoading, isFetching, readFailed, page, totalPages, refetch, goToPage } = useFollowingAuthors()

	if (readFailed) {
		return (
			<PanelStatus variant="error" retry={{ refetch, isFetching }}>
				Couldn&apos;t load the authors you follow.
			</PanelStatus>
		)
	}

	if (isLoading) {
		return <LoadingSkeleton viewMode="grid" items={8} />
	}

	// Unfollowing the last author on a later page lands here, not on the page before, and the pager goes with the list.
	// Accepted: it takes emptying a whole later page, and stepping back would mean holding the page count through a refetch.
	if (shelves.length === 0) {
		return (
			<EmptyState
				size="lg"
				icon="users"
				title="You're not following anyone yet"
				headingAs="h2"
				framed
				actions={
					<Button as={BasicLink} href="/pro?tab=discover" size="md" variant="secondary">
						Browse dashboards
					</Button>
				}
			>
				Follow authors and their public dashboards will show up here.
			</EmptyState>
		)
	}

	return (
		<div className="flex flex-col gap-8">
			{shelves.map((shelf) => (
				<AuthorShelf key={shelf.author.slug} shelf={shelf} />
			))}

			<TablePager
				pageIndex={page - 1}
				pageCount={totalPages}
				onPageChange={(pageIndex) => goToPage(pageIndex + 1)}
				className="justify-center"
			/>
		</div>
	)
}
