import type { CsvPayload } from '~/components/CsvDownloadButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryStatsCard } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatPercentChange } from '~/utils/numberFormat'
import type { RwaNamedBar, RwaPerpsTotals } from '../cards/cardData'
import { getRwaRatio } from '../cards/cardData'
import { definitions } from '../definitions'
import { perpsDefinitions } from '../Perps/definitions'
import { percentChange, type RWAChangePeriod, type RWAValueWithPrior } from '../table/change'
import type { RWATableMetrics } from '../table/rows'
import { formatRwaKpiUsd, getRwaChangeCoverage } from './format'

export type RWAKeyMetricsProps = {
	/** The page totals after its filters, the fold the tiles used. */
	metrics: RWATableMetrics
	/** Open interest over the venues the CEX toggle allows, whichever view is open. */
	perps: RwaPerpsTotals
	largestProtocol: RwaNamedBar | null
}

/** Every change in the panel reads 24h whatever the table's period switch says. */
const PERIOD: RWAChangePeriod = '1d'
const PERIOD_LABEL = '24h'

function formatRatio(value: number | null): string {
	return value == null ? 'N/A' : formatPercent(value, { input: 'percent', maximumFractionDigits: 1 })
}

function ChangeValue({ change, total }: { change: RWAValueWithPrior; total: number | null }) {
	const percent = percentChange(change.current, change.prior)
	if (percent == null) return <span className="ml-auto mono-md text-tertiary">N/A</span>
	const tone = percent > 0 ? 'text-data-up' : percent < 0 ? 'text-data-down' : 'text-secondary'
	const coverage = getRwaChangeCoverage(total, change)
	const changeUsd = change.current != null && change.prior != null ? change.current - change.prior : null
	const note = [
		changeUsd == null ? null : `${changeUsd >= 0 ? '+' : ''}${formatRwaKpiUsd(changeUsd)}`,
		coverage != null && coverage < 0.995
			? `over the ${formatPercent(coverage, { input: 'fraction' })} of this total with a value ${PERIOD_LABEL} ago`
			: null
	]
		.filter((part) => part != null)
		.join(', ')
	return (
		<Tooltip content={note} className={`ml-auto justify-end truncate mono-md underline decoration-dotted ${tone}`}>
			{formatPercentChange(percent)}
		</Tooltip>
	)
}

const change = (value: RWAValueWithPrior) => percentChange(value.current, value.prior)

/** The rows the csv button writes: one label and value per line, the way the panel reads. */
export function buildRwaKeyMetricsCsv({ metrics, perps, largestProtocol }: RWAKeyMetricsProps): CsvPayload {
	return {
		filename: 'rwa-key-metrics.csv',
		rows: [
			['Metric', 'Value'],
			[definitions.totalActiveMcap.label, metrics.activeMcap],
			[`Active AUM change (${PERIOD_LABEL}) %`, change(metrics.change[PERIOD].activeMcap)],
			[definitions.totalOnChainMcap.label, metrics.onChainMcap],
			[`Onchain AUM change (${PERIOD_LABEL}) %`, change(metrics.change[PERIOD].onChainMcap)],
			['Active / Onchain %', getRwaRatio(metrics.activeMcap, metrics.onChainMcap)],
			[definitions.totalDefiActiveTvl.label, metrics.defiActiveTvl],
			[`DeFi Active TVL change (${PERIOD_LABEL}) %`, change(metrics.change[PERIOD].defiActiveTvl)],
			['Utilization %', getRwaRatio(metrics.defiActiveTvl, metrics.activeMcap)],
			['Largest protocol', largestProtocol?.name ?? null],
			['Largest protocol DeFi Active TVL', largestProtocol?.value ?? null],
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
	const utilization = getRwaRatio(metrics.defiActiveTvl, metrics.activeMcap)
	const activeShare = getRwaRatio(metrics.activeMcap, metrics.onChainMcap)

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
					<MetricSection
						label={definitions.totalOnChainMcap.label}
						tooltip={definitions.totalOnChainMcap.description}
						value={formatRwaKpiUsd(metrics.onChainMcap)}
					>
						<SubMetricRow
							label={`Change (${periodLabel})`}
							value={<ChangeValue change={metrics.change[PERIOD].onChainMcap} total={metrics.onChainMcap} />}
						/>
						<SubMetricRow
							label="Active / Onchain"
							tooltip="Active AUM as a share of onchain AUM."
							value={formatRatio(activeShare)}
						/>
					</MetricSection>
					<MetricSection
						label={definitions.totalDefiActiveTvl.label}
						tooltip={definitions.totalDefiActiveTvl.description}
						value={formatRwaKpiUsd(metrics.defiActiveTvl)}
					>
						<SubMetricRow
							label={`Change (${periodLabel})`}
							value={<ChangeValue change={metrics.change[PERIOD].defiActiveTvl} total={metrics.defiActiveTvl} />}
						/>
						<SubMetricRow
							label="Utilization"
							tooltip="DeFi Active TVL as a share of active AUM."
							value={formatRatio(utilization)}
						/>
						<SubMetricRow
							label="Largest protocol"
							value={
								largestProtocol ? (
									<span className="ml-auto flex items-baseline gap-2">
										<span className="mono-md-bold">{largestProtocol.name}</span>
										<span className="mono-md">{formatRwaKpiUsd(largestProtocol.value)}</span>
									</span>
								) : (
									<span className="ml-auto mono-md text-tertiary">N/A</span>
								)
							}
						/>
					</MetricSection>
					<MetricSection
						label="RWA Perps OI"
						tooltip={perpsDefinitions.totalOpenInterest.description}
						value={formatRwaKpiUsd(perps.openInterest)}
					>
						<SubMetricRow
							label="Change (24h)"
							value={<ChangeValue change={perps.openInterestChange24h} total={perps.openInterest} />}
						/>
						<SubMetricRow
							label="DEX share"
							tooltip="Open interest on DEX venues as a share of all open interest."
							value={formatRatio(perps.dexShare)}
						/>
						<SubMetricRow label="Volume (24h)" value={formatRwaKpiUsd(perps.volume24h)} />
					</MetricSection>
				</div>
			</div>
			<CSVDownloadButton prepareCsv={() => buildRwaKeyMetricsCsv(props)} smol className="ml-auto" />
		</SummaryStatsCard>
	)
}
