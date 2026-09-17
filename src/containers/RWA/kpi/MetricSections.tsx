import type { CsvPayload } from '~/components/CsvDownloadButton'
import { MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import type { RwaNamedBar } from '../cards/cardData'
import { getRwaRatio } from '../cards/cardData'
import { percentChange, type RWAValueWithPrior } from '../table/change'
import type { RWATableMetrics } from '../table/rows'
import { formatRwaKpiUsd } from './format'
import { formatRwaKpiRatio, RWA_KPI_PERIOD, RWA_KPI_PERIOD_LABEL, RwaMetricChange } from './MetricChange'

/* The two sections and the csv rows every RWA Key Metrics panel shares; the labels differ per page, the rows do not. */

export type RwaKpiLabels = {
	activeMcap: { label: string; description: string }
	onChainMcap: { label: string; description: string }
	defiActiveTvl: { label: string; description: string }
}

const change = (value: RWAValueWithPrior) => percentChange(value.current, value.prior)

export function OnchainMcapSection({ metrics, labels }: { metrics: RWATableMetrics; labels: RwaKpiLabels }) {
	return (
		<MetricSection
			label={labels.onChainMcap.label}
			tooltip={labels.onChainMcap.description}
			value={formatRwaKpiUsd(metrics.onChainMcap)}
		>
			<SubMetricRow
				label={`Change (${RWA_KPI_PERIOD_LABEL})`}
				value={<RwaMetricChange change={metrics.change[RWA_KPI_PERIOD].onChainMcap} total={metrics.onChainMcap} />}
			/>
			<SubMetricRow
				label="Active / Onchain"
				tooltip="Active mcap as a share of onchain AUM."
				value={formatRwaKpiRatio(getRwaRatio(metrics.activeMcap, metrics.onChainMcap))}
			/>
		</MetricSection>
	)
}

export function DefiActiveTvlSection({
	metrics,
	largestProtocol,
	labels
}: {
	metrics: RWATableMetrics
	largestProtocol: RwaNamedBar | null
	labels: RwaKpiLabels
}) {
	return (
		<MetricSection
			label={labels.defiActiveTvl.label}
			tooltip={labels.defiActiveTvl.description}
			value={formatRwaKpiUsd(metrics.defiActiveTvl)}
		>
			<SubMetricRow
				label={`Change (${RWA_KPI_PERIOD_LABEL})`}
				value={<RwaMetricChange change={metrics.change[RWA_KPI_PERIOD].defiActiveTvl} total={metrics.defiActiveTvl} />}
			/>
			<SubMetricRow
				label="Utilization"
				tooltip="DeFi Active TVL as a share of active AUM."
				value={formatRwaKpiRatio(getRwaRatio(metrics.defiActiveTvl, metrics.activeMcap))}
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
	)
}

/** The csv rows behind the shared sections, in the order the panel reads. */
export function buildRwaCoreKpiCsvRows(
	metrics: RWATableMetrics,
	largestProtocol: RwaNamedBar | null,
	labels: RwaKpiLabels
): CsvPayload['rows'] {
	return [
		[labels.activeMcap.label, metrics.activeMcap],
		[`Active AUM change (${RWA_KPI_PERIOD_LABEL}) %`, change(metrics.change[RWA_KPI_PERIOD].activeMcap)],
		[labels.onChainMcap.label, metrics.onChainMcap],
		[`Onchain AUM change (${RWA_KPI_PERIOD_LABEL}) %`, change(metrics.change[RWA_KPI_PERIOD].onChainMcap)],
		['Active / Onchain %', getRwaRatio(metrics.activeMcap, metrics.onChainMcap)],
		[labels.defiActiveTvl.label, metrics.defiActiveTvl],
		[`DeFi Active TVL change (${RWA_KPI_PERIOD_LABEL}) %`, change(metrics.change[RWA_KPI_PERIOD].defiActiveTvl)],
		['Utilization %', getRwaRatio(metrics.defiActiveTvl, metrics.activeMcap)],
		['Largest protocol', largestProtocol?.name ?? null],
		['Largest protocol DeFi Active TVL', largestProtocol?.value ?? null]
	]
}
