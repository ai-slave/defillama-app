import { BasicLink } from '~/components/Link'
import { articleHref, formatDate } from '~/containers/Articles/landing/utils'
import type { ResearchSponsorEntityType, SponsoredResearchReportSummary } from '~/containers/Articles/types'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'

type Props = {
	reports: SponsoredResearchReportSummary[] | null | undefined
	entityType: ResearchSponsorEntityType
	entitySlug: string
	layout?: 'stacked' | 'grid'
	className?: string
}

export function SponsoredResearchReportsCard({
	reports,
	entityType,
	entitySlug,
	layout = 'stacked',
	className
}: Props) {
	if (!reports?.length) return null

	return (
		<Card as="section" padding="sm" className={`flex flex-col gap-3${className ? ` ${className}` : ''}`}>
			<div className="flex items-center justify-between gap-3">
				<h2 className="heading-xs text-primary" id="research-reports">
					Latest from DefiLlama Research
				</h2>
				<BasicLink href="/research" className="shrink-0">
					<span className="relative block h-6 w-[76px]">
						<img
							src="/assets/research_logo_dark.webp"
							width={76}
							height={24}
							className="invisible absolute inset-0 object-contain object-right dark:visible"
							alt=""
						/>
						<img
							src="/assets/research_logo.webp"
							width={76}
							height={24}
							className="visible absolute inset-0 object-contain object-right dark:invisible"
							alt=""
						/>
					</span>
					<span className="sr-only">Visit DefiLlama Research</span>
				</BasicLink>
			</div>

			<div className={layout === 'grid' ? 'grid gap-2 md:grid-cols-3' : 'grid gap-2'}>
				{reports.map((report) => {
					const image = report.carouselImage ?? report.coverImage
					return (
						<BasicLink
							key={report.id}
							href={articleHref(report)}
							className={`hover-wash-card group min-w-0 rounded-lg p-2 ${
								layout === 'grid' ? 'grid content-start gap-3' : 'flex items-start gap-3'
							}`}
							data-umami-event="sponsored-research-report-click"
							data-umami-event-entity-type={entityType}
							data-umami-event-entity={entitySlug}
							data-umami-event-article-id={report.id}
						>
							{image ? (
								<img
									src={image.url}
									alt={image.alt?.trim() || report.title}
									className={
										layout === 'grid'
											? 'h-28 w-full rounded-md object-cover'
											: 'h-20 w-28 shrink-0 rounded-md object-cover'
									}
									loading="lazy"
								/>
							) : null}
							<span className="grid min-w-0 flex-1 gap-2">
								<span className="line-clamp-3 label-md text-primary group-hover:text-link">{report.title}</span>
								<span className="flex flex-wrap items-center justify-between gap-2 body-sm text-tertiary">
									<span>{formatDate(report.displayDate ?? report.publishedAt)}</span>
									<span className="inline-flex items-center gap-1 label-sm text-primary">
										Read report <Icon name="arrow-up-right" height={14} width={14} />
									</span>
								</span>
							</span>
						</BasicLink>
					)
				})}
			</div>
		</Card>
	)
}
