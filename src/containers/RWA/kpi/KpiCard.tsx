import type { ReactNode } from 'react'
import type { CsvPayload } from '~/components/CsvDownloadButton'
import { CSVDownloadButton } from '~/components/CsvDownloadButton'
import { KeyMetricsPanel } from '~/ui/KeyMetricsCard'
import { MetricRow, MetricSection, SubMetricRow } from '~/ui/MetricPrimitives'
import { StatItem, SummaryChange, SummaryStatsCard } from '~/ui/SummaryStats'
import { percentChange } from '../table/change'
import { formatRwaKpiCount, formatRwaKpiUsd, formatRwaMultiple } from './format'
import { buildRwaKpiCsv, type RwaKpiHeadline, type RwaKpiRow } from './kpiRows'
import { formatRwaKpiRatio, RWA_KPI_PERIOD_LABEL, RwaMetricChange } from './MetricChange'

const FORMAT = {
	usd: formatRwaKpiUsd,
	ratio: formatRwaKpiRatio,
	count: (value: number | null) => (value == null ? 'N/A' : formatRwaKpiCount(value)),
	turnover: (value: number | null) => formatRwaMultiple(value, 1) ?? 'N/A'
}

function drawValue(row: RwaKpiRow): ReactNode {
	const { value } = row
	if (row.text != null) return row.text
	switch (value.kind) {
		case 'change':
			return <RwaMetricChange change={value.change} total={value.total} />
		case 'text':
			return value.value ?? 'N/A'
		case 'named':
			return value.name == null ? (
				<span className="ml-auto mono-md text-tertiary">N/A</span>
			) : (
				<span className="ml-auto flex items-baseline gap-2">
					<span className="label-md">{value.name}</span>
					<span className="mono-md">{formatRwaKpiUsd(value.value)}</span>
				</span>
			)
		default:
			return FORMAT[value.kind](value.value)
	}
}

function SubRow({ row }: { row: RwaKpiRow }) {
	return (
		<SubMetricRow
			label={row.label}
			tooltip={row.tooltip}
			value={drawValue(row)}
			{...(row.value.kind === 'text' ? { valueClassName: 'ml-auto label-md' } : null)}
		/>
	)
}

/**
 * One Key Metrics card: the caller's identity block, the headline with its 24h change, the rows, the csv of the
 * same rows. The headline wraps its change under a long page name instead of squeezing it.
 */
export function RWAKpiCard({
	identity,
	headline,
	rows,
	csvName,
	csvLead
}: {
	identity?: ReactNode
	headline: RwaKpiHeadline
	rows: Array<RwaKpiRow>
	csvName: string
	csvLead?: CsvPayload['rows']
}) {
	const percent = percentChange(headline.change.current, headline.change.prior)
	return (
		<SummaryStatsCard padding="sm">
			{identity}
			<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
				<StatItem
					label={headline.label}
					labelAs={headline.labelAs}
					tooltip={headline.tooltip}
					value={formatRwaKpiUsd(headline.value)}
					truncate
				/>
				{percent != null ? <SummaryChange value={percent} comparison={`over ${RWA_KPI_PERIOD_LABEL}`} /> : null}
			</div>
			<KeyMetricsPanel
				footer={
					<CSVDownloadButton
						prepareCsv={() => buildRwaKpiCsv({ filename: csvName, headline, rows, lead: csvLead })}
						smol
					/>
				}
			>
				{rows.map((row) =>
					row.rows ? (
						<MetricSection key={row.label} label={row.label} tooltip={row.tooltip} value={drawValue(row)}>
							{row.rows.map((sub) => (
								<SubRow key={sub.label} row={sub} />
							))}
						</MetricSection>
					) : (
						<MetricRow key={row.label} label={row.label} tooltip={row.tooltip} value={drawValue(row)} />
					)
				)}
			</KeyMetricsPanel>
		</SummaryStatsCard>
	)
}
