import { BasicLink } from '~/components/Link'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import type { TopAuthorEntry } from '~/containers/Authors/types'
import { useHorizontalOverflow } from '~/hooks/useHorizontalOverflow'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { formatCompactNumber } from '~/utils/numberFormat'
import { useTopAuthors } from '../hooks/useTopAuthors'
import { ProMeta } from '../ui'
import { DiscoveryShelfHeading } from './DiscoverySection'

const RAIL_TITLE = 'Top Authors'
const RAIL_SUBTITLE = 'The most viewed dashboard builders on DefiLlama Pro'

function compact(value: number): string {
	return formatCompactNumber(value, { maximumFractionDigits: 1 })
}

function AuthorCard({ entry }: { entry: TopAuthorEntry }) {
	const { author } = entry
	return (
		<Card
			as={BasicLink}
			href={`/authors/${author.slug}`}
			padding="md"
			className="hover-wash-card flex h-full flex-col gap-2"
		>
			<div className="flex items-center gap-2">
				{author.avatarUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={author.avatarUrl} alt="" loading="lazy" className="size-8 shrink-0 rounded-full object-cover" />
				) : (
					<span
						className="flex size-8 shrink-0 items-center justify-center rounded-full body-lg"
						style={avatarColorStyle(author.slug)}
					>
						🦙
					</span>
				)}
				<div className="min-w-0">
					<p className="truncate title-md text-primary">{author.displayName}</p>
					<p className="truncate body-sm text-tertiary">@{author.slug}</p>
				</div>
			</div>
			{author.bio ? <p className="line-clamp-2 body-sm text-secondary">{author.bio}</p> : null}
			<ProMeta
				className="mt-auto tabular-nums"
				items={[
					`${compact(entry.dashboardCount)} dashboards`,
					`${compact(entry.totalViews)} views`,
					`${compact(entry.totalLikes)} stars`
				]}
			/>
		</Card>
	)
}

export function TopAuthorsRail() {
	const { authors, isLoading } = useTopAuthors()
	const { ref: scrollContainerRef, canScrollLeft, canScrollRight, scrollByPage } = useHorizontalOverflow()

	if (isLoading) {
		return (
			<div className="flex flex-col gap-3">
				<DiscoveryShelfHeading title={RAIL_TITLE} subtitle={RAIL_SUBTITLE} />
				<div className="flex gap-3 overflow-hidden">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card
							padding="none"
							// oxlint-disable-next-line react/no-array-index-key -- Loading placeholders are fixed display slots, not data items.
							key={`skeleton-top-authors-${i}`}
							className="relative isolate min-h-[150px] w-[260px] shrink-0 overflow-hidden"
						>
							<div className="pointer-events-none absolute inset-y-0 -right-1/2 -left-1/2 animate-shimmer bg-linear-[99.97deg] from-transparent via-hover-row to-transparent" />
						</Card>
					))}
				</div>
			</div>
		)
	}

	if (authors.length === 0) {
		return (
			<div className="flex flex-col gap-3">
				<DiscoveryShelfHeading title={RAIL_TITLE} subtitle={RAIL_SUBTITLE} />
				<EmptyState size="md" title="No authors to show yet" framed />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3">
			<DiscoveryShelfHeading title={RAIL_TITLE} subtitle={RAIL_SUBTITLE} />

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
									aria-label="Scroll Top Authors left"
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
					{authors.map((entry) => (
						<div key={entry.author.slug} className="w-[260px] shrink-0 snap-start scroll-ml-4 md:snap-align-none">
							<AuthorCard entry={entry} />
						</div>
					))}
				</div>

				{(canScrollLeft || canScrollRight) && authors.length > 4 ? (
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
									aria-label="Scroll Top Authors right"
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
