import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { getAllArticlesBanner } from '~/containers/Articles/api'
import { useEligibleBanner } from '~/containers/Articles/bannerTargeting'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { PromoDisclosure } from '~/containers/Articles/PromoDisclosure'
import { articlePromoLinkUrl } from '~/containers/Articles/promoLinks'
import { allArticlesBannerForArticle } from '~/containers/Articles/renderer/bannerExclusion'
import type { Banner, BannerLookupResult } from '~/containers/Articles/types'

function isExternalUrl(url: string) {
	return /^https?:\/\//i.test(url)
}

export function usePromoBanner(articleId: string | null | undefined): Banner | null {
	const allArticlesBannerQuery = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'all-articles'],
		queryFn: () => getAllArticlesBanner(),
		retry: false,
		staleTime: 0,
		refetchOnMount: 'always'
	})

	return useEligibleBanner(
		[allArticlesBannerForArticle(allArticlesBannerQuery.data?.promo ?? null, articleId)],
		allArticlesBannerQuery.isLoading
	)
}

export function mobilePromoImageUrl(banner: Banner | null): string | undefined {
	if (!banner || !banner.enabled) return undefined
	return (banner.imageMobileUrl ?? banner.imageCardUrl)?.trim() || undefined
}

export function cardPromoImageUrl(banner: Banner | null): string | undefined {
	if (!banner || !banner.enabled) return undefined
	return banner.imageCardUrl?.trim() || undefined
}

function PromoFrame({ banner, imageUrl }: { banner: Banner; imageUrl: string }) {
	const alt = banner.imageAlt?.trim() ?? ''
	const linkUrl = articlePromoLinkUrl(banner)
	const widgetLabel = 'DefiLlama Research article promo banner'
	const trackClick = () => pushResearchAnalyticsEvent(null, 'widget_click', widgetLabel)

	const frame = (
		<div className="overflow-hidden rounded-md border border-medium bg-surface transition-colors hover:border-link/40">
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={imageUrl} alt={alt} className="block h-auto w-full" loading="lazy" />
		</div>
	)

	const content = !linkUrl ? (
		frame
	) : isExternalUrl(linkUrl) ? (
		<a href={linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="block" onClick={trackClick}>
			{frame}
		</a>
	) : (
		<Link href={linkUrl} className="block" onClick={trackClick}>
			{frame}
		</Link>
	)

	return (
		<div>
			<InViewAnalytics eventParams={[null, 'widget_impression', widgetLabel]} />
			{content}
			<PromoDisclosure banner={banner} />
		</div>
	)
}

export function ArticlePromoCard({ articleId }: { articleId: string | null | undefined }) {
	const banner = usePromoBanner(articleId)
	const imageUrl = cardPromoImageUrl(banner)

	if (!banner || !imageUrl) return null

	return <PromoFrame banner={banner} imageUrl={imageUrl} />
}

export function ArticlePromoBannerMobile({ articleId }: { articleId: string | null | undefined }) {
	const banner = usePromoBanner(articleId)
	const imageUrl = mobilePromoImageUrl(banner)

	if (!banner || !imageUrl) return null

	return (
		<div className="not-prose my-6 lg:hidden">
			<PromoFrame banner={banner} imageUrl={imageUrl} />
		</div>
	)
}
