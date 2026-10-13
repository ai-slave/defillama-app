import clsx from 'clsx'
import Link from 'next/link'
import React from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref, formatDate } from '~/containers/Articles/landing/utils'
import { ResearchArt } from '~/containers/Articles/ResearchArt'
import type { ArticleDocument } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

function getImageAspectRatio(itemsCount: number) {
	if (itemsCount === 6) return 'aspect-[167/96]'
	if (itemsCount === 5) return 'aspect-[207/118]'
	return 'aspect-[270/155]'
}

function getSpotlightGridCols(itemsCount: number) {
	if (itemsCount === 6) return 'sm:grid-cols-6'
	if (itemsCount === 5) return 'sm:grid-cols-5'
	return 'sm:grid-cols-4'
}

function SnapshotImage({ article }: Readonly<{ article: ArticleDocument }>) {
	const url = article.coverImage?.url
	if (!url) return null
	return (
		<img
			src={url}
			alt={article.coverImage.alt ?? ''}
			className="h-full w-full object-cover"
			loading="lazy"
			decoding="async"
		/>
	)
}

interface ResearchSpotlightProps {
	articles: Array<ArticleDocument>
	title: string
}

export function ResearchSpotlight({ title, articles }: ResearchSpotlightProps) {
	if (articles.length === 0) return null

	const count = articles.length

	return (
		<div id="spotlight">
			<div className="mb-6.5 flex items-center gap-x-3.75">
				<Icon name="sparkles" className="size-8" aria-hidden />
				<TitleLine title={title} />
			</div>
			<div className={clsx('grid grid-cols-1 gap-3 lg:gap-7', getSpotlightGridCols(count))}>
				{articles.map((article, i) => (
					<Link
						key={article.id}
						className="group relative"
						href={articleHref(article)}
						onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', 'DefiLlama Research Spotlight widget')}
					>
						<div
							className={clsx(
								'relative overflow-hidden rounded-[7.2px] group-hover:brightness-[0.8] lg:min-w-[40%]',
								getImageAspectRatio(count)
							)}
						>
							<ResearchArt
								name="spotlight-badge"
								className="absolute top-[8px] left-[8px] z-[1]"
								width={43}
								height={35}
								aria-hidden
							/>
							<SnapshotImage article={article} />
						</div>
						{i === 0 && (
							<InViewAnalytics eventParams={[article, 'widget_impression', 'DefiLlama Research Spotlight widget']} />
						)}
						<div className="flex grow flex-col py-4">
							<div
								className={clsx(
									'font-semibold text-research-navy group-hover:text-secondary',
									count === 5 || count === 6
										? 'line-clamp-4 text-base leading-[120%]'
										: 'line-clamp-3 text-base leading-[150%] lg:text-lg'
								)}
							>
								{article.title}
							</div>
							<time className="mt-2.5 hidden label-md text-tertiary lg:block">
								{formatDate(article.displayDate ?? article.publishedAt)}
							</time>
						</div>
					</Link>
				))}
			</div>
			<div className="pt-4.5 text-right">
				<ReadMoreLink url="/research?section=spotlight" title="View all spotlights" />
			</div>
		</div>
	)
}
