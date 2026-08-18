import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { getAllArticlesBanner, getArticleBanner, getSectionBanner } from '~/containers/Articles/api'
import { useEligibleBanner } from '~/containers/Articles/bannerTargeting'
import { allArticlesBannerForArticle } from '~/containers/Articles/renderer/bannerExclusion'
import type { ArticleSection, BannerLookupResult } from '~/containers/Articles/types'

type Props = {
	articleId: string
	section: ArticleSection | null
}

function isExternalUrl(url: string) {
	return /^https?:\/\//i.test(url)
}

export function ArticleImageBanner({ articleId, section }: Props) {
	const articleBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'article', articleId],
		queryFn: () => getArticleBanner(articleId),
		enabled: !!articleId,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const sectionBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'section', section],
		queryFn: () => getSectionBanner(section as ArticleSection),
		enabled: !!section && !!articleId,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const allArticlesBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'all-articles'],
		queryFn: () => getAllArticlesBanner(),
		enabled: !!articleId,
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	const banner = useEligibleBanner(
		[
			articleBannerQuery.data?.image ?? null,
			sectionBannerQuery.data?.image ?? null,
			allArticlesBannerForArticle(allArticlesBannerQuery.data?.image ?? null, articleId)
		],
		articleBannerQuery.isLoading || (!!section && sectionBannerQuery.isLoading) || allArticlesBannerQuery.isLoading
	)

	if (!banner || !banner.enabled || !banner.imageUrl) return null

	const alt = banner.imageAlt?.trim() ?? ''
	const linkUrl = banner.linkUrl?.trim() ?? ''

	const frame = (
		<div className="overflow-hidden rounded-md border border-medium bg-surface transition-colors hover:border-link/40">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={banner.imageUrl} alt={alt} className="block h-auto w-full" loading="lazy" />
		</div>
	)

	const content = !linkUrl ? (
		frame
	) : isExternalUrl(linkUrl) ? (
		<a href={linkUrl} target="_blank" rel="noopener noreferrer" className="block">
			{frame}
		</a>
	) : (
		<Link href={linkUrl} className="block">
			{frame}
		</Link>
	)

	return <div className="pr-2">{content}</div>
}
