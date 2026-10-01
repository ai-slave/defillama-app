import React, { type CSSProperties } from 'react'
import { DownloadPdfLink } from '~/containers/Articles/landing/DownloadPdfLink'
import { ReadMoreLink } from '~/containers/Articles/landing/ReadMoreLink'
import { SponsoredByBadge } from '~/containers/Articles/landing/SponsoredByBadge'
import { TitleLine } from '~/containers/Articles/landing/TitleLine'
import { articleHref } from '~/containers/Articles/landing/utils'
import type { ArticleDocument } from '~/containers/Articles/types'

interface ResearchReportHighlightProps {
	highlight: ArticleDocument
	sharedHeight?: number
}

export function ResearchReportHighlight({ highlight, sharedHeight }: ResearchReportHighlightProps) {
	const coverUrl = highlight.coverImage?.url
	const excerpt =
		highlight.editorialTagMetadata?.highlightText?.trim() ||
		highlight.reportDescription?.trim() ||
		highlight.excerpt?.trim() ||
		highlight.subtitle?.trim() ||
		''
	const sponsorLogoUrl = highlight.sponsorLogo?.url
	const pdfUrl = highlight.reportPdf?.url ?? null

	return (
		<div className="flex flex-col">
			<div className="pb-3.75 lg:pb-6.5">
				<TitleLine title="Report highlight" />
			</div>
			<div className="grid grow grid-cols-1 gap-8 lg:grid-cols-[397fr_719fr] lg:gap-12">
				<div className="flex flex-col gap-6">
					<h2 className="text-2xl leading-[150%] font-medium text-research-heading dark:text-research-ink">
						{highlight.title}
					</h2>
					{coverUrl ? (
						<div className="relative w-full">
							<img
								src={coverUrl}
								alt={highlight?.coverImage?.alt}
								className="h-full w-full rounded-[6px] object-cover"
								loading="lazy"
								decoding="async"
							/>
							{sponsorLogoUrl ? <SponsoredByBadge sponsorLogo={highlight.sponsorLogo} /> : null}
						</div>
					) : null}
				</div>

				<div className="flex flex-col">
					<div
						className="max-h-[270px] flex-1 overflow-y-auto lg:min-h-(--min-height)"
						style={sharedHeight ? ({ '--min-height': `${sharedHeight}px` } as CSSProperties) : undefined}
					>
						<div className="flex flex-col justify-between gap-6">
							{excerpt ? (
								<div className="text-sm leading-[150%] text-primary/90 dark:text-research-ink">
									<p className="mb-2 whitespace-break-spaces last:mb-0">{excerpt}</p>
								</div>
							) : null}
						</div>
					</div>

					<div className="mt-auto flex items-center justify-end gap-4 pt-2">
						{pdfUrl ? (
							<DownloadPdfLink
								article={highlight}
								pdfUrl={pdfUrl}
								widgetLabel="Report highlight"
								className="text-[13px] font-medium text-research-heading underline-offset-4 hover:underline dark:text-research-ink"
							/>
						) : null}
						<ReadMoreLink url={articleHref(highlight)} title="Read this report" />
					</div>
				</div>
			</div>
		</div>
	)
}
