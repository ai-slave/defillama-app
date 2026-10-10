import { Change, formatChange } from '~/ui/Change'
import { formatPercent } from '~/utils/numberFormat'
import { percentChange, type RWAValueWithPrior } from '../table/change'
import { getRwaChangeCoverage } from './format'

/** Every change in a Key Metrics panel reads 24h whatever the table's period switch says. */
export const RWA_KPI_PERIOD = '1d' as const
export const RWA_KPI_PERIOD_LABEL = '24h'

export function formatRwaKpiRatio(value: number | null): string {
	return value == null ? 'N/A' : formatPercent(value, { input: 'percent', maximumFractionDigits: 1 })
}

/** A percent change, the dollar change and the coverage in its tooltip; N/A without a prior. */
export function RwaMetricChange({ change, total }: { change: RWAValueWithPrior; total: number | null }) {
	const percent = percentChange(change.current, change.prior)
	if (percent == null) return <span className="ml-auto mono-md text-tertiary">N/A</span>
	const coverage = getRwaChangeCoverage(total, change)
	const changeUsd = change.current != null && change.prior != null ? change.current - change.prior : null
	const note = [
		changeUsd == null ? null : formatChange(changeUsd, 'usd'),
		coverage != null && coverage < 0.995
			? `over the ${formatPercent(coverage, { input: 'fraction' })} of this total with a value ${RWA_KPI_PERIOD_LABEL} ago`
			: null
	]
		.filter((part) => part != null)
		.join(', ')
	return (
		<span className="ml-auto mono-md">
			<Change value={percent} tooltip={note} />
		</span>
	)
}
