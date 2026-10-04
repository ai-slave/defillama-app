import Link from 'next/link'
import { type CSSProperties, useCallback } from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { useSharedHeight } from '~/containers/Articles/landing/ResearchSectionWithSharedHeight'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref, formatDate } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'

interface ResearchGridWithScrollbarProps {
	id: string
	title: string
	articles: Array<ArticleDocument>
	pageWidget: string
}

export function ResearchGridWithScrollbar({ id, title, articles, pageWidget }: ResearchGridWithScrollbarProps) {
	if (articles.length === 0) return null

	return (
		<div id={id}>
			<div>
				<div className="mb-6.5">
					<TitleLine title={title} />
				</div>
				<ResearchGridWithScrollbarScroller articles={articles} pageWidget={pageWidget} />

				<div className="mt-auto shrink-0 pt-4.5 text-right">
					<ReadMoreLink url="/research?section=report" title="View all reports" />
				</div>
			</div>
		</div>
	)
}

function ResearchGridWithScrollbarScroller({
	articles,
	pageWidget
}: {
	articles: Array<ArticleDocument>
	pageWidget: string
}) {
	// The scroller shows two rows, measured from the first card; the spotlight column beside it shares the height.
	const { height, setHeight } = useSharedHeight()
	// Runs in the commit, so the first paint already has the height. A new first article is a new element and
	// measures again; the observer follows the card's own size, which also changes with the viewport.
	const measureFirstCard = useCallback(
		(card: HTMLAnchorElement) => {
			const measure = () => setHeight(card.offsetHeight * 2 + 32)
			measure()
			const observer = new ResizeObserver(measure)
			observer.observe(card)
			return () => observer.disconnect()
		},
		[setHeight]
	)

	return (
		<div style={height ? ({ '--scroller-height': `${height}px` } as CSSProperties) : undefined}>
			<div className="h-[calc(160px_*_2_+_32px_*_1)] overflow-y-auto sm:h-(--scroller-height,_calc(288px_*_2_+_32px_*_1))">
				<div className="grid grid-cols-2 gap-8 pr-4">
					{articles.map((article, i) => (
						<Link
							key={article.id}
							ref={i === 0 ? measureFirstCard : undefined}
							className="group relative top-0 overflow-hidden rounded-lg transition-all duration-200 ease-out hover:top-[-4px]"
							href={articleHref(article)}
							onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', pageWidget)}
						>
							<div className="relative aspect-[207/119] overflow-hidden rounded-[7px] group-hover:brightness-[0.8] lg:min-w-[40%]">
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
							{i === 0 && <InViewAnalytics eventParams={[article, 'widget_impression', pageWidget]} />}
							<div className="flex grow flex-col pt-4">
								<div className="line-clamp-4 text-base leading-[150%] font-semibold text-research-heading group-hover:text-research-heading group-hover:opacity-70 dark:text-research-ink dark:group-hover:text-on-brand/70">
									{article.title}
								</div>
								<div className="mt-1.25 text-sm font-medium text-secondary dark:text-on-brand/80">
									{formatDate(article.displayDate ?? article.publishedAt)}
								</div>
							</div>
						</Link>
					))}
				</div>
			</div>
		</div>
	)
}
