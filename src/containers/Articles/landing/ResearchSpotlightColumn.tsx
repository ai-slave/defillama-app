import Link from 'next/link'
import type { CSSProperties } from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { useSharedHeight } from '~/containers/Articles/landing/ResearchSectionWithSharedHeight'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref, formatDate } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'

interface ResearchSpotlightColumnProps {
	title: string
	articles: Array<ArticleDocument>
}

const DEFAULT_CONTAINER_HEIGHT = 'h-[calc(105px_*_4_+_12px_*_3)]'
const DEFAULT_DESKTOP_HEIGHT = 'lg:h-[calc(93px_*_5_+_24px_*_4)]'

// Matches the height its shared-height section measures from the column beside it.
export function ResearchSpotlightColumn({ title, articles }: ResearchSpotlightColumnProps) {
	const { height: sharedHeight } = useSharedHeight()
	const containerHeight = sharedHeight
		? `${DEFAULT_CONTAINER_HEIGHT} lg:h-(--shared-height,_calc(93px_*_5_+_24px_*_4))`
		: `${DEFAULT_CONTAINER_HEIGHT} ${DEFAULT_DESKTOP_HEIGHT}`

	if (articles.length === 0) return null

	return (
		<div id="spotlight">
			<div>
				<div className="mb-6.5">
					<TitleLine title={title} />
				</div>
				<div className="flex flex-col gap-y-16">
					<div>
						<div
							className={`overflow-y-auto ${containerHeight}`}
							style={sharedHeight ? ({ '--shared-height': `${sharedHeight}px` } as CSSProperties) : undefined}
						>
							<div className="flex flex-col gap-y-6">
								{articles.map((article, i) => (
									<Link
										key={article.id}
										className="group relative top-0 flex gap-4"
										href={articleHref(article)}
										onClick={() =>
											pushResearchAnalyticsEvent(article, 'widget_click', 'DefiLlama Research Spotlight column')
										}
									>
										<div className="relative aspect-[160/96] w-[105px] min-w-[105px] overflow-hidden rounded-lg group-hover:brightness-[0.8] lg:min-w-[160px]">
											{article.coverImage?.url ? (
												<img
													src={article.coverImage.url}
													alt={article.coverImage.alt ?? ''}
													className="h-full w-full object-cover"
													loading="lazy"
													decoding="async"
												/>
											) : null}
										</div>

										<div className="flex grow flex-col justify-between gap-1.75 pr-3">
											<div className="line-clamp-3 label-lg text-research-navy group-hover:text-secondary">
												{i === 0 && (
													<InViewAnalytics
														eventParams={[article, 'widget_impression', 'DefiLlama Research Spotlight column']}
													/>
												)}
												{article.title}
											</div>
											<div className="title-sm text-tertiary">
												{formatDate(article.displayDate ?? article.publishedAt)}
											</div>
										</div>
									</Link>
								))}
							</div>
						</div>
						<div className="mt-auto shrink-0 pt-4.5 text-right">
							<ReadMoreLink url="/research?section=spotlight" title="View all spotlights" />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
