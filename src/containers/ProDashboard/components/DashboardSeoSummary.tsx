import { BasicLink } from '~/components/Link'
import { Card } from '~/ui/Card'
import { StatusBadge } from '~/ui/StatusBadge'
import { TextLink } from '~/ui/TextLink'
import { formatIsoDate } from '~/utils/dateFormat'
import { formatNumber } from '~/utils/numberFormat'
import type { DashboardSeo, DashboardSeoPublicDashboard } from '../utils/seo'

function AuthorAvatar({
	author,
	className = 'size-6'
}: {
	author: NonNullable<DashboardSeoPublicDashboard['author']>
	className?: string
}) {
	if (author.avatarUrl) {
		return (
			// eslint-disable-next-line @next/next/no-img-element
			<img src={author.avatarUrl} alt="" className={`${className} rounded-full object-cover`} />
		)
	}
	return <span className={`${className} flex items-center justify-center rounded-full bg-brand-tint body-md`}>🦙</span>
}

export function DashboardSeoSummary({ dashboard, seo }: { dashboard: DashboardSeoPublicDashboard; seo: DashboardSeo }) {
	const updatedDate = formatIsoDate(seo.updated)
	const visibleSummaries = seo.itemSummaries.slice(0, 12)
	const remainingItems = Math.max(0, seo.itemCount - visibleSummaries.length)
	const metrics = [
		{ label: 'Cards', value: formatNumber(seo.itemCount ?? 0) },
		{
			label: 'Updated',
			value: updatedDate ? <time dateTime={updatedDate}>{updatedDate}</time> : 'Unknown'
		},
		{ label: 'Views', value: formatNumber(dashboard.viewCount ?? 0) },
		{ label: 'Stars', value: formatNumber(dashboard.likeCount ?? 0) }
	]

	return (
		<Card aria-labelledby="dashboard-title" as="section" padding="none" className="isolate overflow-hidden">
			<div className="grid gap-5 px-4 py-4 md:px-5 md:py-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-start">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h1 id="dashboard-title" className="heading-lg text-primary">
							{dashboard.data.dashboardName || 'Untitled Dashboard'}
						</h1>
						<StatusBadge status="good">Public</StatusBadge>
					</div>
					{dashboard.author ? (
						<BasicLink
							href={`/authors/${dashboard.author.slug}`}
							className="mt-3 inline-flex items-center gap-2 body-md text-secondary hover:text-link"
						>
							<AuthorAvatar author={dashboard.author} />
							<span>
								By <span className="font-medium">{dashboard.author.displayName}</span>
							</span>
						</BasicLink>
					) : null}
					<p className="mt-2 max-w-3xl body-md text-secondary">{seo.description}</p>

					{seo.tags.length > 0 ? (
						<ul aria-label="Dashboard tags" className="mt-4 flex flex-wrap gap-1.5">
							{seo.tags.map((tag) => (
								<li
									key={tag}
									className="rounded-md border border-medium bg-surface-elevated-1 px-2 py-1 body-sm text-secondary"
								>
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>

				{/* One dl whose groups are the grid cells. DividedGrid's grid is its own div, so this dl keeps its own dividers
				    per breakpoint. */}
				<dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-subtle bg-surface-elevated-1 body-md sm:grid-cols-4 xl:grid-cols-2">
					{metrics.map((metric, index) => (
						<div
							key={metric.label}
							className={`px-3 py-3 ${index % 2 === 1 ? 'border-l border-subtle' : ''} ${index > 1 ? 'border-t border-subtle' : ''} sm:border-t-0 sm:border-l sm:first:border-l-0 xl:[&:nth-child(3)]:border-l-0 xl:[&:nth-child(n+3)]:border-t`}
						>
							<dt className="label-sm tracking-wide text-secondary uppercase">{metric.label}</dt>
							<dd className="mt-1 title-lg text-primary tabular-nums">{metric.value}</dd>
						</div>
					))}
				</dl>
			</div>

			<div className="border-t border-subtle px-4 py-4 md:px-5">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 className="title-md text-primary">Dashboard contents</h2>
					<p className="body-sm text-secondary">
						{formatNumber(seo.itemCount ?? 0)} {seo.itemCount === 1 ? 'card' : 'cards'}
					</p>
				</div>
				{visibleSummaries.length > 0 ? (
					<ul className="grid gap-x-7 body-md md:grid-cols-2">
						{visibleSummaries.map((item, index) => (
							<li
								key={item.id}
								className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 border-t border-subtle py-2.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0"
							>
								<span className="pt-0.5 label-sm text-secondary tabular-nums">
									{String(index + 1).padStart(2, '0')}
								</span>
								{item.href ? (
									<TextLink href={item.href} size="inherit">
										{item.label}
									</TextLink>
								) : (
									item.label
								)}
							</li>
						))}
						{remainingItems > 0 ? (
							<li className="border-t border-dashed border-subtle py-2.5 text-secondary">
								+{remainingItems} more cards in this dashboard
							</li>
						) : null}
					</ul>
				) : (
					<p className="body-md text-secondary">This public dashboard does not have any cards yet.</p>
				)}
			</div>
		</Card>
	)
}
