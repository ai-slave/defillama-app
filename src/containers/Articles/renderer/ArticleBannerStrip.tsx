import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Announcement } from '~/components/Announcement'
import { getAllArticlesBanner, getArticleBanner, getLandingBanner, getSectionBanner } from '~/containers/Articles/api'
import { useEligibleBanner } from '~/containers/Articles/bannerTargeting'
import { allArticlesBannerForArticle } from '~/containers/Articles/renderer/bannerExclusion'
import type { ArticleSection, Banner, BannerLookupResult } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

type Props = {
	scope: 'landing' | 'section' | 'article'
	section?: ArticleSection | null
	articleId?: string | null
	initialData?: ArticleBannerStripInitialData | null
}

export type ArticleBannerStripInitialData = {
	article?: BannerLookupResult | null
	section?: BannerLookupResult | null
	allArticles?: BannerLookupResult | null
	landing?: BannerLookupResult | null
}

function isExternalUrl(url: string) {
	return /^https?:\/\//i.test(url)
}

export function ArticleBannerStrip({ scope, section, articleId, initialData }: Props) {
	const articleBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'article', articleId],
		queryFn: () => getArticleBanner(articleId as string),
		enabled: scope === 'article' && !!articleId,
		initialData: scope === 'article' ? (initialData?.article ?? undefined) : undefined,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const sectionSlug = scope === 'section' ? section : scope === 'article' ? section : null
	const sectionEnabled = scope === 'section' ? !!section : scope === 'article' ? !!section && !!articleId : false

	const sectionBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'section', sectionSlug],
		queryFn: () => getSectionBanner(sectionSlug as ArticleSection),
		enabled: sectionEnabled,
		initialData: sectionSlug ? (initialData?.section ?? undefined) : undefined,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const allArticlesEnabled = scope === 'article' && !!articleId

	const allArticlesBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'all-articles'],
		queryFn: () => getAllArticlesBanner(),
		enabled: allArticlesEnabled,
		initialData: scope === 'article' ? (initialData?.allArticles ?? undefined) : undefined,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const landingBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'landing'],
		queryFn: () => getLandingBanner(),
		enabled: scope === 'landing',
		initialData: scope === 'landing' ? (initialData?.landing ?? undefined) : undefined,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const candidates: Array<Banner | null> =
		scope === 'article'
			? [
					articleBannerQuery.data?.text ?? null,
					sectionBannerQuery.data?.text ?? null,
					allArticlesBannerForArticle(allArticlesBannerQuery.data?.text ?? null, articleId)
				]
			: scope === 'section'
				? [sectionBannerQuery.data?.text ?? null]
				: [landingBannerQuery.data?.text ?? null]
	const candidatesLoading =
		(scope === 'article' &&
			(articleBannerQuery.isLoading ||
				(sectionEnabled && sectionBannerQuery.isLoading) ||
				allArticlesBannerQuery.isLoading)) ||
		(scope === 'section' && sectionBannerQuery.isLoading) ||
		(scope === 'landing' && landingBannerQuery.isLoading)
	const banner = useEligibleBanner(candidates, candidatesLoading)

	if (!banner || !banner.enabled) return null

	const linkLabel = banner.linkLabel?.trim() || 'Read more'
	const linkUrl = banner.linkUrl?.trim() || ''
	const hasLink = !!linkUrl

	return (
		<Announcement
			announcementId={`research-banner-${banner.id}`}
			version={banner.updatedAt}
			className="min-h-0 w-full gap-3 rounded-none bg-research-banner px-4 py-2.5 text-on-brand"
			contentClassName="flex items-center justify-center"
			dismissButtonClassName="rounded-full text-on-brand/80 transition-colors hover:bg-research-white/10 hover:text-on-brand"
			dismissLabel="Dismiss banner"
		>
			<p className="m-0 text-center font-jetbrains text-[11px] font-semibold tracking-[0.18em] uppercase">
				<span>{banner.text}</span>
				{hasLink ? (
					<>
						{' '}
						{isExternalUrl(linkUrl) ? (
							<a
								href={linkUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 underline underline-offset-2 transition-opacity hover:opacity-80"
							>
								{linkLabel}
								<Icon name="arrow-up-right" height={10} width={10} />
							</a>
						) : (
							<Link
								href={linkUrl}
								className="inline-flex items-center gap-1 underline underline-offset-2 transition-opacity hover:opacity-80"
							>
								{linkLabel}
							</Link>
						)}
					</>
				) : null}
			</p>
		</Announcement>
	)
}
