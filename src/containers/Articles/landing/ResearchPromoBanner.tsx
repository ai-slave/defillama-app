import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import React from 'react'
import { getLandingBanner } from '~/containers/Articles/api'
import { useEligibleBanner } from '~/containers/Articles/bannerTargeting'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { PromoDisclosure } from '~/containers/Articles/PromoDisclosure'
import type { BannerLookupResult } from '~/containers/Articles/types'
import { useMedia } from '~/hooks/useMedia'

export const ResearchPromoBanner: React.FC<{ initialData?: BannerLookupResult | null }> = ({ initialData }) => {
	const isMobile = useMedia('(max-width: 768px)')

	const { data } = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'landing'],
		queryFn: () => getLandingBanner(),
		initialData: initialData ?? undefined,
		retry: false,
		staleTime: 60_000
	})

	const banner = useEligibleBanner([data?.promo ?? null], data === undefined)
	const imageUrl = (isMobile ? (banner?.imageMobileUrl ?? banner?.imageCardUrl) : banner?.imageWideUrl)?.trim()

	if (!banner || !banner.enabled || banner.showOnLanding === false || !imageUrl) {
		return null
	}

	const content = (
		// eslint-disable-next-line @next/next/no-img-element
		<img src={imageUrl} alt={banner.imageAlt?.trim() ?? ''} className="block h-auto w-full" loading="lazy" />
	)
	const linkUrl = banner.linkUrl?.trim()

	return (
		<div>
			<InViewAnalytics eventParams={[null, 'widget_impression', 'DefiLlama Research promo banner']} />
			{linkUrl ? (
				<Link
					href={linkUrl}
					target="_blank"
					rel="noopener noreferrer sponsored"
					onClick={() => pushResearchAnalyticsEvent(null, 'widget_click', 'DefiLlama Research promo banner')}
				>
					{content}
				</Link>
			) : (
				content
			)}
			<PromoDisclosure banner={banner} />
		</div>
	)
}
