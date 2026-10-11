import clsx from 'clsx'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useRef } from 'react'
import { pushResearchAnalyticsEvent } from '~/containers/Articles/landing/Analytics'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref, formatDate } from '~/containers/Articles/landing/utils'
import { RESEARCH_NEWSLETTER_ARCHIVE_URL, type ResearchNewsletterItem } from '~/containers/Articles/newsletterFeed'
import type { ArticleDocument } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

interface ResearchNewslettersProps {
	newsletters: Array<ResearchNewsletterItem>
	interviews: Array<ArticleDocument>
}

interface NewsletterCardProps {
	item: ResearchNewsletterItem
	isLarge: boolean
}

interface SectionLinkProps {
	url: string
	title: string
	onClick?: () => void
}

function SectionLink({ url, title, onClick }: SectionLinkProps) {
	const isExternal = url.startsWith('http')

	return (
		<Link
			href={url}
			className="inline-flex min-h-11 items-center gap-x-2 label-sm text-link uppercase"
			rel={isExternal ? 'noopener noreferrer' : undefined}
			target={isExternal ? '_blank' : undefined}
			onClick={onClick}
		>
			<span>{title}</span>
			<span aria-hidden>→</span>
		</Link>
	)
}

function NewsletterCard({ item, isLarge }: NewsletterCardProps) {
	return (
		<a
			className="group block h-full rounded-lg"
			href={item.href}
			target="_blank"
			rel="noopener noreferrer"
			onClick={() =>
				pushResearchAnalyticsEvent(null, 'widget_click', 'DefiLlama Research Newsletters widget', item.title)
			}
		>
			<div className="relative aspect-[368/240] overflow-hidden rounded-[7px] bg-surface-elevated-1 transition-[filter] duration-300 ease-out group-hover:brightness-[0.8]">
				{item.imageUrl ? (
					<img src={item.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
				) : (
					<div className="flex h-full items-center justify-center text-link">
						<Icon name="mail" className="size-10" aria-hidden />
					</div>
				)}
			</div>

			<div className="mt-3 flex flex-col gap-1">
				<h3
					className={clsx(
						'line-clamp-3 leading-[120%] font-semibold text-research-navy transition-colors duration-300 group-hover:text-secondary',
						isLarge ? 'text-lg lg:text-2xl' : 'text-base lg:text-lg'
					)}
				>
					{item.title}
				</h3>
				{item.publishedAt ? (
					<time dateTime={item.publishedAt} className="label-md text-tertiary">
						{formatDate(item.publishedAt)}
					</time>
				) : null}
			</div>
		</a>
	)
}

export function ResearchNewsletters({ newsletters, interviews }: ResearchNewslettersProps) {
	const newsletterContentRef = useRef<HTMLDivElement>(null)
	const [firstNewsletter, secondNewsletter, ...remainingNewsletters] = newsletters.slice(0, 5)
	const firstRow = [firstNewsletter, secondNewsletter].filter(
		(item): item is ResearchNewsletterItem => item !== undefined
	)
	const secondRow = remainingNewsletters.slice(0, 3)
	// The newsletter column is an earlier sibling, so its ref is attached before this one in the same commit.
	const matchNewsletterHeight = (interviewScroller: HTMLDivElement | null) => {
		const newsletterContent = newsletterContentRef.current
		if (!interviewScroller || !newsletterContent) return
		const observer = new ResizeObserver((entries) => {
			const height = entries[0]?.contentRect.height
			if (height) interviewScroller.style.setProperty('--newsletter-content-height', `${height}px`)
		})
		observer.observe(newsletterContent)
		return () => observer.disconnect()
	}

	if (newsletters.length === 0) return null

	return (
		<div className={clsx('grid grid-cols-1 gap-9', interviews.length > 0 && 'lg:grid-cols-[725fr_403fr]')}>
			<section id="newsletters" className="min-w-0">
				<div className="mb-6">
					<TitleLine title="Research Notes Newsletters" />
				</div>

				<div ref={newsletterContentRef}>
					<div className={clsx('grid grid-cols-1 gap-6', firstRow.length > 1 && 'sm:grid-cols-2')}>
						{firstRow.map((item) => (
							<NewsletterCard key={item.id} item={item} isLarge />
						))}
					</div>

					{secondRow.length > 0 ? (
						<div className="mt-6 grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:pb-0">
							{secondRow.map((item) => (
								<div key={item.id} className="snap-start">
									<NewsletterCard item={item} isLarge={false} />
								</div>
							))}
						</div>
					) : null}
				</div>

				<div className="flex min-h-11 flex-wrap items-center justify-end gap-x-6 gap-y-2 pt-3">
					<SectionLink
						url="/newsletters"
						title="Subscribe"
						onClick={() => pushResearchAnalyticsEvent(null, 'widget_click', 'Research newsletter subscribe CTA')}
					/>
					<SectionLink
						url={RESEARCH_NEWSLETTER_ARCHIVE_URL}
						title="View all newsletters"
						onClick={() => pushResearchAnalyticsEvent(null, 'widget_click', 'Research newsletter archive CTA')}
					/>
				</div>
			</section>

			{interviews.length > 0 ? (
				<section id="interviews" className="flex min-h-0 min-w-0 flex-col">
					<div className="mb-6">
						<TitleLine title="Interviews" />
					</div>

					<div
						ref={matchNewsletterHeight}
						className="max-h-[423px] min-h-0 overflow-y-auto lg:max-h-(--newsletter-content-height) lg:flex-1"
						style={{ '--newsletter-content-height': '580px' } as CSSProperties}
					>
						<ul className="flex flex-col gap-3 pr-2">
							{interviews.map((article) => (
								<li key={article.id}>
									<Link
										className="group flex min-h-[75px] items-center gap-4 rounded-lg"
										href={articleHref(article)}
										onClick={() =>
											pushResearchAnalyticsEvent(article, 'widget_click', 'DefiLlama Research Interview widget')
										}
									>
										<span className="line-clamp-3 min-w-0 flex-1 text-base leading-snug font-medium text-research-navy transition-colors group-hover:text-secondary lg:text-lg lg:font-semibold">
											{article.title}
										</span>
										{article.coverImage?.url ? (
											<div className="relative h-[75px] w-[75px] shrink-0 overflow-hidden rounded-full transition-[filter] duration-300 group-hover:brightness-[0.8] lg:h-[105px] lg:w-[105px]">
												<img
													src={article.coverImage.url}
													alt={article.coverImage.alt ?? ''}
													className="h-full w-full object-cover"
													loading="lazy"
													decoding="async"
												/>
											</div>
										) : (
											<div className="h-[75px] w-[75px] shrink-0 rounded-full bg-surface-elevated-1 lg:h-[105px] lg:w-[105px]" />
										)}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div className="mt-auto flex min-h-11 shrink-0 items-center justify-end pt-3">
						<SectionLink url="/research?section=interview" title="View all interviews" />
					</div>
				</section>
			) : null}
		</div>
	)
}
