import { lazy, Suspense } from 'react'
import { ExternalLinkButton } from '~/components/ExternalLinkButton'
import { WebsiteGlobeLink } from '~/components/WebsiteGlobeLink'
import { FundingRoundsTable } from '~/containers/PreIPO/FundingRoundsTable'
import { PerpetualMarketsTable, TokenIssuersTable } from '~/containers/PreIPO/IntegrationTables'
import { Card } from '~/ui/Card'
import { ChartPanelExportShellLoading, ChartPanelToolbar } from '~/ui/ChartPanel'
import { EntityTitleRow } from '~/ui/EntityTitleRow'
import { MetricRow } from '~/ui/MetricPrimitives'
import { Panel } from '~/ui/Panel'
import { StaleText } from '~/ui/StaleText'
import { SurfaceBodyStatus } from '~/ui/Status'
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
					<div className="flex flex-col">
						<EntityTitleRow
							logo={
								<img
									src={preIpoIconUrl(summary.id, 32)}
									alt={`${summary.name} logo`}
									width={24}
									height={24}
									className="size-6 shrink-0 rounded-full object-contain"
								/>
							}
							actions={
								<WebsiteGlobeLink
									url={summary.website}
									name={summary.name}
									event="pre-ipo-website-click"
									eventData={{ company: summary.id }}
								/>
							}
						>
							{summary.name}
						</EntityTitleRow>
						<p className="body-md text-secondary">{summary.sector}</p>
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
				<Panel className="col-span-2">
					{chart ? (
						<Suspense fallback={<ChartPanelExportShellLoading />}>
							<MultiSeriesChart
								dataset={chart.dataset}
								charts={chart.charts}
								chartOptions={{ xAxis: { max: chart.xAxisMaxTimestamp } }}
								valueSymbol="$"
								showLegend
								title={HISTORY_CHART_TITLE}
								exportButtons={{
									filename: `${summary.id}-valuation-history`,
									pngTitle: `${summary.name} ${HISTORY_CHART_TITLE}`
								}}
							/>
						</Suspense>
					) : (
						<>
							<ChartPanelToolbar>
								<h2 className="mr-auto heading-xs">{HISTORY_CHART_TITLE}</h2>
							</ChartPanelToolbar>
							<SurfaceBodyStatus variant="empty">No valuation history available.</SurfaceBodyStatus>
						</>
					)}
				</Panel>
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
				<StaleText as="p">
					{`Valuation and funding data updated ${formatDateTime(valuationDataUpdatedAt, { timeZone: 'local', timeZoneName: 'short' }) ?? '-'}.`}
				</StaleText>
				<StaleText as="p">
					{`Market data updated ${formatDateTime(marketDataUpdatedAt, { timeZone: 'local', timeZoneName: 'short' }) ?? '-'}.`}
				</StaleText>
			</div>
		</div>
	)
}
