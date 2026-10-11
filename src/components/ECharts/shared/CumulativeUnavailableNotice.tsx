import { Button } from '~/ui/Button'
import { ChartPanelBodyEmpty } from '~/ui/ChartPanel'
import { ScopeNote } from '~/ui/ScopeNote'

/**
 * Explains a selected metric missing from a cumulative chart: a running total of daily active addresses counts the
 * same address again every day. `fill` takes the whole chart body when that metric was the only one selected.
 */
export function CumulativeUnavailableNotice({
	metric,
	fill,
	onShowDaily
}: {
	metric: string
	fill: boolean
	onShowDaily: () => void
}) {
	const showDaily = (
		<Button type="button" variant="ghost" size="sm" onClick={onShowDaily}>
			Show daily
		</Button>
	)
	if (fill) {
		return (
			<ChartPanelBodyEmpty className="gap-2">
				<span>Cumulative isn&apos;t available for {metric}.</span>
				{showDaily}
			</ChartPanelBodyEmpty>
		)
	}
	return (
		<ScopeNote role="status">
			Cumulative isn&apos;t available for {metric}.{' '}
			{/* Button is a flex box, so it needs an inline wrapper to sit in the sentence. */}
			<span className="inline-flex align-middle">{showDaily}</span>
		</ScopeNote>
	)
}
