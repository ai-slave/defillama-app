import type { CsvPayload } from '~/components/CsvDownloadButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryStatsCard } from '~/ui/SummaryStats'
import { formatPercentChange } from '~/utils/numberFormat'
import type { RwaNamedBar, RwaPerpsTotals } from '../cards/cardData'
import { definitions } from '../definitions'
import { perpsDefinitions } from '../Perps/definitions'
import { percentChange, type RWAValueWithPrior } from '../table/change'
import type { RWATableMetrics } from '../table/rows'
import { formatRwaKpiUsd } from './format'
import { formatRwaKpiRatio, RWA_KPI_PERIOD, RWA_KPI_PERIOD_LABEL, RwaMetricChange } from './MetricChange'
import { buildRwaCoreKpiCsvRows, DefiActiveTvlSection, OnchainMcapSection, type RwaKpiLabels } from './MetricSections'

export type RWAKeyMetricsProps = {
	/** The page totals after its filters, the fold the tiles used. */
	metrics: RWATableMetrics
	/** Open interest over the venues the CEX toggle allows, whichever view is open. */
	perps: RwaPerpsTotals
	largestProtocol: RwaNamedBar | null
}

const PERIOD = RWA_KPI_PERIOD
const PERIOD_LABEL = RWA_KPI_PERIOD_LABEL
/** The overview reads the totals over every asset, so the labels say so. */
const LABELS: RwaKpiLabels = {
	activeMcap: definitions.totalActiveMcap,
	onChainMcap: definitions.totalOnChainMcap,
	defiActiveTvl: definitions.totalDefiActiveTvl
}

const change = (value: RWAValueWithPrior) => percentChange(value.current, value.prior)

/** The rows the csv button writes: one label and value per line, the way the panel reads. */
export function buildRwaKeyMetricsCsv({ metrics, perps, largestProtocol }: RWAKeyMetricsProps): CsvPayload {
	return {
		filename: 'rwa-key-metrics.csv',
		rows: [
			['Metric', 'Value'],
			...buildRwaCoreKpiCsvRows(metrics, largestProtocol, LABELS),
			['RWA Perps OI', perps.openInterest],
			['RWA Perps OI change (24h) %', change(perps.openInterestChange24h)],
			['DEX share %', perps.dexShare],
			['Perps volume (24h)', perps.volume24h]
		]
	}
}

/** The home page Key Metrics panel with the RWA rows. The KPI tiles folded into it. */
export function RWAKeyMetrics(props: RWAKeyMetricsProps) {
	const { metrics, perps, largestProtocol } = props
	const headlineChange = metrics.change[PERIOD].activeMcap
	const headlinePercent = percentChange(headlineChange.current, headlineChange.prior)
	const periodLabel = PERIOD_LABEL

	return (
		<SummaryStatsCard padding="sm">
			<div className="flex flex-nowrap items-end justify-between gap-8">
				<StatItem
					label={definitions.totalActiveMcap.label}
					labelAs="h2"
					tooltip={definitions.totalActiveMcap.description}
					value={formatRwaKpiUsd(metrics.activeMcap)}
					truncate
				/>
				{headlinePercent != null ? (
					<p className="relative bottom-0.5 flex flex-nowrap items-center gap-1">
						<span className={`truncate mono-md ${headlinePercent >= 0 ? 'text-data-up' : 'text-data-down'}`}>
							{formatPercentChange(headlinePercent)}
						</span>
						<span className="body-md text-tertiary">{periodLabel}</span>
					</p>
				) : null}
			</div>
			<div className="flex flex-col gap-2">
				<h2 className="label-md">Key Metrics</h2>
				<div className="flex flex-col">
					<OnchainMcapSection metrics={metrics} labels={LABELS} />
					<DefiActiveTvlSection metrics={metrics} largestProtocol={largestProtocol} labels={LABELS} />
					<MetricSection
						label="RWA Perps OI"
						tooltip={perpsDefinitions.totalOpenInterest.description}
						value={formatRwaKpiUsd(perps.openInterest)}
					>
						<SubMetricRow
							label="Change (24h)"
							value={<RwaMetricChange change={perps.openInterestChange24h} total={perps.openInterest} />}
						/>
						<SubMetricRow
							label="DEX share"
							tooltip="Open interest on DEX venues as a share of all open interest."
							value={formatRwaKpiRatio(perps.dexShare)}
						/>
						<SubMetricRow label="Volume (24h)" value={formatRwaKpiUsd(perps.volume24h)} />
					</MetricSection>
				</div>
			</div>
			<CSVDownloadButton prepareCsv={() => buildRwaKeyMetricsCsv(props)} smol className="ml-auto" />
		</SummaryStatsCard>
	)
}
