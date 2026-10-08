import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'

interface ResearchWidgetWithScrollbarProps {
	id: string
	title: string
	articles: Array<ArticleDocument>
}

const DEFAULT_CONTAINER_HEIGHT = 'h-[calc(65px_*_6_+_12px_*_5)]'
const DESKTOP_CONTAINER_HEIGHT = 'lg:h-(--container-height)'
/** The scroller's desktop height, five rows; a column beside the widget can match it. */
export const RESEARCH_WIDGET_SCROLLER_HEIGHT = 70 * 5 + 24 * 4

export function ResearchWidgetWithScrollbar({ id, title, articles }: ResearchWidgetWithScrollbarProps) {
	if (articles.length === 0) return null

	return (
		<div id={id}>
			<div className="mb-6.5">
				<TitleLine title={title} />
			</div>
			<div className="flex flex-col gap-y-16">
				<div>
					<ResearchWidgetWithScrollbarScroller articles={articles} />
					<div className="mt-auto shrink-0 pt-4.5 text-right">
						<ReadMoreLink url="/research#collections" title="Explore more" />
					</div>
				</div>
			</div>
		</div>
	)
}

function ResearchWidgetWithScrollbarScroller({ articles }: { articles: Array<ArticleDocument> }) {
	const containerHeight = `${DEFAULT_CONTAINER_HEIGHT} ${DESKTOP_CONTAINER_HEIGHT}`
	const style = { '--container-height': `${RESEARCH_WIDGET_SCROLLER_HEIGHT}px` } as CSSProperties

	return (
		<div style={style}>
			<div className={`overflow-y-auto ${containerHeight}`}>
				<div className="flex flex-col gap-y-3 lg:gap-y-6">
					{articles.map((article) => (
						<Link
							key={article.id}
							className="group relative top-0 flex gap-4 overflow-hidden rounded-lg"
							href={articleHref(article)}
						>
							<div className="relative aspect-[85/65] w-[85px] min-w-[85px] overflow-hidden rounded-[7px] group-hover:brightness-[0.8] lg:aspect-[120/70] lg:w-[120px] lg:min-w-[120px]">
								{article.coverImage ? (
									<img
										src={article.coverImage.url}
										alt={article.coverImage.alt ?? ''}
										className="h-full w-full object-cover"
										loading="lazy"
										decoding="async"
									/>
								) : null}
							</div>

							<div className="flex grow flex-col justify-between gap-1.75 pr-5">
								<div className="line-clamp-3 title-lg text-research-heading group-hover:text-research-heading group-hover:opacity-70 dark:text-research-ink dark:group-hover:text-on-brand/70">
									{article.title}
								</div>
							</div>
						</Link>
					))}
				</div>
			</div>
		</div>
	)
}
