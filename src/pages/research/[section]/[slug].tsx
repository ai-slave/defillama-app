import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Router, { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import { ResearchSearchDialog } from '~/components/ResearchSearchDialog'
import {
	ArticleApiError,
	getAllArticlesBanner,
	getArticleBanner,
	getArticleBySlug,
	getSectionBanner
} from '~/containers/Articles/api'
import { ArticleProxyAuthProvider } from '~/containers/Articles/ArticleProxyAuthProvider'
import { canEditResearchArticle } from '~/containers/Articles/ArticlesAccessGate'
import { ArticleSeo } from '~/containers/Articles/ArticleSeo'
import { ResearchFooter } from '~/containers/Articles/landing/ResearchFooter'
import {
	ArticleBannerStrip,
	type ArticleBannerStripInitialData
} from '~/containers/Articles/renderer/ArticleBannerStrip'
import { ArticleRenderer } from '~/containers/Articles/renderer/ArticleRenderer'
import { ResearchLoader } from '~/containers/Articles/ResearchLoader'
import type { ArticleAuthor, ArticleDocument, ArticlePublicAuthorProfile } from '~/containers/Articles/types'
import { ARTICLE_SECTION_FROM_SLUG, ARTICLE_SECTION_SLUGS } from '~/containers/Articles/types'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import Layout from '~/layout'
import { Icon } from '~/ui/Icon'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

const ARTICLE_CACHE_CONTROL = 'public, s-maxage=60'
const ARTICLE_NO_STORE = 'no-store'

type ArticleRouteParams = {
	section: string
	slug: string
}

type SectionArticlePageProps = {
	initialArticle: PublicArticleDocument
	initialBanners: ArticleBannerStripInitialData
}

type PublicArticleDocument = Omit<
	ArticleDocument,
	'authorProfile' | 'coAuthors' | 'viewerRole' | 'pending' | 'pendingUpdatedAt' | 'pendingActorPbUserId'
> & {
	authorProfile?: ArticleDocument['authorProfile']
	coAuthors?: ArticleDocument['coAuthors']
	viewerRole?: ArticleDocument['viewerRole']
}

function toPublicAuthorProfile(profile: ArticleAuthor): ArticlePublicAuthorProfile {
	const {
		id: _id,
		pbUserId: _pbUserId,
		...publicProfile
	} = profile as ArticleAuthor & {
		id?: string
		pbUserId?: string
	}
	return publicProfile
}

function sanitizePublicArticle(article: ArticleDocument): PublicArticleDocument {
	const {
		authorProfile,
		coAuthors,
		viewerRole: _viewerRole,
		pending: _pending,
		pendingUpdatedAt: _pendingUpdatedAt,
		pendingActorPbUserId: _pendingActorPbUserId,
		...publicArticle
	} = article
	const publicCoAuthors = (coAuthors ?? []).map(toPublicAuthorProfile)

	if (article.brandByline === true) {
		return {
			...publicArticle,
			author: 'DefiLlama Research',
			...(publicCoAuthors.length > 0 ? { coAuthors: publicCoAuthors } : {})
		}
	}

	return {
		...publicArticle,
		...(authorProfile ? { authorProfile: toPublicAuthorProfile(authorProfile) } : {}),
		...(publicCoAuthors.length > 0 ? { coAuthors: publicCoAuthors } : {})
	}
}

async function loadArticleBannerData(article: ArticleDocument): Promise<ArticleBannerStripInitialData> {
	const [articleBanner, sectionBanner, allArticlesBanner] = await Promise.all([
		getArticleBanner(article.id).catch(() => null),
		article.section ? getSectionBanner(article.section).catch(() => null) : Promise.resolve(null),
		getAllArticlesBanner().catch(() => null)
	])
	return {
		article: articleBanner,
		section: sectionBanner,
		allArticles: allArticlesBanner
	}
}

const getServerSidePropsHandler: GetServerSideProps<SectionArticlePageProps, ArticleRouteParams> = async ({
	params,
	res
}) => {
	const sectionSlug = params?.section
	const slug = params?.slug
	if (!sectionSlug || !slug) {
		res.setHeader('Cache-Control', ARTICLE_NO_STORE)
		return { notFound: true }
	}

	const expectedSection = ARTICLE_SECTION_FROM_SLUG[sectionSlug]
	if (!expectedSection) {
		res.setHeader('Cache-Control', ARTICLE_NO_STORE)
		return { notFound: true }
	}

	const article = await getArticleBySlug(slug)
	if (!article || !article.section) {
		res.setHeader('Cache-Control', ARTICLE_NO_STORE)
		return { notFound: true }
	}

	const canonicalSectionSlug = ARTICLE_SECTION_SLUGS[article.section]
	if (article.slug !== slug || article.section !== expectedSection) {
		res.setHeader('Cache-Control', ARTICLE_NO_STORE)
		return {
			redirect: {
				destination: `/research/${canonicalSectionSlug}/${article.slug}`,
				permanent: false
			}
		}
	}

	res.setHeader('Cache-Control', ARTICLE_CACHE_CONTROL)

	return {
		props: {
			initialArticle: sanitizePublicArticle(article),
			initialBanners: await loadArticleBannerData(article)
		}
	}
}

export const getServerSideProps = withServerSidePropsTelemetry('/research/[section]/[slug]', getServerSidePropsHandler)

function OwnerEditChip({ article }: { article: PublicArticleDocument }) {
	const { user, isAuthenticated } = useAuthContext()
	const canEdit = canEditResearchArticle({ article, isAuthenticated, user })
	if (!canEdit) return null
	return (
		<div className="pointer-events-none fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 justify-center sm:bottom-8">
			<Link
				href={`/research/edit/${article.id}`}
				className="pointer-events-auto flex items-center gap-2 rounded-md border border-medium bg-surface px-3 py-2 label-md text-primary shadow-lg transition-colors hover:border-link/40 hover:text-link"
			>
				<Icon name="pencil" className="size-4" />
				Edit research
			</Link>
		</div>
	)
}

function SectionArticleContent({
	slug,
	sectionSlug,
	initialArticle,
	initialBanners
}: {
	slug: string
	sectionSlug: string
	initialArticle?: PublicArticleDocument | null
	initialBanners?: ArticleBannerStripInitialData | null
}) {
	const expectedSection = ARTICLE_SECTION_FROM_SLUG[sectionSlug]
	const {
		data: article = null,
		isLoading,
		error
	} = useQuery({
		queryKey: ['research', 'article', slug],
		queryFn: async () => {
			const nextArticle = await getArticleBySlug(slug)
			return nextArticle ? sanitizePublicArticle(nextArticle) : null
		},
		enabled: !!slug && !!expectedSection,
		initialData: initialArticle?.slug === slug ? initialArticle : undefined,
		staleTime: 0,
		refetchOnMount: 'always',
		retry: false
	})

	useEffect(() => {
		if (!article) return
		const sectionMismatch = !!article.section && article.section !== expectedSection
		const slugMismatch = article.slug !== slug
		if (!sectionMismatch && !slugMismatch) return
		const canonicalSectionSlug = article.section ? ARTICLE_SECTION_SLUGS[article.section] : sectionSlug
		void Router.replace(`/research/${canonicalSectionSlug}/${article.slug}`)
	}, [article, expectedSection, slug, sectionSlug])

	if (!expectedSection) {
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-medium bg-surface p-6">
				<h1 className="heading-sm text-primary">Section not found</h1>
				<Link href="/research" className="body-md text-link hover:underline">
					Browse all research →
				</Link>
			</div>
		)
	}

	if (isLoading) {
		return <ResearchLoader />
	}

	if (!article && !error) {
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-medium bg-surface p-6">
				<h1 className="heading-sm text-primary">Research not found</h1>
				<Link href="/research" className="body-md text-link hover:underline">
					Browse all research →
				</Link>
			</div>
		)
	}

	if (!article) {
		const message = error instanceof ArticleApiError ? error.message : 'Failed to load research'
		return (
			<div className="mx-auto grid max-w-xl gap-3 rounded-md border border-error/30 bg-error/5 p-6">
				<h1 className="heading-sm text-primary">Couldn't load research</h1>
				<p className="body-md text-secondary">{message}</p>
			</div>
		)
	}

	const sectionMismatch = article.section ? article.section !== expectedSection : false
	const slugMismatch = article.slug !== slug

	if ((sectionMismatch || slugMismatch) && article.status === 'published') {
		return <ResearchLoader />
	}

	return (
		<>
			<ArticleSeo article={article} />
			<ArticleBannerStrip
				scope="article"
				articleId={article.id}
				section={article.section ?? null}
				initialData={initialBanners}
			/>
			<AppMetadataProvider>
				{/* Next keeps this page mounted between articles; each article starts with its own contents, embeds and scroll state. */}
				<ArticleRenderer
					key={article.id}
					article={article}
					sidePanelAction={<ResearchSearchDialog variant="article" />}
				/>
				<OwnerEditChip article={article} />
			</AppMetadataProvider>
			<ResearchFooter maxWidthClassName="max-w-[1300px]" />
		</>
	)
}

export default function SectionArticlePage({
	initialArticle,
	initialBanners
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const router = useRouter()
	const initialSectionSlug = initialArticle?.section ? ARTICLE_SECTION_SLUGS[initialArticle.section] : ''
	const slug = typeof router.query.slug === 'string' ? router.query.slug : (initialArticle?.slug ?? '')
	const sectionSlug = typeof router.query.section === 'string' ? router.query.section : initialSectionSlug
	const expectedSection = ARTICLE_SECTION_FROM_SLUG[sectionSlug]
	const canonical =
		initialArticle?.section && initialArticle.slug
			? `/research/${ARTICLE_SECTION_SLUGS[initialArticle.section]}/${initialArticle.slug}`
			: expectedSection
				? `/research/${sectionSlug}/${slug}`
				: '/research'
	const noIndex = !expectedSection
	const title = initialArticle?.seoTitle || initialArticle?.title || 'Research - DefiLlama'
	const description = initialArticle?.seoDescription || initialArticle?.excerpt || 'DefiLlama research.'
	const firstPublished = initialArticle?.firstPublishedAt ?? initialArticle?.publishedAt ?? null
	const lastPublished = initialArticle?.lastPublishedAt ?? initialArticle?.publishedAt ?? null

	return (
		<Layout title={title} description={description} canonicalUrl={canonical} noIndex={noIndex} hideDesktopSearch>
			<Head>
				{firstPublished ? (
					<meta key="article:published_time" property="article:published_time" content={firstPublished} />
				) : null}
				{lastPublished ? (
					<meta key="article:modified_time" property="article:modified_time" content={lastPublished} />
				) : null}
			</Head>
			<ArticleProxyAuthProvider>
				{slug && sectionSlug ? (
					<SectionArticleContent
						slug={slug}
						sectionSlug={sectionSlug}
						initialArticle={initialArticle}
						initialBanners={initialBanners}
					/>
				) : (
					<ResearchLoader />
				)}
			</ArticleProxyAuthProvider>
		</Layout>
	)
}
