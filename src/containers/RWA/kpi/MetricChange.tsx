import { Tooltip } from '~/ui/Tooltip'
import { formatPercent, formatPercentChange } from '~/utils/numberFormat'
import { percentChange, type RWAValueWithPrior } from '../table/change'
import { formatRwaKpiUsd, getRwaChangeCoverage } from './format'

/** Every change in a Key Metrics panel reads 24h whatever the table's period switch says. */
export const RWA_KPI_PERIOD = '1d' as const
export const RWA_KPI_PERIOD_LABEL = '24h'

export function formatRwaKpiRatio(value: number | null): string {
	return value == null ? 'N/A' : formatPercent(value, { input: 'percent', maximumFractionDigits: 1 })
}

/** A percent change in the sign's tone, the dollar change and the coverage in its tooltip; N/A without a prior. */
export function RwaMetricChange({ change, total }: { change: RWAValueWithPrior; total: number | null }) {
	const percent = percentChange(change.current, change.prior)
	if (percent == null) return <span className="ml-auto mono-md text-tertiary">N/A</span>
	const tone = percent > 0 ? 'text-data-up' : percent < 0 ? 'text-data-down' : 'text-secondary'
	const coverage = getRwaChangeCoverage(total, change)
	const changeUsd = change.current != null && change.prior != null ? change.current - change.prior : null
	const note = [
		changeUsd == null ? null : `${changeUsd >= 0 ? '+' : ''}${formatRwaKpiUsd(changeUsd)}`,
		coverage != null && coverage < 0.995
			? `over the ${formatPercent(coverage, { input: 'fraction' })} of this total with a value ${RWA_KPI_PERIOD_LABEL} ago`
			: null
	]
		.filter((part) => part != null)
		.join(', ')
	return (
		<Tooltip content={note} render={<span className={`ml-auto mono-md underline decoration-dotted ${tone}`} />}>
			{formatPercentChange(percent)}
		</Tooltip>
	)
}
