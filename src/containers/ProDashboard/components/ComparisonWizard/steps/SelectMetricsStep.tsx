import { useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { useAppMetadata } from '../../../AppMetadataContext'
import { useComparisonWizardContext } from '../ComparisonWizardContext'
import { MetricCard } from '../components/MetricCard'

export function SelectMetricsStep() {
	const { state, actions, availableMetrics } = useComparisonWizardContext()
	// Availability comes from app metadata: until it loads every metric reads as unavailable.
	const { loading: metadataLoading, error: metadataError, retry: retryMetadata } = useAppMetadata()
	const [showInvalid, setShowInvalid] = useState(false)

	const validMetrics = useMemo(() => availableMetrics.filter((m) => m.isValid), [availableMetrics])
	const invalidMetrics = useMemo(() => availableMetrics.filter((m) => !m.isValid), [availableMetrics])

	const displayedMetrics = showInvalid ? availableMetrics : validMetrics

	const typeLabel = state.comparisonType === 'chains' ? 'chains' : 'protocols'

	return (
		<div className="flex flex-col gap-4">
			<div className="text-center">
				<h3 className="label-md text-primary">Select metrics to compare</h3>
				<p className="mt-1 body-sm text-secondary">
					Choose the metrics you want to compare across your selected {typeLabel}.
				</p>
			</div>

			{metadataLoading ? (
				<div role="status" aria-live="polite" className="flex justify-center py-6">
					<LoadingIndicator label="Checking metric availability" />
				</div>
			) : metadataError ? (
				<InlineStatus variant="error">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>Could not check which metrics the selected {typeLabel} have.</span>
						<Button type="button" size="sm" onClick={retryMetadata}>
							Try again
						</Button>
					</div>
				</InlineStatus>
			) : (
				<>
					<div className="flex items-center gap-3 rounded-lg border border-subtle px-4 py-2.5">
						<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-link-on-tint">
							<Icon name="bar-chart-2" height={18} width={18} />
						</div>
						<div className="flex min-w-0 flex-col items-start">
							<p className="label-sm text-primary">
								{validMetrics.length} metric{validMetrics.length === 1 ? '' : 's'} available
							</p>
							<p className="body-sm text-tertiary">Based on data availability for your selected {typeLabel}.</p>
							{invalidMetrics.length > 0 ? (
								// -ml-2.25 (px-2 + 1px border) puts the label on the text edge; -mb-1 bleeds the hover into the padding.
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setShowInvalid(!showInvalid)}
									className="-mb-1 -ml-2.25"
								>
									{showInvalid ? 'Hide' : 'Show'} unavailable ({invalidMetrics.length})
								</Button>
							) : null}
						</div>
					</div>

					<div className="flex items-center justify-between">
						<span className="label-sm text-secondary">
							{state.selectedMetrics.length} metric{state.selectedMetrics.length !== 1 ? 's' : ''} selected
						</span>
						{/* -mr-2.25 (px-2 + 1px border) puts the last label on the cards' edge; -my-1 keeps the row 16px. */}
						<div className="-my-1 -mr-2.25 flex items-center">
							{state.selectedMetrics.length < validMetrics.length ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => actions.selectAllMetrics(validMetrics.map((m) => m.metric))}
								>
									Select all
								</Button>
							) : null}
							{state.selectedMetrics.length > 0 ? (
								<Button type="button" variant="ghost" size="sm" onClick={() => actions.clearMetrics()}>
									Clear
								</Button>
							) : null}
						</div>
					</div>

					<div className="max-h-[340px] overflow-y-auto rounded-lg">
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{displayedMetrics.map((metric) => (
								<MetricCard
									key={metric.metric}
									metric={metric}
									isSelected={state.selectedMetrics.includes(metric.metric)}
									onToggle={() => actions.toggleMetric(metric.metric)}
									disabled={!metric.isValid}
									itemLabel={typeLabel}
								/>
							))}
						</div>
					</div>
					{displayedMetrics.length === 0 ? (
						<InlineStatus variant="empty">
							The selected {typeLabel} don't have enough common metrics to compare. Try selecting different {typeLabel}.
						</InlineStatus>
					) : null}
				</>
			)}
		</div>
	)
}
