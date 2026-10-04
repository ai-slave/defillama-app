import clsx from 'clsx'
import Link from 'next/link'
import React, { useEffect, useRef } from 'react'
import { InViewAnalytics, pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import {
	ResearchSectionWithSharedHeightProvider,
	useSharedHeight
} from '~/containers/Articles/landing/ResearchSectionWithSharedHeight'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'
import { useMedia } from '~/hooks/useMedia'

interface Props {
	title: string
	articles: Array<ArticleDocument>
}

interface ResearchInterviewsContentProps {
	articles: Array<ArticleDocument>
	pageWidget: string
}

function ResearchInterviewsContent({ articles, pageWidget }: ResearchInterviewsContentProps) {
	const isMobile = useMedia('(max-width: 768px)')
	const context = useSharedHeight()
	const height = context?.height
	const setHeight = context?.setHeight
	const leftColumnInnerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!setHeight || !leftColumnInnerRef.current) return
		const el = leftColumnInnerRef.current
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry?.contentRect.height) setHeight(entry.contentRect.height)
		})
		observer.observe(el)
		setHeight(el.getBoundingClientRect().height)
		return () => observer.disconnect()
	}, [setHeight])

	const leftArticles = isMobile ? articles.slice(0, 2) : articles.slice(0, 5)
	const rightArticles = isMobile ? articles.slice(2) : articles.slice(5)
	const firstRow = leftArticles.slice(0, 2)
	const secondRow = isMobile ? [] : leftArticles.slice(2, 5)
	const visibleRightCount = Math.min(rightArticles.length, 5)
	const rightColumnHeightMobile = visibleRightCount > 0 ? 75 * visibleRightCount + 12 * (visibleRightCount - 1) : 0

	const cardLink = (article: ArticleDocument, isFirst: boolean, isBig: boolean) => (
		<Link
			key={article.id}
			className="group block"
			href={articleHref(article)}
			onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', pageWidget)}
		>
			<div className="relative aspect-[368/240] overflow-hidden rounded-[7.2px] text-center transition-all duration-500 ease-out group-hover:brightness-[0.8]">
				{article.coverImage?.url ? (
					<img
						src={article.coverImage.url}
						alt={article.coverImage.alt ?? ''}
						className="mx-auto h-full w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
				) : null}
			</div>
			<div className={clsx('mt-3 flex grow flex-col', isBig ? 'lg:h-[90px]' : 'lg:h-[65px]')}>
				{isFirst && <InViewAnalytics eventParams={[article, 'widget_impression', pageWidget]} />}
				<div
					className={clsx(
						'line-clamp-3 leading-[120%] font-semibold text-research-heading transition-all duration-500 ease-out group-hover:text-research-heading group-hover:opacity-70 dark:text-research-ink dark:group-hover:text-on-brand/70',
						isBig ? 'text-base lg:text-2xl' : 'text-base lg:text-lg'
					)}
				>
					{article.title}
				</div>
			</div>
		</Link>
	)

	return (
		<div className="grid grid-cols-1 gap-9 lg:grid-cols-[725fr_403fr]">
			<div className="flex flex-col">
				<div ref={leftColumnInnerRef} className="flex flex-col gap-6">
					<div className="grid grid-cols-2 gap-6">{firstRow.map((article, i) => cardLink(article, i === 0, true))}</div>
					{secondRow.length > 0 && (
						<div className="grid grid-cols-3 gap-4">{secondRow.map((article) => cardLink(article, false, false))}</div>
					)}
				</div>
			</div>

			<div className="flex min-h-0 flex-col">
				<div
					className="min-h-0 overflow-y-auto lg:flex-1"
					style={
						isMobile
							? { height: `${rightColumnHeightMobile}px` }
							: height != null
								? { maxHeight: `${height}px` }
								: undefined
					}
				>
					<ul className="flex flex-col gap-3 pr-2">
						{rightArticles.map((article) => (
							<li key={article.id}>
								<Link
									className="group flex items-center gap-4"
									href={articleHref(article)}
									onClick={() => pushResearchAnalyticsEvent(article, 'widget_click', pageWidget)}
								>
									<span className="line-clamp-2 min-w-0 flex-1 text-base leading-snug font-medium text-research-heading transition-colors group-hover:text-research-heading lg:text-lg lg:font-semibold dark:text-research-ink dark:group-hover:text-on-brand/70">
										{article.title}
									</span>
									{article.coverImage?.url ? (
										<div className="relative h-[75px] w-[75px] shrink-0 overflow-hidden rounded-full transition-all duration-300 group-hover:brightness-[0.8] lg:h-[105px] lg:w-[105px]">
											<img
												src={article.coverImage.url}
												alt={article.coverImage.alt ?? ''}
												className="h-full w-full object-cover"
												loading="lazy"
												decoding="async"
											/>
										</div>
									) : (
										<div className="h-[75px] w-[75px] shrink-0 rounded-full bg-surface-elevated-1 lg:h-[105px] lg:w-[105px] dark:bg-research-wash-strong" />
									)}
								</Link>
							</li>
						))}
					</ul>
				</div>
				<div className="mt-auto shrink-0 pt-4.5 text-right">
					<ReadMoreLink url="/research?section=interview" title="View all interviews" />
				</div>
			</div>
		</div>
	)
}

export function ResearchInterviews({ title, articles }: Props) {
	const pageWidget = 'DefiLlama Research Interview widget'

	if (articles.length === 0) return null

	return (
		<div id="interviews">
			<div className="mb-6">
				<TitleLine title={title} />
			</div>
			<ResearchSectionWithSharedHeightProvider>
				<ResearchInterviewsContent articles={articles} pageWidget={pageWidget} />
			</ResearchSectionWithSharedHeightProvider>
		</div>
	)
}
