import Link from 'next/link'
import React, { useMemo, useRef } from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import { ARTICLE_SECTION_LABELS, type ArticleDocument } from '~/containers/Articles/types'
import { useScrollerHeightFromFirstItem } from '~/hooks/useScrollerHeightFromFirstItem'

interface ResearchCollectionsProps {
	title: string
	articles: ArticleDocument[]
}

const pageWidget = 'DefiLlama Research Collections widget'

const COLLECTIONS_ITEM_SELECTOR = '[data-collections-item]'

/** Set on the scroller; use in `calc()` with breakpoint-specific row counts and gaps. */
export const RESEARCH_COLLECTIONS_ITEM_HEIGHT_VAR = '--research-collections-item-h'

/** Uses `RESEARCH_COLLECTIONS_ITEM_HEIGHT_VAR`: 4 rows @ max-lg, 5 @ lg (gaps 12px between rows). */
export const RESEARCH_COLLECTIONS_SCROLLER_HEIGHT_CLASSES =
	'h-[calc((var(--research-collections-item-h,65px)_*_4)_+_(12px_*_3))] lg:h-[calc((var(--research-collections-item-h,65px)_*_5)_+_(12px_*_4))] overflow-y-auto' as const

export const ResearchCollections: React.FC<ResearchCollectionsProps> = ({ title, articles }) => {
	const gridRef = useRef<HTMLDivElement>(null)
	const remeasureKey = useMemo(() => articles.map((a) => a.id).join(','), [articles])

	const collectionsItemHeightPx = useScrollerHeightFromFirstItem({
		containerRef: gridRef,
		itemSelector: COLLECTIONS_ITEM_SELECTOR,
		remeasureKey,
		enabled: articles.length > 0
	})

	if (articles.length === 0) return null

	const scrollerStyle =
		collectionsItemHeightPx != null
			? ({ [RESEARCH_COLLECTIONS_ITEM_HEIGHT_VAR]: `${collectionsItemHeightPx}px` } as React.CSSProperties)
			: undefined

	return (
		<div id="collections">
			<div className="mb-6">
				<TitleLine title={title} />
			</div>
			<div className="overflow-x-auto pb-2 lg:overflow-x-visible lg:pb-0">
				<div className={`min-w-min ${RESEARCH_COLLECTIONS_SCROLLER_HEIGHT_CLASSES}`} style={scrollerStyle}>
					<div ref={gridRef} className="flex grid min-w-min grid-cols-1 gap-3 lg:min-w-0 lg:grid-cols-3">
						{articles.map((article, i) => (
							<Link
								key={article.id}
								data-collections-item
								className="group relative top-0 flex w-full shrink-0 overflow-hidden transition-all duration-200 ease-out hover:top-[-4px] lg:w-auto"
								href={articleHref(article)}
								onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', pageWidget)}
							>
								<div className="relative aspect-[85/65] min-w-[85px] overflow-hidden rounded-[7px] group-hover:brightness-[0.8] lg:aspect-[170/121] lg:min-w-[40%]">
									{article.coverImage?.url ? (
										<img
											src={article.coverImage.url}
											alt={article.coverImage.alt}
											className="absolute inset-0 h-full w-full object-cover"
											loading="lazy"
											decoding="async"
										/>
									) : null}
								</div>

								{i === 0 && <InViewAnalytics eventParams={[article, 'widget_impression', pageWidget]} />}

								<div className="flex min-w-0 grow flex-col pl-3">
									<div className="line-clamp-4 text-sm leading-[150%] font-semibold text-(--research-navy-soft) group-hover:text-(--research-navy-soft) group-hover:opacity-70 dark:text-ai-primary dark:group-hover:text-on-brand/70">
										{article.title}
									</div>

									{article.section ? (
										<div className="mt-1.25 text-xs font-bold text-on-brand" style={{ color: '#3A8BFF' }}>
											{ARTICLE_SECTION_LABELS[article.section]}
										</div>
									) : null}
								</div>
							</Link>
						))}
					</div>
				</div>
			</div>
			<div className="mt-auto shrink-0 pt-4.5 text-right">
				<ReadMoreLink url="/research?section=all" title="View all collection" />
			</div>
		</div>
	)
}
