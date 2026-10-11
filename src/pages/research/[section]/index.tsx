import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Link from 'next/link'
import { BasicLink } from '~/components/Link'
import { getSectionBanner, listArticles } from '~/containers/Articles/api'
import type { ArticleListResponse } from '~/containers/Articles/api'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { useResearchSectionEngagement } from '~/containers/Articles/landing/Analytics'
import { GenericCard } from '~/containers/Articles/landing/GenericCard'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import { articleHref, formatDate, readingMinutes } from '~/containers/Articles/landing/utils'
import { ArticleBannerStrip } from '~/containers/Articles/renderer/ArticleBannerStrip'
import type { ArticleDocument, ArticleSection, BannerLookupResult } from '~/containers/Articles/types'
import { ARTICLE_SECTION_FROM_SLUG, ARTICLE_SECTION_LABELS, ARTICLE_SECTION_SLUGS } from '~/containers/Articles/types'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { EmptyState, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const SECTION_LANDING_CACHE_CONTROL = 'public, s-maxage=60'

type SectionRouteParams = {
	section: string
}

type SectionLandingPageProps = {
	section: ArticleSection
	initialArticles: ArticleListResponse
	sectionBanner: BannerLookupResult | null
}

async function loadSectionLandingData(section: ArticleSection): Promise<SectionLandingPageProps> {
	const [articlesResult, bannerResult] = await Promise.allSettled([
		listArticles({ section, sort: 'newest', limit: 60 }),
		getSectionBanner(section)
	])

	if (articlesResult.status === 'rejected') {
		throw articlesResult.reason
	}

	return {
		section,
		initialArticles: articlesResult.value,
		sectionBanner: bannerResult.status === 'fulfilled' ? bannerResult.value : null
	}
}

const getServerSidePropsHandler: GetServerSideProps<SectionLandingPageProps, SectionRouteParams> = async ({
	params,
	res
}) => {
	res.setHeader('Cache-Control', SECTION_LANDING_CACHE_CONTROL)

	const sectionSlug = params?.section
	if (!sectionSlug) {
		return { notFound: true }
	}

	const section = ARTICLE_SECTION_FROM_SLUG[sectionSlug]
	if (!section) {
		return { notFound: true }
	}

	return { props: await loadSectionLandingData(section) }
}

export const getServerSideProps = withServerSidePropsTelemetry('/research/[section]', getServerSidePropsHandler)

function intervieweeLabel(article: ArticleDocument): string | null {
	const list = (article.interviewees ?? []).filter((p) => p?.name?.trim()).map((p) => p.name)
	if (list.length === 0) return null
	if (list.length === 1) return list[0]
	if (list.length === 2) return `${list[0]} & ${list[1]}`
	return `${list[0]}, ${list[1]} +${list.length - 2}`
}

function InterviewCard({ article }: { article: ArticleDocument }) {
	const cover = article.coverImage?.url || null
	const interviewee = intervieweeLabel(article)
	const firstInterviewee = (article.interviewees ?? []).find((p) => p?.name?.trim())
	return (
		<Card as={Link} padding="md" href={articleHref(article)} className="group hover-wash-card grid content-start gap-3">
			<div className="flex items-center justify-between gap-3 label-xs tracking-[0.18em] text-tertiary uppercase">
				<span>Interview</span>
				<span className="tabular-nums">{readingMinutes(article)} min</span>
			</div>
			{cover ? (
				<div className="aspect-[16/9] w-full overflow-hidden">
					<img src={cover} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
				</div>
			) : null}
			{interviewee ? (
				<div className="flex items-center gap-2">
					{firstInterviewee?.avatarUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={firstInterviewee.avatarUrl}
							alt=""
							className="size-9 shrink-0 rounded-full border border-medium object-cover"
						/>
					) : null}
					<div className="grid">
						<span className="title-md text-primary">{interviewee}</span>
						{firstInterviewee?.role ? <span className="body-sm text-tertiary">{firstInterviewee.role}</span> : null}
					</div>
				</div>
			) : null}
			<h3 className="title-lg tracking-tight text-primary group-hover:text-link">{article.title}</h3>
			{article.excerpt || article.subtitle ? (
				<p className="line-clamp-3 body-md text-secondary">{article.excerpt || article.subtitle}</p>
			) : null}
			<span className="label-xs tracking-[0.18em] text-tertiary uppercase tabular-nums">
				{formatDate(article.displayDate ?? article.publishedAt)}
			</span>
		</Card>
	)
}

function SectionLandingContent({
	section,
	initialData
}: {
	section: ArticleSection
	initialData: Pick<SectionLandingPageProps, 'initialArticles' | 'sectionBanner'>
}) {
	const articlesQuery = useQuery({
		queryKey: ['research', 'section-index', section],
		queryFn: () => listArticles({ section, sort: 'newest', limit: 60 }),
		initialData: initialData.initialArticles,
		retry: false,
		staleTime: 60_000
	})

	if (queryReadFailed(articlesQuery)) {
		const { error } = articlesQuery
		return (
			<PanelStatus variant="error" retry={articlesQuery} className="mx-auto w-full max-w-[1180px]">
				{httpErrorMessage(error, "Couldn't load this section.")}
			</PanelStatus>
		)
	}

	if (articlesQuery.isLoading) {
		return <PanelLoadingStatus label="Loading research" className="mx-auto w-full max-w-[1180px]" />
	}

	const { data } = articlesQuery
	const items = data?.items ?? []
	const total = data?.totalItems ?? items.length
	const sectionLabel = ARTICLE_SECTION_LABELS[section]
	const isInterview = section === 'interview'

	return (
		<>
			<ArticleBannerStrip scope="section" section={section} initialData={{ section: initialData.sectionBanner }} />
			<div className="mx-auto grid w-full max-w-[1180px] gap-8 px-4 pt-8 pb-10 sm:px-6">
				<header className="grid gap-3 border-b border-medium pb-6">
					<div className="flex items-center justify-between gap-3">
						<Link href="/research" className="label-xs tracking-[0.18em] text-tertiary uppercase hover:text-link">
							← All research
						</Link>
						<span className="label-xs tracking-[0.18em] text-tertiary uppercase tabular-nums">
							{total} {total === 1 ? 'story' : 'stories'}
						</span>
					</div>
					<h1 className="heading-lg tracking-tight text-primary">{sectionLabel}</h1>
					{isInterview ? (
						<p className="max-w-2xl body-md text-secondary">
							Conversations with the people building, funding, and using DeFi.
						</p>
					) : null}
				</header>

				{items.length === 0 ? (
					<EmptyState
						size="lg"
						title="Nothing here yet"
						actions={
							<Button as={BasicLink} href="/research" size="md">
								Browse all research
							</Button>
						}
						framed
					/>
				) : (
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{items.map((article) =>
							isInterview ? (
								<InterviewCard key={article.id} article={article} />
							) : (
								<GenericCard key={article.id} article={article} />
							)
						)}
					</div>
				)}
			</div>
			<ResearchFooter maxWidthClassName="max-w-[1180px]" />
		</>
	)
}

export default function SectionLandingPage({
	section,
	initialArticles,
	sectionBanner
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	useResearchSectionEngagement(section)
	const canonical = `/research/${ARTICLE_SECTION_SLUGS[section]}`

	return (
		<Layout
			title={`${ARTICLE_SECTION_LABELS[section]} — DefiLlama Research`}
			description={
				section === 'interview'
					? 'Interviews with the people building, funding, and using DeFi — by DefiLlama Research.'
					: 'DefiLlama research, grouped by section.'
			}
			canonicalUrl={canonical}
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<SectionLandingContent section={section} initialData={{ initialArticles, sectionBanner }} />
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
