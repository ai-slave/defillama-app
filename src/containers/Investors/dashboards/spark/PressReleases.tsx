import { useEffect, useState } from 'react'
import { useContentReady } from '~/containers/Investors/ContentReadyContext'
import { RelativeTime } from '~/ui/RelativeTime'
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

function isWithinLastThreeMonths(timestamp: string): boolean {
	const date = new Date(parseInt(timestamp, 10))
	const now = new Date()
	const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
	return date >= threeMonthsAgo
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

function dedupePosts(posts: Array<ParagraphPost>): Array<ParagraphPost> {
	const seen = new Set<string>()

	return posts.filter((post) => {
		const key = (post.slug || post.title).trim().toLowerCase()
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

function renderPressReleaseCards(posts: Array<ParagraphPost>) {
	return posts.map((post) => (
		<a
			key={post.id}
			href={`https://paragraph.com/@spark-11/${post.slug}`}
			target="_blank"
			rel="noopener noreferrer"
			className="group flex flex-col overflow-hidden rounded-xl border border-pro-cards-border bg-pro-cards-bg transition-all duration-200 hover:border-sl-accent hover:shadow-xl"
		>
			{/* Image */}
			{post.imageUrl && (
				<div className="relative aspect-[2/1] w-full overflow-hidden bg-linear-to-br from-sl-accent-muted to-pro-cards-border">
					<img src={post.imageUrl} alt={post.title} className="size-full object-cover" loading="lazy" />
					<div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
				</div>
			)}

			{/* Content */}
			<div className="flex flex-1 flex-col gap-3 p-5">
				{/* Meta */}
				<div className="flex flex-wrap items-center gap-2">
					<time className="text-xs font-medium text-pro-text-label">
						<RelativeTime value={Number(post.publishedAt)} input="milliseconds" />
					</time>
					{post.categories && post.categories.length > 0 && (
						<>
							<span className="text-xs text-pro-text-label">•</span>
							<span className="rounded-md bg-sl-accent-muted px-2 py-0.5 text-xs font-semibold tracking-wide text-sl-accent uppercase">
								{post.categories[0]}
							</span>
						</>
					)}
				</div>

				{/* Title */}
				<h3 className="line-clamp-2 text-lg leading-snug font-bold text-pro-text-primary transition-colors group-hover:text-sl-accent">
					{post.title}
				</h3>

				{/* Subtitle */}
				{post.subtitle && (
					<p className="line-clamp-3 flex-1 text-sm leading-relaxed text-pro-text-secondary">{post.subtitle}</p>
				)}

				{/* Read More */}
				<div className="flex items-center gap-2 pt-2 text-sm font-medium text-link transition-all group-hover:gap-3">
					<span>Read more</span>
					<svg
						className="size-4 transition-transform group-hover:translate-x-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
				</div>
			</div>
		</a>
	))
}

export default function PressReleases() {
	const contentReady = useContentReady()
	const [pressReleases, setPressReleases] = useState<Array<ParagraphPost>>([])
	const [financialReports, setFinancialReports] = useState<Array<ParagraphPost>>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetch('/api/public/spark/reports')
			.then((response) => {
				if (!response.ok) throw new Error(`Spark reports API error: ${response.status}`)
				return readInvestorApiJson<{ items?: Array<ParagraphPost> }>(response)
			})
			.then((apiData) => {
				const posts = dedupePosts(apiData.items || [])

				// Separate financial reports from regular press releases
				const reports: Array<ParagraphPost> = []
				const releases: Array<ParagraphPost> = []

				for (const post of posts) {
					if (isFinancialReport(post)) {
						reports.push(post)
					} else if (isWithinLastThreeMonths(post.publishedAt)) {
						// Only include press releases from the last 3 months
						releases.push(post)
					}
				}

				setFinancialReports(reports)
				setPressReleases(releases)
				setLoading(false)
				contentReady()
			})
			.catch((error) => {
				console.error('Failed to fetch press releases:', error)
				setLoading(false)
				contentReady()
			})
	}, [contentReady])

	if (loading) {
		return (
			<div className="flex h-96 items-center justify-center">
				<div className="flex flex-col items-center gap-3">
					<div className="size-8 animate-spin rounded-full border-2 border-pro-text-label border-t-transparent" />
					<p className="text-sm text-pro-text-secondary">Loading reports and press releases...</p>
				</div>
			</div>
		)
	}

	if (financialReports.length === 0 && pressReleases.length === 0) {
		return (
			<div className="flex h-96 items-center justify-center rounded-xl border border-pro-cards-border bg-pro-cards-bg">
				<div className="flex flex-col items-center gap-2">
					<svg className="size-12 text-pro-text-label" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
						/>
					</svg>
					<p className="text-sm text-pro-text-secondary">No reports or press releases available</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-8 py-6">
			{/* Header */}
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold text-pro-text-primary">Reports & Press Releases</h1>
				<p className="text-sm text-pro-text-secondary">Latest news, announcements, and updates from Spark Protocol</p>
			</div>

			{/* Financial Reports Section */}
			{financialReports.length > 0 && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-lg bg-sl-accent-muted">
							<svg className="size-5 text-sl-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<h2 className="text-lg font-bold text-pro-text-primary">Financial Reports</h2>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
						{financialReports.map((post) => (
							<a
								key={post.id}
								href={`https://paragraph.com/@spark-11/${post.slug}`}
								target="_blank"
								rel="noopener noreferrer"
								className="group flex flex-col overflow-hidden rounded-xl border-2 border-sl-accent-muted bg-linear-to-br from-sl-accent-muted/10 to-transparent transition-all duration-200 hover:border-sl-accent/50 hover:shadow-xl"
							>
								{/* Image */}
								{post.imageUrl && (
									<div className="relative aspect-[2/1] w-full overflow-hidden">
										<img src={post.imageUrl} alt={post.title} className="size-full object-cover" loading="lazy" />
										<div className="absolute inset-0 bg-linear-to-t from-black/40 via-black/10 to-transparent" />
									</div>
								)}

								{/* Content */}
								<div className="flex flex-1 flex-col gap-2 p-4">
									<time className="text-xs font-medium text-pro-text-label">
										<RelativeTime value={Number(post.publishedAt)} input="milliseconds" />
									</time>
									<h3 className="line-clamp-2 text-base leading-snug font-bold text-pro-text-primary transition-colors group-hover:text-sl-accent">
										{post.title}
									</h3>
									{post.subtitle && <p className="line-clamp-2 text-sm text-pro-text-secondary">{post.subtitle}</p>}

									{/* Read More */}
									<div className="flex items-center gap-2 pt-2 text-sm font-medium text-link transition-all group-hover:gap-3">
										<span>View report</span>
										<svg
											className="size-4 transition-transform group-hover:translate-x-1"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</div>
								</div>
							</a>
						))}
					</div>
				</div>
			)}

			{/* Press Releases Section */}
			{pressReleases.length > 0 && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-lg bg-pro-cards-border">
							<svg className="size-5 text-pro-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
								/>
							</svg>
						</div>
						<h2 className="text-lg font-bold text-pro-text-primary">Press Releases</h2>
					</div>
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
						{renderPressReleaseCards(pressReleases)}
					</div>
				</div>
			)}

			{/* Footer */}
			<div className="flex items-center justify-center pt-4">
				<a
					href="https://paragraph.com/@spark-11"
					target="_blank"
					rel="noopener noreferrer"
					className="group flex items-center gap-2 rounded-lg border border-pro-cards-border bg-pro-cards-bg px-4 py-2.5 text-sm font-medium text-pro-text-primary transition-all hover:border-sl-accent hover:bg-sl-hover-bg"
				>
					<span>View all on Paragraph</span>
					<svg
						className="size-4 transition-transform group-hover:translate-x-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
				</a>
			</div>
		</div>
	)
}
