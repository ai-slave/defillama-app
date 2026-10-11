import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Link from 'next/link'
import { BasicLink } from '~/components/Link'
import { listArticlesByTopic } from '~/containers/Articles/api'
import type { ArticleListResponse } from '~/containers/Articles/api'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { GenericCard } from '~/containers/Articles/landing/GenericCard'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { EmptyState, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import { queryReadFailed } from '~/utils/query'
import { safeDecodeURIComponent } from '~/utils/route'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const TOPIC_LANDING_CACHE_CONTROL = 'public, s-maxage=60'

type TopicRouteParams = {
	topic: string
}

type TopicLandingPageProps = {
	topic: string
	initialArticles: ArticleListResponse
}

const MIN_TOPIC_ARTICLE_COUNT = 4

function normalizeTopicSlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120)
}

function humanizeTopic(topic: string) {
	return topic.replace(/-/g, ' ')
}

const getServerSidePropsHandler: GetServerSideProps<TopicLandingPageProps, TopicRouteParams> = async ({
	params,
	res
}) => {
	res.setHeader('Cache-Control', TOPIC_LANDING_CACHE_CONTROL)

	const topicParam = params?.topic
	if (!topicParam) {
		return { notFound: true }
	}

	const decodedTopicParam = safeDecodeURIComponent(topicParam)
	const topic = normalizeTopicSlug(decodedTopicParam)
	if (!topic) {
		return { notFound: true }
	}

	const canonicalParam = decodedTopicParam.trim()
	if (canonicalParam !== topic && normalizeTopicSlug(canonicalParam) === topic) {
		return {
			redirect: {
				destination: `/research/topics/${encodeURIComponent(topic)}`,
				permanent: true
			}
		}
	}

	const initialArticles = await listArticlesByTopic(topic, { sort: 'newest', limit: 60 })
	if (initialArticles.totalItems < MIN_TOPIC_ARTICLE_COUNT) {
		return { notFound: true }
	}

	return {
		props: {
			topic,
			initialArticles
		}
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('/research/topics/[topic]', getServerSidePropsHandler)

function TopicLandingContent({ topic, initialArticles }: { topic: string; initialArticles: ArticleListResponse }) {
	const topicLabel = humanizeTopic(topic)
	const topicQuery = useQuery({
		queryKey: ['research', 'topic-index', topic],
		queryFn: () => listArticlesByTopic(topic, { sort: 'newest', limit: 60 }),
		initialData: initialArticles,
		retry: false,
		staleTime: 60_000
	})

	// A failed focus refetch keeps the server-rendered grid on screen.
	if (queryReadFailed(topicQuery)) {
		const { error } = topicQuery
		return (
			<PanelStatus variant="error" retry={topicQuery} className="mx-auto w-full max-w-[1180px]">
				{httpErrorMessage(error, "Couldn't load this topic.")}
			</PanelStatus>
		)
	}

	if (topicQuery.isLoading)
		return <PanelLoadingStatus label="Loading topic" className="mx-auto w-full max-w-[1180px]" />

	const { data } = topicQuery
	const items = data?.items ?? []
	const total = data?.totalItems ?? items.length

	if (total < MIN_TOPIC_ARTICLE_COUNT) {
		return (
			<EmptyState
				size="lg"
				headingAs="h1"
				title="Topic not found"
				actions={
					<Button as={BasicLink} href="/research" size="md">
						Browse all research
					</Button>
				}
			/>
		)
	}

	return (
		<>
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
					<h1 className="heading-lg tracking-tight text-primary capitalize">{topicLabel}</h1>
				</header>

				<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((article) => (
						<GenericCard key={article.id} article={article} />
					))}
				</div>
			</div>
			<ResearchFooter maxWidthClassName="max-w-[1180px]" />
		</>
	)
}

export default function TopicLandingPage({
	topic,
	initialArticles
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const canonical = `/research/topics/${topic}`
	const topicLabel = humanizeTopic(topic)

	return (
		<Layout
			title={`${topicLabel} — DefiLlama Research`}
			description={`Research tagged with ${topicLabel}.`}
			canonicalUrl={canonical}
			hideDesktopSearch
		>
			<ArticleProxyAuthProvider>
				<TopicLandingContent topic={topic} initialArticles={initialArticles} />
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
