import { BasicLink } from '~/components/Link'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { EmptyState } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import type { Dashboard } from '../dashboardTypes'
import { DashboardCard } from './DashboardCard'

interface DiscoverySectionProps {
	title: string
	subtitle?: string
	dashboards: Array<Dashboard>
	isLoading: boolean
	seeAllHref: string
	emptyMessage: string
	onTagClick: (tag: string) => void
}

export function DiscoveryShelfHeading({
	title,
	subtitle,
	seeAllHref
}: {
	title: string
	subtitle?: string | undefined
	seeAllHref?: string | undefined
}) {
	return (
		<div className="flex items-end justify-between gap-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<h3 className="title-lg text-primary">{title}</h3>
				{subtitle ? <p className="body-sm text-tertiary">{subtitle}</p> : null}
			</div>
			{seeAllHref ? (
				<Button as={BasicLink} href={seeAllHref} variant="link" className="shrink-0 label-md">
					See all
					<Icon name="arrow-right" className="size-3.5" />
				</Button>
			) : null}
		</div>
	)
}

export function DiscoverySection({
	title,
	subtitle,
	dashboards,
	isLoading,
	seeAllHref,
	emptyMessage,
	onTagClick
}: DiscoverySectionProps) {
	const { ref: scrollContainerRef, canScrollLeft, canScrollRight, scrollByPage } = useHorizontalOverflow()

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3">
				<DiscoveryShelfHeading title={title} subtitle={subtitle} />
				<div className="flex gap-3 overflow-hidden">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton
							// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
							key={`skeleton-${title}-${i}`}
							className="min-h-[220px] w-[300px] shrink-0 rounded-lg md:w-[320px]"
						/>
					))}
				</div>
			</div>
		)
	}

	if (dashboards.length === 0) {
		return (
			<div className="flex flex-col gap-3">
				<DiscoveryShelfHeading title={title} subtitle={subtitle} />
				<EmptyState size="md" title={emptyMessage} framed />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3">
			<DiscoveryShelfHeading title={title} subtitle={subtitle} seeAllHref={seeAllHref} />

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
									aria-label={`Scroll ${title} left`}
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
					{dashboards.map((dashboard) => (
						<div
							key={dashboard.id}
							className="w-[300px] shrink-0 snap-start scroll-ml-4 md:w-[320px] md:snap-align-none"
						>
							<DashboardCard dashboard={dashboard} onTagClick={onTagClick} viewMode="grid" className="h-full" />
						</div>
					))}
				</div>

				{(canScrollLeft || canScrollRight) && dashboards.length > 3 ? (
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
									aria-label={`Scroll ${title} right`}
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
		</div>
	)
}
