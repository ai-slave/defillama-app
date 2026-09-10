import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import React from 'react'
import { getLandingBanner } from '~/containers/Articles/api'
import { useEligibleBanner } from '~/containers/Articles/bannerTargeting'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import type { BannerLookupResult } from '~/containers/Articles/types'
import { useMedia } from '~/hooks/useMedia'

export function ResearchBanner({ initialData }: { initialData?: BannerLookupResult | null }) {
	const isMobile = useMedia('(max-width: 768px)')

	const { data } = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'landing'],
		queryFn: () => getLandingBanner(),
		initialData: initialData ?? undefined,
		retry: false,
		staleTime: 60_000
	})

	const banner = useEligibleBanner(
		data ? (isMobile ? [data.imageHorizontal, data.image] : [data.image, data.imageHorizontal]) : [],
		data === undefined
	)
	const imageUrl = banner?.imageUrl?.trim()

	if (!imageUrl) {
		return null
	}

	const content = (
		<div
			className="flex aspect-[2/1] cursor-pointer flex-col items-center justify-between gap-4 bg-surface-elevated-1 bg-cover px-5.5 py-6 max-md:text-center md:aspect-[2745/380]"
			style={{
				backgroundImage: `url(${imageUrl})`
			}}
		/>
	)
	const linkUrl = banner?.linkUrl?.trim()

	return (
		<div>
			<InViewAnalytics eventParams={[null, 'widget_impression', 'DefiLlama Research banner']} />
			{linkUrl ? (
				<Link
					href={linkUrl}
					target="_blank"
					rel="noopener noreferrer"
					onClick={() => pushResearchAnalyticsEvent(null, 'widget_click', 'DefiLlama Research banner')}
				>
					{content}
				</Link>
			) : (
				content
			)}
		</div>
	)
}
