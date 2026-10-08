import { BasicLink } from '~/components/Link'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
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
				<h3 className="title-lg text-pro-text-primary">{title}</h3>
				{subtitle ? <p className="body-sm text-pro-text-tertiary">{subtitle}</p> : null}
			</div>
			{seeAllHref ? (
				<BasicLink href={seeAllHref} className="flex shrink-0 items-center gap-1 label-md text-link hover:underline">
					See all
					<Icon name="arrow-right" height={14} width={14} />
				</BasicLink>
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
						<div
							// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
							key={`skeleton-${title}-${i}`}
							className="relative isolate min-h-[220px] w-[300px] shrink-0 overflow-hidden rounded-lg border border-pro-cards-border bg-pro-cards-bg md:w-[320px]"
						>
							<div className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-shimmer bg-[linear-gradient(99.97deg,transparent,rgba(0,0,0,0.08),transparent)] dark:bg-[linear-gradient(99.97deg,transparent,rgba(255,255,255,0.08),transparent)]" />
						</div>
					))}
				</div>
			</div>
		)
	}

	if (dashboards.length === 0) {
		return (
			<div className="flex flex-col gap-3">
				<DiscoveryShelfHeading title={title} subtitle={subtitle} />
				<p className="rounded-lg border border-dashed border-pro-cards-border px-4 py-6 text-center body-md text-pro-text-secondary">
					{emptyMessage}
				</p>
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
							<div className="pointer-events-none absolute inset-y-0 left-0 z-5 hidden w-12 bg-linear-to-r from-pro-app-bg to-transparent md:block" />
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
							<Icon name="chevron-left" height={16} width={16} />
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
							<div className="pointer-events-none absolute inset-y-0 right-0 z-5 hidden w-12 bg-linear-to-l from-pro-app-bg to-transparent md:block" />
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
							<Icon name="chevron-right" height={16} width={16} />
						</Tooltip>
					</>
				) : null}
			</div>
		</div>
	)
}
