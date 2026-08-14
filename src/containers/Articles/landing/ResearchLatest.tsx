import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import React from 'react'
import { getLandingBanner } from '~/containers/Articles/api'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import type { ArticleDocument, Banner, BannerLookupResult } from '~/containers/Articles/types'

const NAV_ITEMS: Array<{ id: string; label: string; anchor: string }> = [
	{ id: 'spotlight', label: 'Spotlights', anchor: '#spotlight' },
	{ id: 'reports', label: 'Reports', anchor: '#reports' },
	{ id: 'insights', label: 'Insights', anchor: '#insights' },
	{ id: 'interviews', label: 'Interviews', anchor: '#interviews' },
	{ id: 'collections', label: 'Collections', anchor: '#collections' },
	{ id: 'clients', label: 'Trusted by', anchor: '#clients' }
]

type TitlePlacement = 'bottom' | 'right50' | 'right33'

function TitleOverlay({
	title,
	placement
}: Readonly<{
	title: string
	placement: TitlePlacement
}>) {
	const base = 'absolute z-20 bg-research-heading/70 p-4 text-base font-semibold leading-[150%] text-on-brand'

	const titleClamp = 'line-clamp-3 lg:line-clamp-4'

	if (placement === 'bottom') {
		return (
			<div className={`${base} right-0 bottom-0 left-0 flex min-h-[110px] w-full items-start`}>
				<div className={`w-full ${titleClamp}`}>{title}</div>
			</div>
		)
	}

	if (placement === 'right33') {
		return (
			<div
				className={`${base} top-auto right-0 bottom-0 left-0 flex min-h-[110px] w-full items-start text-left lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:w-1/3`}
			>
				<div className={`w-full ${titleClamp}`}>{title}</div>
			</div>
		)
	}

	return (
		<div
			className={`${base} top-auto right-0 bottom-0 left-0 flex min-h-[110px] w-full items-start text-left lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:w-1/2`}
		>
			<div className={`w-full ${titleClamp}`}>{title}</div>
		</div>
	)
}

type NormalizedItem = {
	_key: string
	label: string
	title: string
	image?: string
	alt?: string
	href: string
}

function normalizeItem(article: ArticleDocument, index: number): NormalizedItem {
	const label = article.section?.replace(/-/g, ' ') ?? 'Research'
	return {
		_key: `${article.id}-${index}`,
		label: label.toUpperCase(),
		title: article.title,
		...(article.coverImage?.url === undefined ? {} : { image: article.coverImage.url }),
		...(article.coverImage?.alt === undefined ? {} : { alt: article.coverImage.alt }),
		href: articleHref(article)
	}
}

const CardSlot = ({
	item,
	titlePlacement = 'bottom',
	className
}: {
	item: NormalizedItem | undefined
	titlePlacement?: TitlePlacement
	className: string
}) =>
	item ? (
		<div className={className}>
			<ContentCard item={item} titlePlacement={titlePlacement} className="h-full" />
		</div>
	) : null

const ContentCard = ({
	item,
	titlePlacement,
	className = ''
}: {
	item: NormalizedItem
	titlePlacement: TitlePlacement
	className?: string
}) => (
	<Link href={item.href} className={`group relative flex flex-col overflow-hidden rounded-[16px] ${className}`}>
		<div className="absolute inset-0">
			{item.image ? (
				<div className="relative h-full w-full">
					<img
						src={item.image}
						alt={item.alt}
						className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
						loading="lazy"
						decoding="async"
					/>
				</div>
			) : null}
		</div>

		<span className="absolute top-[12px] left-[12px] rounded-[4px] border border-research-white px-2 py-0.5 text-[10px] font-semibold text-on-brand uppercase backdrop-blur-sm">
			{item.label}
		</span>

		<TitleOverlay title={item.title} placement={titlePlacement} />
	</Link>
)

const SquareBannerCard = ({ banner }: { banner: Banner }) => {
	const content = (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={banner.imageUrl ?? ''}
			alt={banner.imageAlt?.trim() ?? ''}
			className="h-full w-full object-cover"
			loading="lazy"
			decoding="async"
		/>
	)
	const linkUrl = banner.linkUrl?.trim()

	return (
		<div className="aspect-[1088/1016] w-full overflow-hidden rounded-[16px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full lg:w-auto">
			<InViewAnalytics eventParams={[null, 'widget_impression', 'DefiLlama Research square banner']} />
			{linkUrl ? (
				<Link
					href={linkUrl}
					target="_blank"
					rel="noopener noreferrer sponsored"
					aria-label={banner.imageAlt?.trim() || 'DefiLlama Research banner'}
					className="block h-full w-full"
					onClick={() => pushResearchAnalyticsEvent(null, 'widget_click', 'DefiLlama Research square banner')}
				>
					{content}
				</Link>
			) : (
				content
			)}
		</div>
	)
}

interface ResearchLatestProps {
	articles?: ArticleDocument[]
	initialData?: BannerLookupResult | null
}

export const ResearchLatest: React.FC<ResearchLatestProps> = ({ articles = [], initialData }) => {
	const { data } = useQuery<BannerLookupResult>({
		queryKey: ['research', 'banner', 'landing'],
		queryFn: () => getLandingBanner(),
		...(initialData == null ? {} : { initialData }),
		retry: false,
		staleTime: 60_000
	})

	const normalized = articles.slice(0, 6).map((article, index) => normalizeItem(article, index))

	if (normalized.length === 0) return null

	const squareBanner = data?.imageSquare?.enabled && data.imageSquare.imageUrl?.trim() ? data.imageSquare : null

	const [item1, item2, item3, item4, item5, item6] = normalized

	return (
		<div>
			<div className="mb-8 flex scrollbar-none max-w-full touch-pan-x flex-nowrap gap-3 overflow-x-auto [-webkit-overflow-scrolling:touch] lg:flex-wrap lg:justify-center lg:overflow-x-visible">
				{NAV_ITEMS.map((cat) => (
					<Link
						key={cat.id}
						href={cat.anchor}
						className="w-auto shrink-0 rounded-[4px] border border-research-accent/35 bg-transparent px-3.75 py-0.75 text-center text-sm font-medium text-research-accent-strong uppercase transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-research-accent hover:text-research-accent-strong focus-visible:border-research-accent focus-visible:text-research-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-research-accent motion-safe:hover:scale-[1.03] motion-safe:focus-visible:scale-[1.03] dark:border-research-invert dark:text-research-ink dark:hover:border-research-accent dark:hover:text-research-accent-soft dark:focus-visible:border-research-accent dark:focus-visible:text-research-accent-soft"
					>
						{cat.label}
					</Link>
				))}
			</div>

			<div className="mb-8">
				<TitleLine title="Latest from DefiLlama Research" />
			</div>

			{squareBanner ? (
				<div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:mb-8 lg:h-[490px] lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[calc((100%-20px)*211/474)_minmax(0,1fr)] lg:gap-5">
					<div className="flex gap-3 md:col-span-2 lg:col-span-1 lg:gap-5">
						<CardSlot item={item1} className="h-[250px] w-1/2 lg:h-full" />
						<CardSlot item={item2} className="h-[250px] w-1/2 lg:h-full" />
					</div>
					<CardSlot item={item3} className="h-[250px] w-full md:h-auto" />
					<SquareBannerCard banner={squareBanner} />
				</div>
			) : (
				<div className="mb-4 grid grid-cols-1 gap-3 lg:mb-8 lg:grid-cols-2 lg:gap-5">
					<div className="flex flex-col gap-3 lg:h-[490px] lg:gap-5">
						<div className="flex gap-3 lg:h-[calc((100%-20px)*211/474)] lg:gap-5">
							<CardSlot item={item1} className="h-[250px] w-1/2 lg:h-full" />
							<CardSlot item={item2} className="h-[250px] w-1/2 lg:h-full" />
						</div>
						<CardSlot item={item3} className="h-[250px] w-full lg:h-[calc((100%-20px)*263/474)]" />
					</div>

					<div className="flex flex-col gap-3 lg:h-full lg:flex-row lg:gap-5">
						<CardSlot item={item4} className="h-[200px] w-full lg:h-full lg:w-1/2" />
						<div className="flex w-full gap-3 lg:h-full lg:w-1/2 lg:flex-col lg:gap-5">
							<CardSlot item={item5} className="h-[250px] w-1/2 lg:h-[calc((100%-20px)*286/473)] lg:w-full" />
							<CardSlot
								item={item6}
								titlePlacement="right50"
								className="h-[250px] w-1/2 lg:h-[calc((100%-20px)*187/473)] lg:w-full"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
