import type { CsvPayload } from '~/components/CsvDownloadButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { TokenLogo } from '~/components/TokenLogo'
import { Icon } from '~/ui/Icon'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryChange, SummaryStatsCard } from '~/ui/SummaryStats'
import { formatCompactNumber } from '~/utils/numberFormat'
import { definitions } from '../definitions'
import type { RWAPlatformMeta } from '../PlatformPage/api.types'
import { percentChange } from '../table/change'
import { formatRwaKpiUsd } from './format'
import { RWA_KPI_PERIOD, RWA_KPI_PERIOD_LABEL } from './MetricChange'
import { buildRwaCoreKpiCsvRows, DefiActiveTvlSection, OnchainMcapSection, type RwaKpiLabels } from './MetricSections'
import type { RWAPlatformKpi } from './platformKpi'

export type RWAPlatformKeyMetricsProps = {
	meta: RWAPlatformMeta
	/** The fold over the rows the table shows; the index's own AUM is not read. */
	kpi: RWAPlatformKpi
}

const PERIOD = RWA_KPI_PERIOD
const PERIOD_LABEL = RWA_KPI_PERIOD_LABEL
const COUNT_FORMAT = { minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' } as const
/** A platform reads its own numbers, so the labels are the per-asset ones, not the overview totals. */
const LABELS: RwaKpiLabels = {
	activeMcap: definitions.activeMcap,
	onChainMcap: definitions.onChainMcap,
	defiActiveTvl: definitions.defiActiveTvl
}

/** The rows the csv button writes: one label and value per line, the way the panel reads. */
export function buildRwaPlatformKeyMetricsCsv({ meta, kpi }: RWAPlatformKeyMetricsProps): CsvPayload {
	const { metrics, largestProtocol } = kpi
	return {
		filename: `rwa-platform-${meta.slug}-key-metrics.csv`,
		rows: [
			['Metric', 'Value'],
			...buildRwaCoreKpiCsvRows(metrics, largestProtocol, LABELS),
			[definitions.flows.assetNetFlow30d.label, metrics.netFlow30d],
			[definitions.flows.assetNetFlow7d.label, metrics.netFlow7d],
			['Live Assets', metrics.assetCount],
			['Issuers', metrics.issuerCount],
			['Est. Annual Revenue', meta.estAnnualRevenueUsd],
			['Revenue confidence', meta.revenueConfidence]
		]
	}
}

/** The platform page's Key Metrics card: the identity, one headline, four sections that open into their rows, the csv. */
export function RWAPlatformKeyMetrics(props: RWAPlatformKeyMetricsProps) {
	const { meta, kpi } = props
	const { metrics, largestProtocol } = kpi
	const headlineChange = metrics.change[PERIOD].activeMcap
	const headlinePercent = percentChange(headlineChange.current, headlineChange.prior)

	return (
		<SummaryStatsCard padding="sm">
			<div className="flex flex-col gap-2">
				<h1 className="flex flex-wrap items-center gap-2 heading-sm">
					{meta.logo ? <TokenLogo src={meta.logo} size={24} alt={`${meta.name} logo`} /> : null}
					<span>{meta.name}</span>
					{meta.suspicious === true ? (
						<span className="flex items-center gap-1 rounded-full bg-surface-elevated-2 px-2 py-0.5 label-sm text-data-down">
							<Icon name="alert-triangle" className="size-3.5" />
							Suspicious
						</span>
					) : null}
				</h1>
				{meta.suspicious === true && meta.suspiciousReason ? (
					<p className="flex items-start gap-1.5 body-sm text-data-down">
						<Icon name="alert-triangle" className="mt-0.5 size-3.5 shrink-0" />
						{meta.suspiciousReason}
					</p>
				) : null}
			</div>
			<div className="flex flex-nowrap items-end justify-between gap-8">
				<StatItem
					label={definitions.activeMcap.label}
					labelAs="h2"
					tooltip={definitions.activeMcap.description}
					value={formatRwaKpiUsd(metrics.activeMcap)}
					truncate
				/>
				{headlinePercent != null ? (
					<SummaryChange percent={headlinePercent} comparison={`over ${PERIOD_LABEL}`} />
				) : null}
			</div>
			<KeyMetricsPanel footer={<CSVDownloadButton prepareCsv={() => buildRwaPlatformKeyMetricsCsv(props)} smol />}>
				<OnchainMcapSection metrics={metrics} labels={LABELS} />
				<DefiActiveTvlSection metrics={metrics} largestProtocol={largestProtocol} labels={LABELS} />
				<MetricSection
					label={definitions.flows.assetNetFlow30d.label}
					tooltip={definitions.flows.assetNetFlow30d.description}
					value={formatRwaKpiUsd(metrics.netFlow30d)}
				>
					<SubMetricRow
						label={definitions.flows.assetNetFlow7d.label}
						tooltip={definitions.flows.assetNetFlow7d.description}
						value={formatRwaKpiUsd(metrics.netFlow7d)}
					/>
				</MetricSection>
				<MetricSection label="Live Assets" value={formatCompactNumber(metrics.assetCount, COUNT_FORMAT)}>
					<SubMetricRow
						label="Issuers"
						tooltip={definitions.issuer.description}
						value={formatCompactNumber(metrics.issuerCount, COUNT_FORMAT)}
					/>
				</MetricSection>
				{meta.estAnnualRevenueUsd != null ? (
					<MetricSection label="Est. Annual Revenue" value={formatRwaKpiUsd(meta.estAnnualRevenueUsd)}>
						<SubMetricRow
							label="Confidence"
							value={meta.revenueConfidence ?? 'N/A'}
							valueClassName="ml-auto label-md"
						/>
					</MetricSection>
				) : null}
			</KeyMetricsPanel>
		</SummaryStatsCard>
	)
}
