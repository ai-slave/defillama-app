import { Button } from '~/ui/Button'
import { ChartPanelBodyFallback } from '~/ui/ChartPanel'

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
	const content = (
		<>
			<span>Cumulative isn&apos;t available for {metric}.</span>
			<Button type="button" variant="ghost" size="sm" onClick={onShowDaily}>
				Show daily
			</Button>
		</>
	)
	if (fill) {
		return (
			<ChartPanelBodyFallback role="status" className="gap-2 body-sm text-tertiary">
				{content}
			</ChartPanelBodyFallback>
		)
	}
	return (
		<div role="status" className="flex items-center gap-2 px-2 body-sm text-tertiary">
			{content}
		</div>
	)
}
