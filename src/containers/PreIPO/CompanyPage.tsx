import { lazy, Suspense } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { FundingRoundsTable } from '~/containers/PreIPO/FundingRoundsTable'
import { PerpetualMarketsTable, TokenIssuersTable } from '~/containers/PreIPO/IntegrationTables'
import { Card } from '~/ui/Card'
import { ChartPanel, ChartPanelBodyFallback, ChartPanelExportShellFallback, ChartPanelToolbar } from '~/ui/ChartPanel'
import { MetricRow } from '~/ui/MetricPrimitives'
import { SummaryCardGrid, SummaryStatsCard } from '~/ui/SummaryStats'
import { formatDate, formatDateTime } from '~/utils/dateFormat'
import { preIpoIconUrl } from '~/utils/icons'
import { formatUsd } from '~/utils/numberFormat'
import { PRE_IPO_USD_OPTIONS } from './constants'
import { preIpoDefinitions } from './definitions'
import type { PreIpoCompanyPageProps } from './types'

const MultiSeriesChart = lazy(() => import('~/components/ECharts/MultiSeriesChart'))
const HISTORY_CHART_TITLE = 'Valuation & Funding History'

export function PreIpoCompanyPage({
	summary,
	raises,
	integrations,
	chart,
	valuationDataUpdatedAt,
	marketDataUpdatedAt
}: PreIpoCompanyPageProps) {
	return (
		<div className="flex flex-col gap-2">
			<SummaryCardGrid>
				<SummaryStatsCard padding="sm" gap="sm">
					<div className="flex min-w-0 items-start gap-2">
						<img
							src={preIpoIconUrl(summary.id, 32)}
							alt={`${summary.name} logo`}
							width={24}
							height={24}
							className="size-6 shrink-0 rounded-full object-contain"
						/>
						<div className="min-w-0 flex-1">
							<h1 className="flex min-w-0 items-center gap-2 heading-sm">
								<span className="truncate">{summary.name}</span>
								<span className="-m-2 ml-auto shrink-0">
									<WebsiteGlobeLink
										url={summary.website}
										name={summary.name}
										event="pre-ipo-website-click"
										eventData={{ company: summary.id }}
									/>
								</span>
							</h1>
							<p className="body-md text-secondary">{summary.sector}</p>
						</div>
					</div>
					<div className="flex flex-col">
						<MetricRow
							label={preIpoDefinitions.company.estimatedValuation.label}
							tooltip={preIpoDefinitions.company.estimatedValuation.description}
							value={formatUsd(summary.latestEstimatedValuation, PRE_IPO_USD_OPTIONS) ?? '-'}
						/>
						<MetricRow
							label={preIpoDefinitions.company.valuationAsOf.label}
							tooltip={preIpoDefinitions.company.valuationAsOf.description}
							value={formatDate(summary.lastValuationDate) ?? '-'}
						/>
						<MetricRow
							label={preIpoDefinitions.company.latestRaise.label}
							tooltip={preIpoDefinitions.company.latestRaise.description}
							value={formatUsd(summary.latestRaise?.amountRaised ?? null, PRE_IPO_USD_OPTIONS) ?? '-'}
						/>
						<MetricRow label="Latest Round" value={summary.latestRaise?.series ?? '-'} />
						<MetricRow
							label={preIpoDefinitions.company.latestFundingValuation.label}
							tooltip={preIpoDefinitions.company.latestFundingValuation.description}
							value={formatUsd(summary.latestRaise?.valuation ?? null, PRE_IPO_USD_OPTIONS) ?? '-'}
						/>
						<MetricRow
							label={preIpoDefinitions.company.latestFundingDate.label}
							tooltip={preIpoDefinitions.company.latestFundingDate.description}
							value={summary.latestRaise ? (formatDate(summary.latestRaise.date) ?? '-') : '-'}
						/>
					</div>
				</SummaryStatsCard>
				<ChartPanel className="col-span-2">
					{chart ? (
						<Suspense fallback={<ChartPanelExportShellFallback />}>
							<MultiSeriesChart
								dataset={chart.dataset}
								charts={chart.charts}
								chartOptions={{ xAxis: { max: chart.xAxisMaxTimestamp } }}
								valueSymbol="$"
								hideDefaultLegend={false}
								title={HISTORY_CHART_TITLE}
								exportButtons={{
									png: true,
									csv: true,
									filename: `${summary.id}-valuation-history`,
									pngTitle: `${summary.name} ${HISTORY_CHART_TITLE}`
								}}
							/>
						</Suspense>
					) : (
						<>
							<ChartPanelToolbar className="justify-end">
								<h2 className="mr-auto heading-xs">{HISTORY_CHART_TITLE}</h2>
							</ChartPanelToolbar>
							<ChartPanelBodyFallback className="body-md text-secondary">
								No valuation history available
							</ChartPanelBodyFallback>
						</>
					)}
				</ChartPanel>
			</SummaryCardGrid>

			<Card as="section" padding="sm" className="flex flex-col gap-3 body-md">
				<h2 className="heading-xs">About {summary.name}</h2>
				<p>{summary.description}</p>
				<div className="flex flex-wrap gap-3">
					<ExternalLinkButton
						href={summary.website}
						icon="globe"
						data-umami-event="pre-ipo-website-click"
						data-umami-event-company={summary.id}
						data-umami-event-placement="info"
						data-umami-event-url={summary.website}
					>
						Website
					</ExternalLinkButton>
				</div>
			</Card>

			<FundingRoundsTable companyName={summary.name} raises={raises} />
			<PerpetualMarketsTable companyName={summary.name} perps={integrations.perps} />
			<TokenIssuersTable companyName={summary.name} tokenIssuers={integrations.tokenIssuers} />

			<div className="flex flex-wrap gap-x-4 gap-y-1 px-1 body-sm text-tertiary">
				<p suppressHydrationWarning>
					Valuation and funding data updated{' '}
					{formatDateTime(valuationDataUpdatedAt, {
						timeZone: 'local',
						timeZoneName: 'short'
					}) ?? '-'}
					.
				</p>
				<p suppressHydrationWarning>
					Market data updated{' '}
					{formatDateTime(marketDataUpdatedAt, {
						timeZone: 'local',
						timeZoneName: 'short'
					}) ?? '-'}
					.
				</p>
			</div>
		</div>
	)
}
