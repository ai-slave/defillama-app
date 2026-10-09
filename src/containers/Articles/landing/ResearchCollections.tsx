import Link from 'next/link'
import { type CSSProperties, useCallback, useState } from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import { ARTICLE_SECTION_LABELS, type ArticleDocument } from '~/containers/Articles/types'

interface ResearchCollectionsProps {
	title: string
	articles: Array<ArticleDocument>
}

const pageWidget = 'DefiLlama Research Collections widget'

/** 4 rows below lg, 5 at lg, 12px gaps; each row is the first card's height, measured. */
const SCROLLER_HEIGHT_CLASSES =
	'h-[calc((var(--research-collections-item-h,65px)_*_4)_+_(12px_*_3))] lg:h-[calc((var(--research-collections-item-h,65px)_*_5)_+_(12px_*_4))] overflow-y-auto'

export function ResearchCollections({ title, articles }: ResearchCollectionsProps) {
	const [itemHeight, setItemHeight] = useState<number | null>(null)
	// Runs in the commit, so the first paint already has the height. A new first article is a new element and
	// measures again; the observer follows the card's own size, which also changes with the viewport.
	const measureFirstCard = useCallback((card: HTMLAnchorElement) => {
		const measure = () => setItemHeight(card.offsetHeight)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(card)
		return () => observer.disconnect()
	}, [])

	if (articles.length === 0) return null

	return (
		<div id="collections">
			<div className="mb-6">
				<TitleLine title={title} />
			</div>
			<div className="overflow-x-auto pb-2 lg:overflow-x-visible lg:pb-0">
				<div
					className={`min-w-min ${SCROLLER_HEIGHT_CLASSES}`}
					style={
						itemHeight == null ? undefined : ({ '--research-collections-item-h': `${itemHeight}px` } as CSSProperties)
					}
				>
					<div className="flex grid min-w-min grid-cols-1 gap-3 lg:min-w-0 lg:grid-cols-3">
						{articles.map((article, i) => (
							<Link
								key={article.id}
								ref={i === 0 ? measureFirstCard : undefined}
								className="group relative flex w-full shrink-0 overflow-hidden lg:w-auto"
								href={articleHref(article)}
								onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', pageWidget)}
							>
								<div className="relative aspect-[85/65] min-w-[85px] overflow-hidden rounded-[7px] group-hover:brightness-[0.8] lg:aspect-[170/121] lg:min-w-[40%]">
									{article.coverImage?.url ? (
										<img
											src={article.coverImage.url}
											alt={article.coverImage.alt ?? ''}
											className="absolute inset-0 h-full w-full object-cover"
											loading="lazy"
											decoding="async"
										/>
									) : null}
								</div>

								{i === 0 && <InViewAnalytics eventParams={[article, 'widget_impression', pageWidget]} />}

								<div className="flex min-w-0 grow flex-col pl-3">
									<div className="line-clamp-4 title-md text-research-navy group-hover:text-secondary">
										{article.title}
									</div>

									{article.section ? (
										<div className="mt-1.25 title-sm text-link">{ARTICLE_SECTION_LABELS[article.section]}</div>
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
