import { BasicLink } from '~/components/Link'
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
	return (
		<span className={`${className} flex items-center justify-center rounded-full bg-pro-link-button-bg text-sm`}>
			🦙
		</span>
	)
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
		{ label: 'Likes', value: formatNumber(dashboard.likeCount ?? 0) }
	]

	return (
		<section
			aria-labelledby="dashboard-title"
			className="isolate overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg pro-dashboard"
		>
			<div className="grid gap-5 px-4 py-4 md:px-5 md:py-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-start">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<h1
							id="dashboard-title"
							className="text-[clamp(1.375rem,1.1rem+0.7vw,2rem)] leading-tight font-semibold text-pro-text-primary"
						>
							{dashboard.data.dashboardName || 'Untitled Dashboard'}
						</h1>
						<p className="inline-flex items-center gap-1.5 rounded-md border border-pro-success-400/20 bg-pro-success-100 px-2 py-1 text-xs font-medium text-pro-success-400 dark:bg-pro-success-300/12 dark:text-pro-success-200">
							<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
							Public
						</p>
					</div>
					{dashboard.author ? (
						<BasicLink
							href={`/authors/${dashboard.author.slug}`}
							className="mt-3 inline-flex items-center gap-2 text-sm text-pro-text-secondary hover:text-link"
						>
							<AuthorAvatar author={dashboard.author} />
							<span>
								By <span className="font-medium">{dashboard.author.displayName}</span>
							</span>
						</BasicLink>
					) : null}
					<p className="mt-2 max-w-3xl text-sm leading-6 text-pro-text-form">{seo.description}</p>

					{seo.tags.length > 0 ? (
						<ul aria-label="Dashboard tags" className="mt-4 flex flex-wrap gap-1.5">
							{seo.tags.map((tag) => (
								<li
									key={tag}
									className="rounded-md border border-pro-cards-border bg-surface-elevated-1/50 px-2 py-1 text-xs text-pro-text-label"
								>
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>

				<dl className="grid grid-cols-2 overflow-hidden rounded-md border border-pro-cards-border bg-surface-elevated-1/45 text-sm sm:grid-cols-4 xl:grid-cols-2">
					{metrics.map((metric, index) => (
						<div
							key={metric.label}
							className={`px-3 py-3 ${index % 2 === 1 ? 'border-l border-pro-cards-border' : ''} ${index > 1 ? 'border-t border-pro-cards-border' : ''} sm:border-t-0 sm:border-l sm:first:border-l-0 xl:[&:nth-child(3)]:border-l-0 xl:[&:nth-child(n+3)]:border-t`}
						>
							<dt className="text-xs leading-4 font-medium tracking-wide text-pro-text-label uppercase">
								{metric.label}
							</dt>
							<dd className="mt-1 text-base leading-5 font-semibold text-pro-text-primary tabular-nums">
								{metric.value}
							</dd>
						</div>
					))}
				</dl>
			</div>

			<div className="border-t border-pro-cards-border px-4 py-4 md:px-5">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-sm font-semibold text-pro-text-primary">Dashboard contents</h2>
					<p className="text-xs text-pro-text-label">
						{formatNumber(seo.itemCount ?? 0)} {seo.itemCount === 1 ? 'card' : 'cards'}
					</p>
				</div>
				{visibleSummaries.length > 0 ? (
					<ul className="grid gap-x-7 text-sm md:grid-cols-2">
						{visibleSummaries.map((item, index) => (
							<li
								key={item.id}
								className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 border-t border-pro-cards-border py-2.5 first:border-t-0 md:[&:nth-child(2)]:border-t-0"
							>
								<span className="pt-0.5 text-xs font-medium text-pro-text-label tabular-nums">
									{String(index + 1).padStart(2, '0')}
								</span>
								{item.href ? (
									<BasicLink href={item.href} className="text-link hover:underline">
										{item.label}
									</BasicLink>
								) : (
									item.label
								)}
							</li>
						))}
						{remainingItems > 0 ? (
							<li className="border-t border-dashed border-pro-cards-border py-2.5 text-pro-text-label">
								+{remainingItems} more cards in this dashboard
							</li>
						) : null}
					</ul>
				) : (
					<p className="text-sm text-pro-text-label">This public dashboard does not have any cards yet.</p>
				)}
			</div>
		</section>
	)
}
