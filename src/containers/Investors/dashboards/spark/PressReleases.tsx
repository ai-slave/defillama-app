import { useQuery } from '@tanstack/react-query'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { Card } from '~/ui/Card'
import { RelativeTime } from '~/ui/RelativeTime'
import { PanelStatus, PanelLoadingStatus } from '~/ui/Status'
import { queryReadFailed } from '~/utils/query'
import { readInvestorApiJson, type ApiUnixMillisecondsString } from '../../api.types'

export interface ParagraphPost {
	id: string
	title: string
	subtitle?: string
	slug: string
	// Paragraph returns Unix milliseconds as a decimal string.
	publishedAt: ApiUnixMillisecondsString
	imageUrl?: string
	categories?: Array<string>
}

function isFinancialReport(post: ParagraphPost): boolean {
	// Regex patterns for financial reports
	const quarterlyPattern = /\bq[1-4]\b.*\b(financial|report|results?|earnings?)\b/i
	const annualPattern = /\b(annual|yearly|year\s+in|20\d{2})\b.*\b(financial|report|results?|earnings?)\b/i
	const financialReportPattern = /\b(financial|quarterly|annual|earnings?)\s+(report|results?|statement|update)\b/i

	// Check title and slug with regex
	const titleMatch =
		quarterlyPattern.test(post.title) || annualPattern.test(post.title) || financialReportPattern.test(post.title)

	const slugMatch =
		quarterlyPattern.test(post.slug) || annualPattern.test(post.slug) || financialReportPattern.test(post.slug)

	// Check categories
	const categoryMatch = post.categories?.some((cat) =>
		['financials', 'revenue', 'report', 'financial', 'earnings'].includes(cat.toLowerCase())
	)

	return titleMatch || slugMatch || categoryMatch
}

/** Drops repeated posts, then lists every financial report and only the press releases from the last three months. */
export function splitSparkPosts(posts: Array<ParagraphPost>, now: Date) {
	const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime()
	const seen = new Set<string>()
	const financialReports: Array<ParagraphPost> = []
	const pressReleases: Array<ParagraphPost> = []
	for (const post of posts) {
		const key = (post.slug || post.title).trim().toLowerCase()
		if (seen.has(key)) continue
		seen.add(key)
		if (isFinancialReport(post)) financialReports.push(post)
		else if (parseInt(post.publishedAt, 10) >= threeMonthsAgo) pressReleases.push(post)
	}
	return { financialReports, pressReleases }
}

function renderPressReleaseCards(posts: Array<ParagraphPost>) {
	return posts.map((post) => (
		<Card
			as="a"
			padding="none"
			key={post.id}
			href={`https://paragraph.com/@spark-11/${post.slug}`}
			target="_blank"
			rel="noopener noreferrer"
			className="hover-wash-card group flex flex-col overflow-hidden"
		>
			{/* Image */}
			{post.imageUrl && (
				<div className="relative aspect-[2/1] w-full overflow-hidden bg-linear-to-br from-(--bg-brand-tint) to-surface-elevated-2">
					<img src={post.imageUrl} alt={post.title} className="size-full object-cover" loading="lazy" />
					<div className="absolute inset-0 bg-linear-to-t from-(--bg-screen-dim) to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-50" />
				</div>
			)}

			{/* Content */}
			<div className="flex flex-1 flex-col gap-3 p-5">
				{/* Meta */}
				<div className="flex flex-wrap items-center gap-2">
					<time className="label-sm text-secondary">
						<RelativeTime value={Number(post.publishedAt)} input="milliseconds" />
					</time>
					{post.categories && post.categories.length > 0 && (
						<>
							<span className="body-sm text-secondary">•</span>
							<span className="rounded-md bg-brand-tint px-2 py-0.5 title-sm tracking-wide text-link uppercase">
								{post.categories[0]}
							</span>
						</>
					)}
				</div>

				{/* Title */}
				<h3 className="line-clamp-2 heading-xs text-primary group-hover:text-link">{post.title}</h3>

				{/* Subtitle */}
				{post.subtitle && <p className="line-clamp-3 flex-1 body-md text-secondary">{post.subtitle}</p>}

				{/* Read More */}
				<div className="flex items-center gap-2 pt-2 label-md text-link">
					<span>Read more</span>
					<svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</div>
			</div>
		</Card>
	))
}

export default function PressReleases() {
	const query = useQuery({
		queryKey: ['spark-reports'],
		queryFn: async () => {
			const response = await fetch('/api/public/spark/reports')
			if (!response.ok) throw new Error(`Spark reports API error: ${response.status}`)
			const apiData = await readInvestorApiJson<{ items?: Array<ParagraphPost> }>(response)
			return splitSparkPosts(apiData.items || [], new Date())
		},
		staleTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false
	})

	// A failed refresh of data already shown keeps it; the error and its Try again replace the tab only before data loads.
	if (queryReadFailed(query) && !query.data)
		return (
			<PanelStatus variant="error" retry={query}>
				Couldn't load Spark reports and press releases.
			</PanelStatus>
		)
	if (!query.data) return <PanelLoadingStatus />

	const { financialReports, pressReleases } = query.data
	if (financialReports.length === 0 && pressReleases.length === 0) {
		return <PanelStatus variant="empty">No reports or press releases available</PanelStatus>
	}

	return (
		<div className="space-y-8 py-6">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="heading-lg text-primary">Reports & Press Releases</h1>
				<p className="body-md text-secondary">Latest news, announcements, and updates from Spark Protocol</p>
			</div>

			{/* Financial Reports Section */}
			{financialReports.length > 0 && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-lg bg-brand-tint">
							<svg className="size-5 text-link" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<h2 className="heading-xs text-primary">Financial Reports</h2>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{financialReports.map((post) => (
							<Card
								as="a"
								tone="brand"
								padding="none"
								key={post.id}
								href={`https://paragraph.com/@spark-11/${post.slug}`}
								target="_blank"
								rel="noopener noreferrer"
								className="hover-wash-card group flex flex-col overflow-hidden"
							>
								{/* Image */}
								{post.imageUrl && (
									<div className="relative aspect-[2/1] w-full overflow-hidden">
										<img src={post.imageUrl} alt={post.title} className="size-full object-cover" loading="lazy" />
										<div className="absolute inset-0 bg-linear-to-t from-(--bg-screen-dim) to-transparent" />
									</div>
								)}

								{/* Content */}
								<div className="flex flex-1 flex-col gap-2 p-4">
									<time className="label-sm text-secondary">
										<RelativeTime value={Number(post.publishedAt)} input="milliseconds" />
									</time>
									<h3 className="line-clamp-2 title-lg text-primary group-hover:text-link">{post.title}</h3>
									{post.subtitle && <p className="line-clamp-2 body-md text-secondary">{post.subtitle}</p>}

									{/* Read More */}
									<div className="flex items-center gap-2 pt-2 label-md text-link">
										<span>View report</span>
										<svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</div>
							</Card>
						))}
					</div>
				</div>
			)}

			{/* Press Releases Section */}
			{pressReleases.length > 0 && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-lg bg-surface-elevated-2">
							<svg className="size-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
								/>
							</svg>
						</div>
						<h2 className="heading-xs text-primary">Press Releases</h2>
					</div>
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
						{renderPressReleaseCards(pressReleases)}
					</div>
				</div>
			)}

			{/* Footer */}
			<div className="flex items-center justify-center pt-4">
				<ExternalLinkButton href="https://paragraph.com/@spark-11">View all on Paragraph</ExternalLinkButton>
			</div>
		</div>
	)
}
